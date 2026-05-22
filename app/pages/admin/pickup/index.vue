<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()

const { data: allSchedules, refresh } = await useAsyncData('schedules', async () => {
  const { data } = await supabase
    .from('pickup_schedules')
    .select('*, members(full_name), kurir:users!pickup_schedules_kurir_id_fkey(full_name)')
    .order('scheduled_date', { ascending: false })
  return data ?? []
})

const { data: pendingReports } = await useAsyncData('pending-reports', async () => {
  const { data } = await supabase
    .from('pickup_reports')
    .select('*, members(full_name), kurir:users!pickup_reports_kurir_id_fkey(full_name), pickup_schedules(scheduled_date)')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })
  return data ?? []
})

const { data: members } = await useAsyncData('members-list', async () => {
  const { data } = await supabase.from('members').select('id, full_name').eq('is_active', true).order('full_name')
  return data ?? []
})

const activeTab = ref('jadwal')

// Filter bulan
const selectedMonth = ref('') // '' = semua

const monthOptions = computed(() => {
  const months = new Set<string>()
  allSchedules.value?.forEach(s => {
    const m = s.scheduled_date?.slice(0, 7) // YYYY-MM
    if (m) months.add(m)
  })
  return Array.from(months).sort((a, b) => b.localeCompare(a))
})

const schedules = computed(() => {
  if (!selectedMonth.value) return allSchedules.value ?? []
  return allSchedules.value?.filter(s => s.scheduled_date?.startsWith(selectedMonth.value)) ?? []
})

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1)
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

// Stats (dari filtered)
const totalOpen = computed(() => schedules.value.filter(s => s.status === 'open').length)
const totalClaimed = computed(() => schedules.value.filter(s => s.status === 'claimed').length)
const totalCompleted = computed(() => schedules.value.filter(s => s.status === 'completed').length)

// Modal Buat
const showModal = ref(false)
const modalLoading = ref(false)
const modalError = ref('')
const form = reactive({
  member_id: '', scheduled_date: new Date().toISOString().split('T')[0],
  scheduled_time: '', est_volume_kg: '', notes: '',
})

async function submitJadwal() {
  if (!form.member_id || !form.scheduled_date) { modalError.value = 'Member dan tanggal wajib diisi'; return }
  modalLoading.value = true; modalError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('pickup_schedules').insert({
    member_id: form.member_id,
    scheduled_date: form.scheduled_date,
    scheduled_time: form.scheduled_time || null,
    est_volume_kg: form.est_volume_kg ? Number(form.est_volume_kg) : null,
    notes: form.notes || null,
    status: 'open',
    created_by: user?.id,
  })
  if (error) { modalError.value = 'Gagal menyimpan'; modalLoading.value = false; return }
  showModal.value = false
  Object.assign(form, { member_id: '', scheduled_date: new Date().toISOString().split('T')[0], scheduled_time: '', est_volume_kg: '', notes: '' })
  modalLoading.value = false
  refresh()
}

// Modal Edit
const showEditModal = ref(false)
const editForm = reactive({ id: '', member_id: '', scheduled_date: '', scheduled_time: '', est_volume_kg: '', notes: '' })

function openEdit(s: any) {
  Object.assign(editForm, { id: s.id, member_id: s.member_id, scheduled_date: s.scheduled_date, scheduled_time: s.scheduled_time?.slice(0,5) ?? '', est_volume_kg: s.est_volume_kg ?? '', notes: s.notes ?? '' })
  showEditModal.value = true
}

async function submitEdit() {
  modalLoading.value = true
  await supabase.from('pickup_schedules').update({
    member_id: editForm.member_id, scheduled_date: editForm.scheduled_date,
    scheduled_time: editForm.scheduled_time || null,
    est_volume_kg: editForm.est_volume_kg ? Number(editForm.est_volume_kg) : null,
    notes: editForm.notes || null, updated_at: new Date().toISOString(),
  }).eq('id', editForm.id)
  showEditModal.value = false; modalLoading.value = false; refresh()
}

// Hapus
const showDeleteModal = ref(false)
const deleteTarget = ref<any>(null)
function openDelete(s: any) { deleteTarget.value = s; showDeleteModal.value = true }
async function confirmDelete() {
  await supabase.from('pickup_schedules').delete().eq('id', deleteTarget.value.id)
  showDeleteModal.value = false; refresh()
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isClaimable(scheduledDate: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const pickup = new Date(scheduledDate); pickup.setHours(0,0,0,0)
  return Math.ceil((pickup.getTime() - today.getTime()) / 86400000) <= 3
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Tersedia', color: '#2563eb', bg: '#eff6ff' },
  claimed: { label: 'Diambil', color: '#d97706', bg: '#fffbeb' },
  completed: { label: 'Selesai', color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: 'Dibatalkan', color: '#dc2626', bg: '#fef2f2' },
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Pickup</h2>
        <p class="text-gray-400 text-sm mt-0.5">Jadwal & laporan pickup jelantah</p>
      </div>
      <button
        class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-all"
        style="background-color:#16a34a"
        @click="showModal = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Buat Jadwal
      </button>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Tersedia</p>
        <p class="text-3xl font-bold text-blue-600">{{ totalOpen }}</p>
        <p class="text-xs text-gray-400 mt-1">Menunggu kurir</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Dalam Proses</p>
        <p class="text-3xl font-bold text-amber-500">{{ totalClaimed }}</p>
        <p class="text-xs text-gray-400 mt-1">Sudah diambil kurir</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Selesai</p>
        <p class="text-3xl font-bold" style="color:#16a34a">{{ totalCompleted }}</p>
        <p class="text-xs text-gray-400 mt-1">Berhasil dikumpulkan</p>
      </div>
    </div>

    <!-- Tabs + Filter -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          class="px-4 py-2 text-sm font-medium rounded-lg transition-all"
          :class="activeTab === 'jadwal' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          @click="activeTab = 'jadwal'"
        >
          Jadwal Pickup
        </button>
        <button
          class="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
          :class="activeTab === 'review' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          @click="activeTab = 'review'"
        >
          Review Laporan
          <span v-if="pendingReports?.length" class="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {{ pendingReports.length }}
          </span>
        </button>
      </div>

      <!-- Filter Bulan -->
      <div v-if="activeTab === 'jadwal'" class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <select
          v-model="selectedMonth"
          class="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          <option value="">Semua Bulan</option>
          <option v-for="m in monthOptions" :key="m" :value="m">
            {{ formatMonthLabel(m) }}
          </option>
        </select>
      </div>
    </div>

    <!-- Tab: Jadwal -->
    <div v-if="activeTab === 'jadwal'">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead>
            <tr style="background-color:#f9fafb">
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tanggal</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Member</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Kurir</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Est. Vol</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Claim</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
              <th class="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!schedules.length">
              <td colspan="7" class="py-12 text-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ selectedMonth ? 'Tidak ada jadwal di bulan ini' : 'Belum ada jadwal pickup' }}
              </td>
            </tr>
            <tr
              v-for="s in schedules"
              :key="s.id"
              class="border-t border-gray-50 hover:bg-gray-50 transition-colors"
              :class="s.status === 'cancelled' ? 'opacity-60' : ''"
            >
              <td class="py-3 px-4">
                <p class="font-medium text-gray-800">{{ formatDate(s.scheduled_date) }}</p>
                <p v-if="s.scheduled_time" class="text-xs text-gray-400">{{ s.scheduled_time.slice(0,5) }}</p>
              </td>
              <td class="py-3 px-4 font-medium text-gray-800">{{ s.members?.full_name }}</td>
              <td class="py-3 px-4">
                <span v-if="s.kurir?.full_name" class="flex items-center gap-1.5">
                  <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style="background-color:#16a34a">
                    {{ s.kurir.full_name.charAt(0) }}
                  </span>
                  <span class="text-gray-700">{{ s.kurir.full_name }}</span>
                </span>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="py-3 px-4 text-gray-600">{{ s.est_volume_kg ? s.est_volume_kg + ' L' : '—' }}</td>
              <td class="py-3 px-4">
                <span
                  class="text-xs font-medium px-2 py-1 rounded-lg"
                  :style="isClaimable(s.scheduled_date) ? 'background:#f0fdf4;color:#16a34a' : 'background:#f9fafb;color:#9ca3af'"
                >
                  {{ isClaimable(s.scheduled_date) ? 'Bisa' : 'Belum' }}
                </span>
              </td>
              <td class="py-3 px-4">
                <span
                  class="text-xs font-medium px-2.5 py-1 rounded-lg"
                  :style="`background:${statusConfig[s.status]?.bg};color:${statusConfig[s.status]?.color}`"
                >
                  {{ statusConfig[s.status]?.label }}
                </span>
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-1 justify-end">
                  <button
                    v-if="s.status === 'open'"
                    class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                    title="Edit"
                    @click="openEdit(s)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    v-if="s.status === 'open' || s.status === 'cancelled'"
                    class="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    title="Hapus"
                    @click="openDelete(s)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Review Laporan -->
    <div v-if="activeTab === 'review'">
      <div v-if="!pendingReports?.length" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mx-auto mb-3" style="color:#16a34a" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="font-medium">Semua laporan sudah direview</p>
        <p class="text-sm mt-1">Tidak ada yang menunggu</p>
      </div>
      <div v-else class="space-y-3">
        <div v-for="report in pendingReports" :key="report.id" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <p class="font-semibold text-gray-800">{{ report.members?.full_name }}</p>
                <span class="text-xs px-2 py-0.5 rounded-lg font-medium" style="background:#fffbeb;color:#d97706">Pending</span>
              </div>
              <p class="text-sm text-gray-500 mb-3">
                Kurir: <strong>{{ report.kurir?.full_name }}</strong> · {{ formatDate(report.pickup_schedules?.scheduled_date) }}
              </p>
              <div class="flex gap-3">
                <div class="bg-gray-50 rounded-xl px-3 py-2 text-center">
                  <p class="text-xs text-gray-400">Volume</p>
                  <p class="font-bold text-gray-800">{{ report.actual_volume_kg }} L</p>
                </div>
                <div class="bg-red-50 rounded-xl px-3 py-2 text-center">
                  <p class="text-xs text-red-400">Dibayar ke Member</p>
                  <p class="font-bold text-red-600">Rp {{ Number(report.total_paid).toLocaleString('id-ID') }}</p>
                </div>
              </div>
            </div>
            <NuxtLink
              :to="`/admin/pickup/review/${report.id}`"
              class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl"
              style="background-color:#16a34a"
            >
              Review
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Buat Jadwal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Buat Jadwal Pickup</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Member <span class="text-red-500">*</span></label>
            <select v-model="form.member_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Pilih member</option>
              <option v-for="m in members" :key="m.id" :value="m.id">{{ m.full_name }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Tanggal <span class="text-red-500">*</span></label>
              <input v-model="form.scheduled_date" type="date" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Jam</label>
              <input v-model="form.scheduled_time" type="time" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Est. Volume (L)</label>
            <input v-model="form.est_volume_kg" type="number" placeholder="Contoh: 10" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea v-model="form.notes" rows="2" placeholder="Instruksi khusus..." class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>
          <div v-if="modalError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{{ modalError }}</div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium" @click="showModal = false">Batal</button>
          <button :disabled="modalLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#16a34a" @click="submitJadwal">
            {{ modalLoading ? 'Menyimpan...' : 'Buat Jadwal' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Edit -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Edit Jadwal</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showEditModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Member</label>
            <select v-model="editForm.member_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option v-for="m in members" :key="m.id" :value="m.id">{{ m.full_name }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
              <input v-model="editForm.scheduled_date" type="date" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Jam</label>
              <input v-model="editForm.scheduled_time" type="time" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Est. Volume (L)</label>
            <input v-model="editForm.est_volume_kg" type="number" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea v-model="editForm.notes" rows="2" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium" @click="showEditModal = false">Batal</button>
          <button :disabled="modalLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#2563eb" @click="submitEdit">
            {{ modalLoading ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Hapus -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div class="px-6 py-5 text-center">
          <div class="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Hapus Jadwal?</h3>
          <p class="text-sm text-gray-500">
            Jadwal pickup untuk <strong>{{ deleteTarget?.members?.full_name }}</strong> akan dihapus permanen.
          </p>
        </div>
        <div class="px-6 pb-5 flex gap-3">
          <button class="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors" @click="showDeleteModal = false">Batal</button>
          <button class="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors" @click="confirmDelete">Hapus</button>
        </div>
      </div>
    </div>

  </div>
</template>
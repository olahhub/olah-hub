<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const refreshKey = ref(0)

const { data: kurirs } = await useAsyncData(
  () => `kurirs-${refreshKey.value}`,
  async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    return (data ?? []).filter((u: any) => u.role === 'kurir')
  }
)

// Statistik per kurir
const { data: kurirStats } = await useAsyncData('kurir-stats', async () => {
  const { data } = await supabase
    .from('pickup_reports')
    .select('kurir_id, actual_volume_liter, status')
    .eq('status', 'approved')
  return data ?? []
})

const { data: serviceFees } = await useAsyncData('service-fees', async () => {
  const { data } = await supabase
    .from('kurir_service_fees')
    .select('kurir_id, total_fee, status')
  return data ?? []
})

function getKurirVolume(kurirId: string) {
  return kurirStats.value
    ?.filter(r => r.kurir_id === kurirId)
    .reduce((a, b) => a + Number(b.actual_volume_liter), 0) ?? 0
}

function getKurirFee(kurirId: string) {
  return serviceFees.value
    ?.filter(f => f.kurir_id === kurirId)
    .reduce((a, b) => a + Number(b.total_fee), 0) ?? 0
}

function getKurirPaidFee(kurirId: string) {
  return serviceFees.value
    ?.filter(f => f.kurir_id === kurirId && f.status === 'paid')
    .reduce((a, b) => a + Number(b.total_fee), 0) ?? 0
}

function getKurirPendingFee(kurirId: string) {
  return getKurirFee(kurirId) - getKurirPaidFee(kurirId)
}

const totalAktif = computed(() => kurirs.value?.filter(k => k.is_active).length ?? 0)
const totalVolume = computed(() => kurirStats.value?.reduce((a, b) => a + Number(b.actual_volume_liter), 0) ?? 0)
const totalFee = computed(() => serviceFees.value?.reduce((a, b) => a + Number(b.total_fee), 0) ?? 0)
const totalPendingFee = computed(() => serviceFees.value?.filter(f => f.status === 'pending').reduce((a, b) => a + Number(b.total_fee), 0) ?? 0)

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

// Modal Tambah
const showModal = ref(false)
const showDeleteModal = ref(false)
const deleteTarget = ref<any>(null)
const loading = ref(false)
const errorMsg = ref('')
const form = reactive({ full_name: '', email: '', password: '', phone: '' })
const showPassword = ref(false)

async function tambahKurir() {
  if (!form.full_name || !form.email || !form.password) { errorMsg.value = 'Nama, email, dan password wajib diisi'; return }
  if (form.password.length < 6) { errorMsg.value = 'Password minimal 6 karakter'; return }
  loading.value = true; errorMsg.value = ''
  const result = await $fetch('/api/kurir/create', {
    method: 'POST',
    body: { full_name: form.full_name, email: form.email, password: form.password, phone: form.phone }
  }).catch((err) => ({ success: false, error: err.message }))
  if (!result.success) { errorMsg.value = result.error ?? 'Gagal membuat akun'; loading.value = false; return }
  showModal.value = false
  Object.assign(form, { full_name: '', email: '', password: '', phone: '' })
  loading.value = false
  window.location.reload()
}

async function toggleActive(kurir: any) {
  await $fetch('/api/kurir/update', { method: 'POST', body: { id: kurir.id, action: 'toggle', is_active: !kurir.is_active } })
  window.location.reload()
}

function openDelete(k: any) { deleteTarget.value = k; showDeleteModal.value = true }

async function confirmDelete() {
  await $fetch('/api/kurir/update', { method: 'POST', body: { id: deleteTarget.value.id, action: 'delete' } })
  showDeleteModal.value = false
  window.location.reload()
}

// Detail Jasa Kurir
const showFeeModal = ref(false)
const selectedKurir = ref<any>(null)
const kurirFeeDetail = ref<any[]>([])

async function openFeeDetail(kurir: any) {
  selectedKurir.value = kurir
  showFeeModal.value = true
  const { data } = await supabase
    .from('kurir_service_fees')
    .select(`
      *,
      members(full_name, distance_km),
      pickup_reports(actual_volume_liter, submitted_at, pickup_schedules(scheduled_date))
    `)
    .eq('kurir_id', kurir.id)
    .order('created_at', { ascending: false })
  kurirFeeDetail.value = data ?? []
}

async function markFeePaid(feeId: string) {
  await supabase.from('kurir_service_fees').update({
    status: 'paid',
    paid_at: new Date().toISOString()
  }).eq('id', feeId)
  await openFeeDetail(selectedKurir.value)
}

async function markAllFeePaid(kurirId: string) {
  await supabase.from('kurir_service_fees').update({
    status: 'paid',
    paid_at: new Date().toISOString()
  }).eq('kurir_id', kurirId).eq('status', 'pending')
  await openFeeDetail(selectedKurir.value)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Kurir</h2>
        <p class="text-gray-400 text-sm mt-0.5">Daftar akun & statistik kurir lapangan</p>
      </div>
      <button
        class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-all"
        style="background-color:#16a34a"
        @click="showModal = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Tambah Kurir
      </button>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Total Kurir</p>
        <p class="text-3xl font-bold text-gray-800">{{ kurirs?.length ?? 0 }}</p>
        <p class="text-xs text-gray-400 mt-1">Terdaftar</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Aktif</p>
        <p class="text-3xl font-bold" style="color:#16a34a">{{ totalAktif }}</p>
        <p class="text-xs text-gray-400 mt-1">Siap bertugas</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Total Volume</p>
        <p class="text-3xl font-bold text-gray-800">{{ totalVolume.toFixed(1) }}</p>
        <p class="text-xs text-gray-400 mt-1">Liter dikumpulkan</p>
      </div>
      <div class="rounded-2xl p-4 shadow-sm" style="background:linear-gradient(135deg,#ea580c,#c2410c)">
        <p class="text-xs text-orange-200 uppercase tracking-wide mb-2">Jasa Belum Bayar</p>
        <p class="text-2xl font-bold text-white">{{ formatRupiah(totalPendingFee) }}</p>
        <p class="text-xs text-orange-200 mt-1">Dari total {{ formatRupiah(totalFee) }}</p>
      </div>
    </div>

    <!-- Tabel Kurir -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table class="w-full text-sm text-left">
        <thead>
          <tr style="background-color:#f9fafb">
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nama</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Telepon</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Total Volume</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Jasa Kurir</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Belum Dibayar</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
            <th class="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!kurirs?.length">
            <td colspan="7" class="py-12 text-center text-gray-400">Belum ada kurir</td>
          </tr>
          <tr
            v-for="k in kurirs"
            :key="k.id"
            class="border-t border-gray-50 hover:bg-gray-50 transition-colors"
          >
            <td class="py-3 px-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style="background-color:#16a34a">
                  {{ k.full_name.charAt(0) }}
                </div>
                <span class="font-medium" style="color:#1f2937">{{ k.full_name }}</span>
              </div>
            </td>
            <td class="py-3 px-4" style="color:#374151">{{ k.phone ?? '—' }}</td>
            <td class="py-3 px-4">
              <span class="font-bold" style="color:#1f2937">{{ getKurirVolume(k.id).toFixed(1) }}</span>
              <span class="text-xs text-gray-400 ml-1">L</span>
            </td>
            <td class="py-3 px-4 font-bold" style="color:#16a34a">{{ formatRupiah(getKurirFee(k.id)) }}</td>
            <td class="py-3 px-4">
              <span class="font-bold" :style="getKurirPendingFee(k.id) > 0 ? 'color:#ea580c' : 'color:#9ca3af'">
                {{ formatRupiah(getKurirPendingFee(k.id)) }}
              </span>
            </td>
            <td class="py-3 px-4">
              <span class="text-xs font-medium px-2.5 py-1 rounded-lg"
                :style="k.is_active ? 'background:#f0fdf4;color:#16a34a' : 'background:#f9fafb;color:#9ca3af'"
              >
                {{ k.is_active ? 'Aktif' : 'Nonaktif' }}
              </span>
            </td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-1 justify-end">
                <button
                  class="p-1.5 rounded-lg hover:bg-orange-50 text-gray-300 hover:text-orange-500 transition-colors"
                  title="Detail Jasa"
                  @click="openFeeDetail(k)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </button>
                <button
                  class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-xs font-medium px-3 py-1.5"
                  :style="k.is_active ? 'color:#9ca3af' : 'color:#16a34a'"
                  @click="toggleActive(k)"
                >
                  {{ k.is_active ? 'Nonaktifkan' : 'Aktifkan' }}
                </button>
                <button
                  class="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  @click="openDelete(k)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Detail Jasa Kurir -->
    <div v-if="showFeeModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-screen overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 class="text-lg font-bold text-gray-800">Detail Jasa — {{ selectedKurir?.full_name }}</h3>
            <p class="text-xs text-gray-400 mt-0.5">Riwayat jasa pickup & pembayaran</p>
          </div>
          <button class="text-gray-400 hover:text-gray-600" @click="showFeeModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="px-6 py-4">
          <!-- Summary -->
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="bg-gray-50 rounded-xl p-3 text-center">
              <p class="text-xs text-gray-400">Total Jasa</p>
              <p class="font-bold" style="color:#16a34a">{{ formatRupiah(getKurirFee(selectedKurir?.id)) }}</p>
            </div>
            <div class="bg-green-50 rounded-xl p-3 text-center">
              <p class="text-xs text-gray-400">Sudah Dibayar</p>
              <p class="font-bold" style="color:#16a34a">{{ formatRupiah(getKurirPaidFee(selectedKurir?.id)) }}</p>
            </div>
            <div class="bg-orange-50 rounded-xl p-3 text-center">
              <p class="text-xs text-gray-400">Belum Dibayar</p>
              <p class="font-bold" style="color:#ea580c">{{ formatRupiah(getKurirPendingFee(selectedKurir?.id)) }}</p>
            </div>
          </div>

          <!-- Tombol Bayar Semua -->
          <div v-if="getKurirPendingFee(selectedKurir?.id) > 0" class="mb-4">
            <button
              class="w-full py-2.5 text-sm font-semibold text-white rounded-xl"
              style="background-color:#16a34a"
              @click="markAllFeePaid(selectedKurir?.id)"
            >
              Tandai Semua Lunas ({{ formatRupiah(getKurirPendingFee(selectedKurir?.id)) }})
            </button>
          </div>

          <!-- Tabel Detail -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead>
                <tr style="background-color:#f9fafb">
                  <th class="py-2 px-3 font-semibold text-gray-500 text-xs uppercase">Tanggal</th>
                  <th class="py-2 px-3 font-semibold text-gray-500 text-xs uppercase">Member</th>
                  <th class="py-2 px-3 font-semibold text-gray-500 text-xs uppercase">Volume</th>
                  <th class="py-2 px-3 font-semibold text-gray-500 text-xs uppercase">Jarak</th>
                  <th class="py-2 px-3 font-semibold text-gray-500 text-xs uppercase">Jasa/L</th>
                  <th class="py-2 px-3 font-semibold text-gray-500 text-xs uppercase">Total</th>
                  <th class="py-2 px-3 font-semibold text-gray-500 text-xs uppercase">Status</th>
                  <th class="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!kurirFeeDetail.length">
                  <td colspan="8" class="py-8 text-center text-gray-400">Belum ada data jasa</td>
                </tr>
                <tr v-for="f in kurirFeeDetail" :key="f.id" class="border-t border-gray-50 hover:bg-gray-50">
                  <td class="py-2 px-3 text-xs" style="color:#6b7280">
                    {{ formatDate(f.pickup_reports?.pickup_schedules?.scheduled_date) }}
                  </td>
                  <td class="py-2 px-3 font-medium" style="color:#1f2937">{{ f.members?.full_name }}</td>
                  <td class="py-2 px-3" style="color:#374151">{{ f.volume_liter }} L</td>
                  <td class="py-2 px-3 text-xs" style="color:#374151">
                    {{ f.distance_km ? f.distance_km + ' km' : '—' }}
                  </td>
                  <td class="py-2 px-3">
                    <div class="text-xs">
                      <span style="color:#374151">Rp{{ f.base_fee_per_liter }}/L</span>
                      <span v-if="f.bonus_per_liter > 0" style="color:#16a34a" class="ml-1">+Rp{{ f.bonus_per_liter }}</span>
                    </div>
                  </td>
                  <td class="py-2 px-3 font-bold" style="color:#16a34a">{{ formatRupiah(f.total_fee) }}</td>
                  <td class="py-2 px-3">
                    <span class="text-xs font-medium px-2 py-1 rounded-lg"
                      :style="f.status === 'paid' ? 'background:#f0fdf4;color:#16a34a' : 'background:#fff7ed;color:#ea580c'"
                    >
                      {{ f.status === 'paid' ? 'Lunas' : 'Pending' }}
                    </span>
                  </td>
                  <td class="py-2 px-3">
                    <button
                      v-if="f.status === 'pending'"
                      class="text-xs font-medium px-2 py-1 rounded-lg"
                      style="background:#f0fdf4;color:#16a34a"
                      @click="markFeePaid(f.id)"
                    >
                      Bayar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Tambah Kurir -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Tambah Kurir</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap <span class="text-red-500">*</span></label>
            <input v-model="form.full_name" type="text" placeholder="Nama kurir" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Email <span class="text-red-500">*</span></label>
            <input v-model="form.email" type="email" placeholder="email@example.com" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Password <span class="text-red-500">*</span></label>
            <div class="relative">
              <input v-model="form.password" :type="showPassword ? 'text' : 'password'" placeholder="Min. 6 karakter" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 pr-10" />
              <button class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" @click="showPassword = !showPassword">
                <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nomor HP</label>
            <input v-model="form.phone" type="text" placeholder="08xxxxxxxxxx" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div v-if="errorMsg" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{{ errorMsg }}</div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium" @click="showModal = false">Batal</button>
          <button :disabled="loading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#16a34a" @click="tambahKurir">
            {{ loading ? 'Membuat Akun...' : 'Buat Akun Kurir' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Hapus -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div class="px-6 py-5 text-center">
          <div class="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Hapus Kurir?</h3>
          <p class="text-sm text-gray-500">Akun <strong>{{ deleteTarget?.full_name }}</strong> akan dihapus permanen.</p>
        </div>
        <div class="px-6 pb-5 flex gap-3">
          <button class="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors" @click="showDeleteModal = false">Batal</button>
          <button class="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors" @click="confirmDelete">Hapus</button>
        </div>
      </div>
    </div>

  </div>
</template>
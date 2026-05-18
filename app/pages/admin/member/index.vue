<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()

const { data: members, refresh } = await useAsyncData('members', async () => {
  const { data } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
})

const totalAktif = computed(() => members.value?.filter(m => m.is_active).length ?? 0)
const totalNonaktif = computed(() => members.value?.filter(m => !m.is_active).length ?? 0)

// Modal Tambah
const showModal = ref(false)
const modalLoading = ref(false)
const modalError = ref('')
const form = reactive({
  full_name: '', phone: '', address: '',
  notes: '', distance_km: '',
  location_lat: '', location_lng: ''
})

async function submitMember() {
  if (!form.full_name) { modalError.value = 'Nama wajib diisi'; return }
  modalLoading.value = true; modalError.value = ''
  const { error } = await supabase.from('members').insert({
    full_name: form.full_name,
    phone: form.phone || null,
    address: form.address || null,
    notes: form.notes || null,
    distance_km: form.distance_km ? Number(form.distance_km) : null,
    location_lat: form.location_lat ? Number(form.location_lat) : null,
    location_lng: form.location_lng ? Number(form.location_lng) : null,
  })
  if (error) { modalError.value = 'Gagal menyimpan'; modalLoading.value = false; return }
  showModal.value = false
  Object.assign(form, { full_name: '', phone: '', address: '', notes: '', distance_km: '', location_lat: '', location_lng: '' })
  modalLoading.value = false
  refresh()
}

// Modal Edit
const showEditModal = ref(false)
const editForm = reactive({
  id: '', full_name: '', phone: '', address: '',
  notes: '', is_active: true, distance_km: '',
  location_lat: '', location_lng: ''
})

function openEdit(m: any) {
  Object.assign(editForm, {
    id: m.id, full_name: m.full_name, phone: m.phone ?? '',
    address: m.address ?? '', notes: m.notes ?? '',
    is_active: m.is_active,
    distance_km: m.distance_km ?? '',
    location_lat: m.location_lat ?? '',
    location_lng: m.location_lng ?? '',
  })
  showEditModal.value = true
}

async function submitEdit() {
  modalLoading.value = true
  await supabase.from('members').update({
    full_name: editForm.full_name,
    phone: editForm.phone || null,
    address: editForm.address || null,
    notes: editForm.notes || null,
    is_active: editForm.is_active,
    distance_km: editForm.distance_km ? Number(editForm.distance_km) : null,
    location_lat: editForm.location_lat ? Number(editForm.location_lat) : null,
    location_lng: editForm.location_lng ? Number(editForm.location_lng) : null,
    updated_at: new Date().toISOString(),
  }).eq('id', editForm.id)
  showEditModal.value = false; modalLoading.value = false; refresh()
}

// Hapus
const showDeleteModal = ref(false)
const deleteTarget = ref<any>(null)
function openDelete(m: any) { deleteTarget.value = m; showDeleteModal.value = true }
async function confirmDelete() {
  await supabase.from('members').delete().eq('id', deleteTarget.value.id)
  showDeleteModal.value = false; refresh()
}

// Detail
const showDetailModal = ref(false)
const detailMember = ref<any>(null)
const detailHistory = ref<any[]>([])
const detailPrice = ref<any>(null)

async function openDetail(m: any) {
  detailMember.value = m
  showDetailModal.value = true
  const { data: history } = await supabase
    .from('pickup_reports')
    .select('id, actual_volume_liter, total_paid, status, submitted_at, pickup_schedules(scheduled_date)')
    .eq('member_id', m.id)
    .order('submitted_at', { ascending: false })
    .limit(5)
  detailHistory.value = history ?? []

  const { data: price } = await supabase
    .from('buy_price_configs')
    .select('price_per_liter, effective_date, min_volume, max_volume')
    .eq('member_id', m.id)
    .order('effective_date', { ascending: false })
  detailPrice.value = price ?? []
}

// Peta
const showMapModal = ref(false)
const mapMembers = computed(() =>
  members.value?.filter(m => m.location_lat && m.location_lng) ?? []
)

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const totalVolumeMember = computed(() =>
  detailHistory.value.filter(h => h.status === 'approved').reduce((a, b) => a + Number(b.actual_volume_liter), 0)
)

function bonusLabel(distance_km: number | null) {
  if (!distance_km) return 'Belum diset'
  if (distance_km < 7) return 'Tidak ada bonus'
  if (distance_km < 12) return '+Rp100/L'
  if (distance_km < 20) return '+Rp200/L'
  return '+Rp200/L'
}

// Inisialisasi peta Leaflet saat modal dibuka
watch(showMapModal, async (val) => {
  if (!val || !mapMembers.value.length) return
  await nextTick()

  // Tunggu Leaflet ready
  await new Promise(resolve => setTimeout(resolve, 100))

  const L = (window as any).L
  if (!L) return

  const existingMap = (window as any)._memberMap
  if (existingMap) existingMap.remove()

  const center = [mapMembers.value[0].location_lat, mapMembers.value[0].location_lng]
  const map = L.map('member-map').setView(center, 13)
  ;(window as any)._memberMap = map

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  const icon = L.divIcon({
    html: `<div style="background:#16a34a;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    className: ''
  })

  mapMembers.value.forEach(m => {
    L.marker([m.location_lat, m.location_lng], { icon })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:sans-serif;min-width:150px">
          <p style="font-weight:600;margin:0 0 4px">${m.full_name}</p>
          <p style="color:#6b7280;font-size:12px;margin:0">${m.address ?? ''}</p>
          <p style="color:#16a34a;font-size:12px;margin:4px 0 0;font-weight:600">${m.distance_km ? m.distance_km + ' km dari gudang' : ''}</p>
        </div>
      `)
  })

  if (mapMembers.value.length > 1) {
    const bounds = L.latLngBounds(mapMembers.value.map((m: any) => [m.location_lat, m.location_lng]))
    map.fitBounds(bounds, { padding: [30, 30] })
  }
})

</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Member</h2>
        <p class="text-gray-400 text-sm mt-0.5">Daftar sumber jelantah</p>
      </div>
      <div class="flex gap-2">
        <button
          class="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          style="color:#374151"
          @click="showMapModal = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Lihat Peta
        </button>
        <button
          class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-all"
          style="background-color:#16a34a"
          @click="showModal = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Tambah Member
        </button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Total Member</p>
        <p class="text-3xl font-bold text-gray-800">{{ members?.length ?? 0 }}</p>
        <p class="text-xs text-gray-400 mt-1">Terdaftar</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Aktif</p>
        <p class="text-3xl font-bold" style="color:#16a34a">{{ totalAktif }}</p>
        <p class="text-xs text-gray-400 mt-1">Member aktif</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Nonaktif</p>
        <p class="text-3xl font-bold text-gray-400">{{ totalNonaktif }}</p>
        <p class="text-xs text-gray-400 mt-1">Member nonaktif</p>
      </div>
    </div>

    <!-- Tabel -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table class="w-full text-sm text-left">
        <thead>
          <tr style="background-color:#f9fafb">
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nama</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Telepon</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Alamat</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Jarak</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Bonus Kurir</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
            <th class="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!members?.length">
            <td colspan="7" class="py-12 text-center text-gray-400">Belum ada member</td>
          </tr>
          <tr
            v-for="m in members"
            :key="m.id"
            class="border-t border-gray-50 hover:bg-gray-50 transition-colors"
          >
            <td class="py-3 px-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style="background-color:#16a34a">
                  {{ m.full_name.charAt(0) }}
                </div>
                <span class="font-medium" style="color:#1f2937">{{ m.full_name }}</span>
              </div>
            </td>
            <td class="py-3 px-4" style="color:#374151">{{ m.phone ?? '—' }}</td>
            <td class="py-3 px-4 max-w-xs truncate" style="color:#374151">{{ m.address ?? '—' }}</td>
            <td class="py-3 px-4" style="color:#374151">
              {{ m.distance_km ? m.distance_km + ' km' : '—' }}
            </td>
            <td class="py-3 px-4">
              <span class="text-xs font-medium px-2 py-1 rounded-lg"
                :style="!m.distance_km ? 'background:#f9fafb;color:#9ca3af' :
                  m.distance_km < 7 ? 'background:#f9fafb;color:#9ca3af' :
                  m.distance_km < 12 ? 'background:#fffbeb;color:#d97706' :
                  'background:#f0fdf4;color:#16a34a'"
              >
                {{ bonusLabel(m.distance_km) }}
              </span>
            </td>
            <td class="py-3 px-4">
              <span class="text-xs font-medium px-2.5 py-1 rounded-lg"
                :style="m.is_active ? 'background:#f0fdf4;color:#16a34a' : 'background:#f9fafb;color:#9ca3af'"
              >
                {{ m.is_active ? 'Aktif' : 'Nonaktif' }}
              </span>
            </td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-1 justify-end">
                <button class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors" title="Detail" @click="openDetail(m)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
                <button class="p-1.5 rounded-lg hover:bg-amber-50 text-gray-300 hover:text-amber-500 transition-colors" title="Edit" @click="openEdit(m)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button class="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" title="Hapus" @click="openDelete(m)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Tambah -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-screen overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 class="text-lg font-bold text-gray-800">Tambah Member</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap <span class="text-red-500">*</span></label>
            <input v-model="form.full_name" type="text" placeholder="Nama member/usaha" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nomor Telepon</label>
            <input v-model="form.phone" type="text" placeholder="08xxxxxxxxxx" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
            <textarea v-model="form.address" rows="2" placeholder="Alamat lengkap titik pickup" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>

          <!-- Jarak & Koordinat -->
          <div class="bg-gray-50 rounded-xl p-4 space-y-3">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lokasi & Jarak</p>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Jarak dari Gudang (km)
                <span class="text-xs text-gray-400 font-normal ml-1">— menentukan bonus kurir</span>
              </label>
              <input v-model="form.distance_km" type="number" step="0.1" placeholder="Contoh: 3.5" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div v-if="form.distance_km" class="mt-1.5 text-xs font-medium"
                :style="Number(form.distance_km) < 5 ? 'color:#9ca3af' : Number(form.distance_km) < 12 ? 'color:#d97706' : 'color:#16a34a'"
              >
                {{ Number(form.distance_km) < 5 ? 'Tidak ada bonus kurir' : Number(form.distance_km) < 12 ? 'Bonus kurir +Rp100/L' : 'Bonus kurir +Rp200/L' }}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Latitude</label>
                <input v-model="form.location_lat" type="text" placeholder="-0.8917" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Longitude</label>
                <input v-model="form.location_lng" type="text" placeholder="119.8707" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <p class="text-xs text-gray-400">💡 Koordinat bisa dicopy dari Google Maps (klik kanan → Salin koordinat)</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea v-model="form.notes" rows="2" placeholder="Jam tersedia, akses lokasi, dll" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>
          <div v-if="modalError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{{ modalError }}</div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
          <button class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium" @click="showModal = false">Batal</button>
          <button :disabled="modalLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#16a34a" @click="submitMember">
            {{ modalLoading ? 'Menyimpan...' : 'Simpan Member' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Edit -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-screen overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 class="text-lg font-bold text-gray-800">Edit Member</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showEditModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap</label>
            <input v-model="editForm.full_name" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nomor Telepon</label>
            <input v-model="editForm.phone" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
            <textarea v-model="editForm.address" rows="2" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>

          <!-- Jarak & Koordinat -->
          <div class="bg-gray-50 rounded-xl p-4 space-y-3">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lokasi & Jarak</p>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Jarak dari Gudang (km)</label>
              <input v-model="editForm.distance_km" type="number" step="0.1" placeholder="Contoh: 3.5" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div v-if="editForm.distance_km" class="mt-1.5 text-xs font-medium"
                :style="Number(editForm.distance_km) < 5 ? 'color:#9ca3af' : Number(editForm.distance_km) < 12 ? 'color:#d97706' : 'color:#16a34a'"
              >
                {{ Number(editForm.distance_km) < 5 ? 'Tidak ada bonus kurir' : Number(editForm.distance_km) < 12 ? 'Bonus kurir +Rp100/L' : 'Bonus kurir +Rp200/L' }}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Latitude</label>
                <input v-model="editForm.location_lat" type="text" placeholder="-0.8917" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Longitude</label>
                <input v-model="editForm.location_lng" type="text" placeholder="119.8707" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <p class="text-xs text-gray-400">💡 Copy dari Google Maps: klik kanan → Salin koordinat</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea v-model="editForm.notes" rows="2" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
              :style="editForm.is_active ? 'background-color:#16a34a' : 'background-color:#e5e7eb'"
              @click="editForm.is_active = !editForm.is_active"
            >
              <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" :style="editForm.is_active ? 'transform:translateX(20px)' : 'transform:translateX(2px)'" />
            </button>
            <span class="text-sm font-medium" style="color:#374151">{{ editForm.is_active ? 'Aktif' : 'Nonaktif' }}</span>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
          <button class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium" @click="showEditModal = false">Batal</button>
          <button :disabled="modalLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#d97706" @click="submitEdit">
            {{ modalLoading ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Detail -->
    <div v-if="showDetailModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-screen overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white" style="background-color:#16a34a">
              {{ detailMember?.full_name?.charAt(0) }}
            </div>
            <div>
              <h3 class="text-lg font-bold text-gray-800">{{ detailMember?.full_name }}</h3>
              <p class="text-xs text-gray-400">{{ detailMember?.phone ?? 'No telepon tidak ada' }}</p>
            </div>
          </div>
          <button class="text-gray-400 hover:text-gray-600" @click="showDetailModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400 mb-1">Alamat</p>
              <p class="text-sm font-medium text-gray-800">{{ detailMember?.address ?? '—' }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400 mb-1">Jarak dari Gudang</p>
              <p class="text-sm font-bold text-gray-800">{{ detailMember?.distance_km ? detailMember.distance_km + ' km' : '—' }}</p>
              <p class="text-xs mt-0.5" :style="!detailMember?.distance_km || detailMember.distance_km < 7 ? 'color:#9ca3af' : detailMember.distance_km < 12 ? 'color:#d97706' : 'color:#16a34a'">
                {{ bonusLabel(detailMember?.distance_km) }}
              </p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400 mb-1">Total Pickup</p>
              <p class="text-sm font-bold text-gray-800">{{ detailHistory.length }}x</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400 mb-1">Total Volume</p>
              <p class="text-sm font-bold" style="color:#16a34a">{{ totalVolumeMember.toFixed(1) }} L</p>
            </div>
          </div>

          <!-- Harga per Tier -->
          <div>
            <p class="text-sm font-semibold text-gray-700 mb-2">Harga Beli Aktif</p>
            <div v-if="!detailPrice?.length" class="text-sm text-gray-400">Belum ada harga yang diset</div>
            <div v-else class="space-y-2">
              <div v-for="p in detailPrice" :key="p.id" class="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <span class="text-xs text-gray-400">
                    {{ p.min_volume ?? 0 }}L
                    {{ p.max_volume ? '— ' + p.max_volume + 'L' : '— ke atas' }}
                  </span>
                </div>
                <span class="text-sm font-bold" style="color:#16a34a">{{ formatRupiah(p.price_per_liter) }}/L</span>
              </div>
            </div>
          </div>

          <!-- Riwayat -->
          <div>
            <p class="text-sm font-semibold text-gray-700 mb-2">Riwayat Pickup Terakhir</p>
            <div v-if="!detailHistory.length" class="text-center py-4 text-sm text-gray-400">Belum ada riwayat</div>
            <div v-else class="space-y-2">
              <div v-for="h in detailHistory" :key="h.id" class="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p class="text-sm font-medium text-gray-800">{{ formatDate(h.pickup_schedules?.scheduled_date) }}</p>
                  <p class="text-xs text-gray-400">{{ h.actual_volume_liter }} L · {{ formatRupiah(h.total_paid) }}</p>
                </div>
                <span class="text-xs font-medium px-2 py-1 rounded-lg"
                  :style="h.status === 'approved' ? 'background:#f0fdf4;color:#16a34a' : h.status === 'rejected' ? 'background:#fef2f2;color:#dc2626' : 'background:#fffbeb;color:#d97706'"
                >
                  {{ h.status === 'approved' ? 'Disetujui' : h.status === 'rejected' ? 'Ditolak' : 'Pending' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end sticky bottom-0 bg-white">
          <button class="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors" @click="showDetailModal = false">Tutup</button>
        </div>
      </div>
    </div>

    <!-- Modal Peta Leaflet -->
    <div v-if="showMapModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Peta Lokasi Member</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showMapModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="p-4">
          <div v-if="!mapMembers.length" class="py-12 text-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <p class="font-medium">Belum ada member dengan koordinat</p>
            <p class="text-sm mt-1">Tambahkan koordinat saat edit member</p>
          </div>
          <div v-else>
            <!-- Leaflet Map -->
            <div id="member-map" style="height:400px;border-radius:12px;overflow:hidden;z-index:0"></div>
            <div class="mt-3 flex flex-wrap gap-2">
              <div v-for="m in mapMembers" :key="m.id" class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                <div class="w-2 h-2 rounded-full" style="background-color:#16a34a"></div>
                <span class="text-xs font-medium text-gray-700">{{ m.full_name }}</span>
                <span class="text-xs text-gray-400">{{ m.distance_km ? m.distance_km + 'km' : '—' }}</span>
              </div>
            </div>
          </div>
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
          <h3 class="text-lg font-bold text-gray-800 mb-1">Hapus Member?</h3>
          <p class="text-sm text-gray-500"><strong>{{ deleteTarget?.full_name }}</strong> akan dihapus permanen.</p>
        </div>
        <div class="px-6 pb-5 flex gap-3">
          <button class="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors" @click="showDeleteModal = false">Batal</button>
          <button class="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors" @click="confirmDelete">Hapus</button>
        </div>
      </div>
    </div>

  </div>
</template>
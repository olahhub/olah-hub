<script setup lang="ts">
definePageMeta({ layout: 'lapangan' })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

// Harga beli aktif (ambil dari jadwal yang di-claim kurir ini)
const { data: claimedSchedules } = await useAsyncData('claimed-schedules', async () => {
  if (!user) return []
  const { data } = await supabase
    .from('pickup_schedules')
    .select('*, members(full_name, address, location_lat, location_lng, distance_km)')
    .eq('kurir_id', user.id)
    .eq('status', 'claimed')
    .order('scheduled_date', { ascending: true })
  return data ?? []
})

// Total volume bulan ini
const { data: monthlyData } = await useAsyncData('monthly-volume', async () => {
  if (!user) return []
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data } = await supabase
    .from('pickup_reports')
    .select('actual_volume_liter, status')
    .eq('kurir_id', user.id)
    .eq('status', 'approved')
    .gte('submitted_at', firstDay)
  return data ?? []
})

// Open schedules
const { data: openSchedules, refresh: refreshOpen } = await useAsyncData('open-schedules', async () => {
  const { data } = await supabase
    .from('pickup_schedules')
    .select('*, members(full_name, address, location_lat, location_lng, distance_km)')
    .eq('status', 'open')
    .order('scheduled_date', { ascending: true })
  return data ?? []
})

const totalVolumeBulanIni = computed(() =>
  monthlyData.value?.reduce((a, b) => a + Number(b.actual_volume_liter), 0) ?? 0
)

function isClaimable(scheduledDate: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const pickup = new Date(scheduledDate); pickup.setHours(0,0,0,0)
  return Math.ceil((pickup.getTime() - today.getTime()) / 86400000) <= 3
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Inisialisasi mini map untuk setiap jadwal yang punya koordinat
async function initMiniMap(scheduleId: string, lat: number, lng: number, name: string) {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 200))

  const L = (window as any).L
  if (!L) return

  const mapId = `map-${scheduleId}`
  const el = document.getElementById(mapId)
  if (!el) return

  // Hapus map lama jika ada
  const existingMap = (window as any)[`_map_${scheduleId}`]
  if (existingMap) { existingMap.remove(); delete (window as any)[`_map_${scheduleId}`] }

  const map = L.map(mapId, {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
  }).setView([lat, lng], 15)

  ;(window as any)[`_map_${scheduleId}`] = map

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: ''
  }).addTo(map)

  const icon = L.divIcon({
    html: `<div style="background:#16a34a;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: ''
  })

  L.marker([lat, lng], { icon }).addTo(map)
    .bindPopup(`<b style="font-size:12px">${name}</b>`)
    .openPopup()
}

// Watch penawaran jadwal — init peta untuk yang punya koordinat
watch(openSchedules, async (schedules) => {
  if (!schedules) return
  for (const s of schedules) {
    if (s.members?.location_lat && s.members?.location_lng) {
      await initMiniMap(s.id, s.members.location_lat, s.members.location_lng, s.members.full_name)
    }
  }
}, { immediate: true })

watch(claimedSchedules, async (schedules) => {
  if (!schedules) return
  for (const s of schedules) {
    if (s.members?.location_lat && s.members?.location_lng) {
      await initMiniMap(s.id + '-claimed', s.members.location_lat, s.members.location_lng, s.members.full_name)
    }
  }
}, { immediate: true })

const claimLoading = ref<string | null>(null)
const claimError = ref('')
const cancelLoading = ref<string | null>(null)
const cancelError = ref('')

async function claimPickup(scheduleId: string) {
  claimLoading.value = scheduleId
  claimError.value = ''

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    claimError.value = 'Session habis, silakan login ulang'
    claimLoading.value = null
    return
  }

  // Cek apakah sudah 2x batalkan jadwal ini
  const { data: cancelLogs } = await supabase
    .from('pickup_claim_logs')
    .select('id')
    .eq('schedule_id', scheduleId)
    .eq('kurir_id', user.id)
    .eq('action', 'cancelled')

  if (cancelLogs && cancelLogs.length >= 2) {
    claimError.value = 'Kamu sudah 2x membatalkan jadwal ini, tidak bisa mengambil lagi'
    claimLoading.value = null
    return
  }

  const { data, error } = await supabase
    .from('pickup_schedules')
    .update({
      kurir_id: user.id,
      status: 'claimed',
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('status', 'open')
    .select()

  if (error || !data?.length) {
    claimError.value = 'Gagal mengambil. Mungkin sudah diambil kurir lain.'
  } else {
    claimError.value = ''
    await refreshNuxtData()
  }
  claimLoading.value = null
}

async function cancelClaim(scheduleId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Cek berapa kali sudah batalkan jadwal INI
  const { data: logs } = await supabase
    .from('pickup_claim_logs')
    .select('id')
    .eq('schedule_id', scheduleId)
    .eq('kurir_id', user.id)
    .eq('action', 'cancelled')

  if (logs && logs.length >= 2) {
    cancelError.value = 'Kamu sudah 2x membatalkan jadwal ini, tidak bisa batalkan lagi'
    return
  }

  cancelLoading.value = scheduleId
  cancelError.value = ''

  await supabase.from('pickup_schedules').update({
    status: 'open',
    kurir_id: null,
    claimed_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', scheduleId).eq('kurir_id', user.id)

  cancelLoading.value = null
  await refreshNuxtData()
}
</script>

<template>
  <div>
    <!-- Hero Card -->
    <div class="mx-4 mt-4 rounded-2xl p-4 text-white" style="background:linear-gradient(135deg,#16a34a,#15803d)">
      <div class="grid grid-cols-2 gap-3 mb-4">
        <!-- Total Volume -->
        <div class="bg-white bg-opacity-20 rounded-xl p-3">
          <p class="text-xs text-green-100 mb-1">Volume Bulan Ini</p>
          <p class="text-2xl font-bold">{{ totalVolumeBulanIni.toFixed(1) }}</p>
          <p class="text-xs text-green-200">Liter terkumpul</p>
        </div>
        <!-- Jadwal Aktif -->
        <div class="bg-white bg-opacity-20 rounded-xl p-3">
          <p class="text-xs text-green-100 mb-1">Jadwal Aktif</p>
          <p class="text-2xl font-bold">{{ claimedSchedules?.length ?? 0 }}</p>
          <p class="text-xs text-green-200">Siap dijemput</p>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="grid grid-cols-1 gap-0">
<!--        <NuxtLink
          to="/lapangan/jadwal"
          class="bg-white bg-opacity-20 rounded-xl py-2 px-3 flex items-center gap-2 hover:bg-opacity-30 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="text-sm font-medium">Jadwal Saya</span>
        </NuxtLink>     -->
        <NuxtLink
          to="/lapangan/riwayat"
          class="bg-white bg-opacity-20 rounded-xl py-2 px-3 flex items-center gap-2 hover:bg-opacity-30 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span class="text-sm font-medium">Riwayat</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Jadwal Saya -->
    <div class="px-4 mt-5">
      <h3 class="text-sm font-bold text-gray-700 mb-3">Jadwal Saya</h3>

      <div v-if="!claimedSchedules?.length" class="bg-white rounded-2xl p-5 text-center border border-gray-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-sm text-gray-400">Belum ada jadwal yang diambil</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="s in claimedSchedules"
          :key="s.id"
          class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <!-- Mini Map -->
          <div
            v-if="s.members?.location_lat && s.members?.location_lng"
            :id="`map-${s.id}-claimed`"
            style="height:120px;width:100%;z-index:0"
          />

          <div class="p-4">
            <div class="flex items-start justify-between mb-1">
              <p class="font-bold text-gray-800">{{ s.members?.full_name }}</p>
              <span class="text-xs px-2 py-1 rounded-lg font-medium" style="background:#fffbeb;color:#d97706">Diambil</span>
            </div>
            <p class="text-xs text-gray-400 mt-0.5 mb-2">{{ s.members?.address ?? 'Alamat tidak ada' }}</p>
            <p class="text-xs font-medium mb-3" style="color:#16a34a">
              📅 {{ formatDate(s.scheduled_date) }}
              <span v-if="s.scheduled_time">· {{ s.scheduled_time.slice(0,5) }}</span>
            </p>
            <p v-if="s.est_volume_liter" class="text-xs text-gray-500 mb-3">Est. {{ s.est_volume_liter }} L</p>

            <p v-if="cancelError" class="text-xs text-red-500 mb-2">{{ cancelError }}</p>

            <div class="grid grid-cols-2 gap-2">
              <button
                style="background-color:#16a34a;color:white;padding:10px;border-radius:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;"
                @click="navigateTo(`/lapangan/pickup/${s.id}`)"
              >
                Lapor Pickup
              </button>
              <button
                :disabled="cancelLoading === s.id"
                style="background-color:white;color:#ef4444;padding:10px;border-radius:12px;font-size:13px;font-weight:600;border:1px solid #fca5a5;cursor:pointer;"
                @click="cancelClaim(s.id)"
              >
                {{ cancelLoading === s.id ? 'Membatalkan...' : 'Batalkan' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Penawaran Jadwal -->
    <div class="px-4 mt-5 pb-4">
      <h3 class="text-sm font-bold text-gray-700 mb-3">
        Penawaran Jadwal
        <span class="text-xs font-normal text-gray-400 ml-1">({{ openSchedules?.length ?? 0 }} tersedia)</span>
      </h3>

      <div v-if="claimError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-3">{{ claimError }}</div>

      <div v-if="!openSchedules?.length" class="bg-white rounded-2xl p-5 text-center border border-gray-100">
        <p class="text-sm text-gray-400">Tidak ada penawaran saat ini</p>
      </div>

    <div v-else class="space-y-3">
      <div
        v-for="s in openSchedules"
        :key="s.id"
        class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <!-- Mini Map -->
        <div
          v-if="s.members?.location_lat && s.members?.location_lng"
          :id="`map-${s.id}`"
          style="height:140px;width:100%;z-index:0"
        />
        <div
          v-else
          class="flex items-center justify-center bg-gray-50"
          style="height:80px"
        >
          <div class="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mx-auto text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <p class="text-xs text-gray-400">Lokasi belum diset</p>
          </div>
        </div>

        <div class="p-4">
          <div class="flex items-start justify-between mb-1">
            <p class="font-bold text-gray-800">{{ s.members?.full_name }}</p>
            <span v-if="s.members?.distance_km" class="text-xs px-2 py-1 rounded-lg font-medium"
              :style="s.members.distance_km < 5 ? 'background:#f9fafb;color:#9ca3af' : s.members.distance_km < 12 ? 'background:#fffbeb;color:#d97706' : 'background:#f0fdf4;color:#16a34a'"
            >
              {{ s.members.distance_km }} km
            </span>
          </div>
          <p class="text-xs text-gray-400 mb-2">{{ s.members?.address ?? 'Alamat tidak ada' }}</p>
          <p class="text-xs font-medium mb-2" style="color:#16a34a">
            📅 {{ formatDate(s.scheduled_date) }}
            <span v-if="s.scheduled_time">· {{ s.scheduled_time.slice(0,5) }}</span>
          </p>
          <div class="flex items-center justify-between mb-3">
            <p v-if="s.est_volume_liter" class="text-xs text-gray-500">Est. {{ s.est_volume_liter }} L</p>
            <p v-if="s.members?.distance_km" class="text-xs font-medium"
              :style="s.members.distance_km < 5 ? 'color:#9ca3af' : 'color:#16a34a'"
            >
              Jasa: Rp{{ s.members.distance_km < 5 ? '500' : s.members.distance_km < 12 ? '600' : '700' }}/L
            </p>
          </div>

          <button
            v-if="isClaimable(s.scheduled_date)"
            :disabled="claimLoading === s.id"
            style="background-color:#16a34a;color:white;width:100%;padding:10px;border-radius:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;"
            @click="claimPickup(s.id)"
          >
            {{ claimLoading === s.id ? 'Mengambil...' : 'Ambil Jadwal Ini' }}
          </button>
          <div v-else class="text-center text-xs text-gray-400 bg-gray-50 py-2.5 rounded-xl">
            Belum bisa diambil (H-3)
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
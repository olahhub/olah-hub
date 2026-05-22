<script setup lang="ts">
definePageMeta({ layout: 'lapangan' })

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()

const { data: schedule } = await useAsyncData('schedule-detail', async () => {
  const { data } = await supabase
    .from('pickup_schedules')
    .select('*, members(full_name, address, location_lat, location_lng)')
    .eq('id', route.params.id)
    .eq('kurir_id', user?.id)
    .single()
  return data
})

const { data: activePrice } = await useAsyncData('active-price', async () => {
  if (!schedule.value?.member_id) return null
  const { data } = await supabase
    .from('buy_price_configs')
    .select('price_per_kg')
    .eq('member_id', schedule.value.member_id)
    .order('effective_date', { ascending: false })
    .limit(1)
    .single()
  return data
})

const form = reactive({
  actual_volume_kg: '',
  notes: '',
})

const photos = ref<File[]>([])
const photoPreview = ref<string[]>([])
const gpsCoords = ref<{ lat: number; lng: number } | null>(null)
const loading = ref(false)
const errorMsg = ref('')

const totalPaid = computed(() => {
  if (!form.actual_volume_kg || !activePrice.value) return 0
  return Number(form.actual_volume_kg) * Number(activePrice.value.price_per_kg)
})

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(amount)
}

// Ambil GPS saat halaman dibuka
onMounted(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsCoords.value = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
      },
      () => { gpsCoords.value = null }
    )
  }
})

function handlePhotoCapture(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return

  for (const file of Array.from(input.files)) {
    photos.value.push(file)
    const url = URL.createObjectURL(file)
    photoPreview.value.push(url)
  }
}

function removePhoto(index: number) {
  photos.value.splice(index, 1)
  photoPreview.value.splice(index, 1)
}

async function submit() {
  if (!form.actual_volume_kg) {
    errorMsg.value = 'Volume wajib diisi'
    return
  }
  if (photos.value.length === 0) {
    errorMsg.value = 'Minimal 1 foto bukti wajib diupload'
    return
  }
  if (!activePrice.value) {
    errorMsg.value = 'Harga beli belum diset untuk member ini. Hubungi admin.'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    // 1. Buat pickup report
    const { data: report, error: reportError } = await supabase
      .from('pickup_reports')
      .insert({
        schedule_id: route.params.id,
        kurir_id: user?.id,
        member_id: schedule.value?.member_id,
        actual_volume_kg: Number(form.actual_volume_kg),
        price_per_kg: Number(activePrice.value.price_per_kg),
        total_paid: totalPaid.value,
        kurir_lat: gpsCoords.value?.lat ?? null,
        kurir_lng: gpsCoords.value?.lng ?? null,
      })
      .select()
      .single()

    if (reportError) throw reportError

    // 2. Upload foto
    for (const photo of photos.value) {
      const ext = photo.name.split('.').pop()
      const path = `${report.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('pickup-photos')
        .upload(path, photo)

      if (uploadError) throw uploadError

      await supabase.from('pickup_photos').insert({
        report_id: report.id,
        storage_path: path,
        photo_lat: gpsCoords.value?.lat ?? null,
        photo_lng: gpsCoords.value?.lng ?? null,
        taken_at: new Date().toISOString(),
      })
    }

    // 3. Kirim notifikasi ke admin
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .in('role', ['admin', 'finance'])
      .eq('is_active', true)

    if (admins) {
      for (const admin of admins) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          type: 'report_submitted',
          message: `${schedule.value?.members?.full_name} — laporan pickup disubmit oleh kurir, menunggu review`,
          reference_id: report.id,
        })
      }
    }

    router.push('/lapangan')

  } catch (err) {
    errorMsg.value = 'Gagal submit laporan. Coba lagi.'
    console.error(err)
  }

  loading.value = false
}
</script>

<template>
  <div class="p-4 pb-8" v-if="schedule">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.back()" class="text-gray-400">
        <UIcon name="i-heroicons-arrow-left" class="text-xl" />
      </button>
      <div>
        <h2 class="text-base font-bold text-gray-800">Form Laporan Pickup</h2>
        <p class="text-xs text-gray-400">{{ schedule.members?.full_name }}</p>
      </div>
    </div>

    <!-- Info Member -->
    <div class="bg-green-50 rounded-xl p-4 mb-4 border border-green-100">
      <p class="text-sm font-semibold text-green-800">{{ schedule.members?.full_name }}</p>
      <p class="text-xs text-green-600 mt-1">{{ schedule.members?.address ?? '-' }}</p>
      <p class="text-xs text-green-600 mt-1">
        Harga beli:
        <strong>
          {{ activePrice ? formatRupiah(activePrice.price_per_kg) + '/L' : 'Belum diset' }}
        </strong>
      </p>
    </div>

    <!-- GPS Status -->
    <div class="mb-4 flex items-center gap-2 text-xs"
      :class="gpsCoords ? 'text-green-600' : 'text-yellow-600'"
    >
      <UIcon :name="gpsCoords ? 'i-heroicons-map-pin' : 'i-heroicons-exclamation-triangle'" />
      {{ gpsCoords
        ? `GPS aktif: ${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}`
        : 'GPS tidak tersedia' }}
    </div>

    <div class="space-y-4">
      <!-- Volume -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Volume Aktual (kg) <span class="text-red-500">*</span>
        </label>
        <input
          v-model="form.actual_volume_kg"
          type="number"
          step="0.1"
          placeholder="Masukkan volume dalam kg"
          class="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <!-- Kalkulasi otomatis -->
      <div v-if="totalPaid > 0" class="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <p class="text-xs text-blue-500">Total yang harus dibayar ke member</p>
        <p class="text-2xl font-bold text-blue-700">{{ formatRupiah(totalPaid) }}</p>
        <p class="text-xs text-blue-400 mt-1">
          {{ form.actual_volume_kg }} L × {{ formatRupiah(activePrice?.price_per_kg ?? 0) }}
        </p>
      </div>

      <!-- Upload Foto -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Foto Bukti <span class="text-red-500">*</span>
        </label>
        <label class="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl py-6 cursor-pointer hover:border-green-400 transition-colors">
          <UIcon name="i-heroicons-camera" class="text-3xl text-gray-400 mb-2" />
          <span class="text-sm text-gray-500">Ambil Foto</span>
          <span class="text-xs text-gray-400 mt-1">Kamera akan terbuka</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            class="hidden"
            @change="handlePhotoCapture"
          />
        </label>

        <!-- Preview Foto -->
        <div v-if="photoPreview.length" class="grid grid-cols-3 gap-2 mt-3">
          <div
            v-for="(url, i) in photoPreview"
            :key="i"
            class="relative aspect-square"
          >
            <img :src="url" class="w-full h-full object-cover rounded-lg" />
            <button
              class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              @click="removePhoto(i)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <UAlert v-if="errorMsg" color="red" variant="soft" :description="errorMsg" />

      <!-- Submit -->
      <button
        :disabled="loading"
        class="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-sm disabled:opacity-50 mt-4"
        @click="submit"
      >
        {{ loading ? 'Menyimpan...' : 'Submit Laporan' }}
      </button>
    </div>
  </div>
</template>
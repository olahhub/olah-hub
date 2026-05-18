<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const { data: report } = await useAsyncData('report', async () => {
  const { data } = await supabase
    .from('pickup_reports')
    .select(`
      *,
      members(full_name, address),
      users(full_name),
      pickup_photos(id, storage_path, photo_lat, photo_lng, taken_at),
      pickup_schedules(scheduled_date, scheduled_time, est_volume_liter)
    `)
    .eq('id', route.params.id)
    .single()
  return data
})

const rejectionNote = ref('')
const loading = ref(false)

async function approve() {
  loading.value = true
  const user = await supabase.auth.getUser()

  await supabase.from('pickup_reports').update({
    status: 'approved',
    approved_by: user.data.user?.id,
    approved_at: new Date().toISOString(),
  }).eq('id', route.params.id)

  router.push('/admin/pickup')
}

async function reject() {
  if (!rejectionNote.value) {
    alert('Isi alasan penolakan')
    return
  }
  loading.value = true

  await supabase.from('pickup_reports').update({
    status: 'rejected',
    rejection_note: rejectionNote.value,
  }).eq('id', route.params.id)

  router.push('/admin/pickup')
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

async function getPhotoUrl(path: string) {
  const { data } = await supabase.storage
    .from('pickup-photos')
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? ''
}

const photoUrls = ref<Record<string, string>>({})

onMounted(async () => {
  if (report.value?.pickup_photos) {
    for (const photo of report.value.pickup_photos) {
      photoUrls.value[photo.id] = await getPhotoUrl(photo.storage_path)
    }
  }
})
</script>

<template>
  <div v-if="report">
    <div class="flex items-center gap-3 mb-6">
      <UButton to="/admin/pickup" icon="i-heroicons-arrow-left" color="gray" variant="ghost" />
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Review Laporan Pickup</h2>
        <p class="text-sm text-gray-500 mt-1">Periksa laporan sebelum approve</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- Detail Laporan -->
      <div class="space-y-4">
        <UCard class="bg-white">
          <template #header>
            <h3 class="font-semibold text-gray-700">Detail Pickup</h3>
          </template>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">Member</span>
              <span class="font-medium">{{ report.members?.full_name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Alamat</span>
              <span class="font-medium text-right max-w-xs">{{ report.members?.address ?? '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Kurir</span>
              <span class="font-medium">{{ report.users?.full_name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Tanggal Jadwal</span>
              <span class="font-medium">{{ formatDate(report.pickup_schedules?.scheduled_date) }}</span>
            </div>
            <hr class="border-gray-100" />
            <div class="flex justify-between">
              <span class="text-gray-500">Est. Volume</span>
              <span class="font-medium">{{ report.pickup_schedules?.est_volume_liter ?? '-' }} L</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Volume Aktual</span>
              <span class="font-bold text-green-600 text-base">{{ report.actual_volume_liter }} L</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Harga per Liter</span>
              <span class="font-medium">{{ formatRupiah(report.price_per_liter) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Total Dibayar ke Member</span>
              <span class="font-bold text-red-600 text-base">{{ formatRupiah(report.total_paid) }}</span>
            </div>
            <hr class="border-gray-100" />
            <div class="flex justify-between">
              <span class="text-gray-500">Lokasi Kurir</span>
              <span class="font-medium text-xs">
                {{ report.kurir_lat ? `${report.kurir_lat}, ${report.kurir_lng}` : 'Tidak tersedia' }}
              </span>
            </div>
          </div>
        </UCard>

        <!-- Approve / Reject -->
        <UCard class="bg-white">
          <template #header>
            <h3 class="font-semibold text-gray-700">Keputusan</h3>
          </template>
          <div class="space-y-3">
            <UFormGroup label="Alasan Penolakan (jika ditolak)">
              <UTextarea
                v-model="rejectionNote"
                placeholder="Isi jika ingin menolak laporan ini..."
                rows="3"
              />
            </UFormGroup>
            <div class="flex gap-3">
              <UButton
                color="green"
                icon="i-heroicons-check"
                :loading="loading"
                @click="approve"
              >
                Approve
              </UButton>
              <UButton
                color="red"
                variant="outline"
                icon="i-heroicons-x-mark"
                :loading="loading"
                @click="reject"
              >
                Tolak
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Foto Bukti -->
      <div>
        <UCard class="bg-white">
          <template #header>
            <h3 class="font-semibold text-gray-700">
              Foto Bukti
              <span class="text-sm font-normal text-gray-400 ml-1">
                ({{ report.pickup_photos?.length ?? 0 }} foto)
              </span>
            </h3>
          </template>
          <div v-if="!report.pickup_photos?.length" class="text-center py-8 text-gray-400 text-sm">
            Tidak ada foto
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="photo in report.pickup_photos"
              :key="photo.id"
              class="rounded-lg overflow-hidden border border-gray-200"
            >
              <img
                v-if="photoUrls[photo.id]"
                :src="photoUrls[photo.id]"
                class="w-full object-cover max-h-64"
                alt="Foto bukti pickup"
              />
              <div v-else class="h-32 bg-gray-100 flex items-center justify-center">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400" />
              </div>
              <div v-if="photo.photo_lat" class="px-3 py-2 bg-gray-50 text-xs text-gray-500">
                📍 {{ photo.photo_lat }}, {{ photo.photo_lng }}
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
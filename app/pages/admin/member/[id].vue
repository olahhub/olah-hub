<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const { data: member, refresh } = await useAsyncData('member', async () => {
  const { data } = await supabase
    .from('members')
    .select('*')
    .eq('id', route.params.id)
    .single()
  return data
})

const { data: history } = await useAsyncData('member-history', async () => {
  const { data } = await supabase
    .from('pickup_reports')
    .select(`
      id, actual_volume_kg, total_paid, status, submitted_at,
      pickup_schedules(scheduled_date)
    `)
    .eq('member_id', route.params.id)
    .order('submitted_at', { ascending: false })
  return data
})

const { data: activePrice } = await useAsyncData('member-price', async () => {
  const { data } = await supabase
    .from('buy_price_configs')
    .select('price_per_kg, effective_date')
    .eq('member_id', route.params.id)
    .order('effective_date', { ascending: false })
    .limit(1)
    .single()
  return data
})

const editMode = ref(false)
const form = reactive({ ...member.value })

async function saveEdit() {
  await supabase.from('members').update({
    full_name: form.full_name,
    phone: form.phone,
    address: form.address,
    notes: form.notes,
    is_active: form.is_active,
    updated_at: new Date().toISOString()
  }).eq('id', route.params.id)
  editMode.value = false
  refresh()
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

const totalVolume = computed(() =>
  history.value?.filter(h => h.status === 'approved')
    .reduce((a, b) => a + Number(b.actual_volume_kg), 0) ?? 0
)

const historyColumns = [
  { key: 'scheduled_date', label: 'Tanggal' },
  { key: 'actual_volume_kg', label: 'Volume (L)' },
  { key: 'total_paid', label: 'Dibayar' },
  { key: 'status', label: 'Status' },
]
</script>

<template>
  <div v-if="member">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <UButton to="/admin/member" icon="i-heroicons-arrow-left" color="gray" variant="ghost" />
      <div class="flex-1">
        <h2 class="text-2xl font-bold text-gray-800">{{ member.full_name }}</h2>
        <p class="text-sm text-gray-500 mt-1">Detail & Riwayat Setor</p>
      </div>
      <UButton
        :icon="editMode ? 'i-heroicons-x-mark' : 'i-heroicons-pencil'"
        color="gray"
        variant="outline"
        @click="editMode = !editMode"
      >
        {{ editMode ? 'Batal' : 'Edit' }}
      </UButton>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Info Member -->
      <div class="lg:col-span-1 space-y-4">
        <UCard>
          <template #header>
            <h3 class="font-semibold text-gray-700">Informasi Member</h3>
          </template>

          <div v-if="!editMode" class="space-y-3 text-sm">
            <div>
              <p class="text-gray-400">Telepon</p>
              <p class="font-medium">{{ member.phone ?? '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">Alamat</p>
              <p class="font-medium">{{ member.address ?? '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">Catatan</p>
              <p class="font-medium">{{ member.notes ?? '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">Status</p>
              <UBadge :color="member.is_active ? 'green' : 'gray'" variant="soft">
                {{ member.is_active ? 'Aktif' : 'Nonaktif' }}
              </UBadge>
            </div>
            <div>
              <p class="text-gray-400">Harga Beli Aktif</p>
              <p class="font-bold text-green-600">
                {{ activePrice ? formatRupiah(activePrice.price_per_kg) + '/L' : 'Belum diset' }}
              </p>
            </div>
          </div>

          <div v-else class="space-y-3">
            <UFormGroup label="Nama">
              <UInput v-model="form.full_name" />
            </UFormGroup>
            <UFormGroup label="Telepon">
              <UInput v-model="form.phone" />
            </UFormGroup>
            <UFormGroup label="Alamat">
              <UTextarea v-model="form.address" rows="2" />
            </UFormGroup>
            <UFormGroup label="Catatan">
              <UTextarea v-model="form.notes" rows="2" />
            </UFormGroup>
            <UFormGroup label="Status">
              <UToggle v-model="form.is_active" />
              <span class="ml-2 text-sm">{{ form.is_active ? 'Aktif' : 'Nonaktif' }}</span>
            </UFormGroup>
            <UButton color="green" block @click="saveEdit">Simpan</UButton>
          </div>
        </UCard>

        <!-- Ringkasan -->
        <UCard>
          <template #header>
            <h3 class="font-semibold text-gray-700">Ringkasan</h3>
          </template>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">Total Pickup</span>
              <span class="font-bold">{{ history?.length ?? 0 }}x</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Total Volume</span>
              <span class="font-bold text-green-600">{{ totalVolume.toFixed(1) }} L</span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Riwayat Pickup -->
      <div class="lg:col-span-2">
        <UCard>
          <template #header>
            <h3 class="font-semibold text-gray-700">Riwayat Pickup</h3>
          </template>
          <UTable :rows="history ?? []" :columns="historyColumns">
            <template #scheduled_date-data="{ row }">
              {{ row.pickup_schedules?.scheduled_date
                ? formatDate(row.pickup_schedules.scheduled_date)
                : '-' }}
            </template>
            <template #actual_volume_kg-data="{ row }">
              {{ row.actual_volume_kg }} L
            </template>
            <template #total_paid-data="{ row }">
              {{ formatRupiah(row.total_paid) }}
            </template>
            <template #status-data="{ row }">
              <UBadge
                :color="row.status === 'approved' ? 'green' : row.status === 'rejected' ? 'red' : 'yellow'"
                variant="soft"
              >
                {{ row.status === 'approved' ? 'Disetujui' : row.status === 'rejected' ? 'Ditolak' : 'Pending' }}
              </UBadge>
            </template>
          </UTable>
        </UCard>
      </div>
    </div>
  </div>
</template>
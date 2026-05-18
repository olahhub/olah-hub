<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const route = useRoute()

const { data: offtaker, refresh } = await useAsyncData('offtaker', async () => {
  const { data } = await supabase
    .from('offtakers')
    .select('*')
    .eq('id', route.params.id)
    .single()
  return data
})

const { data: activePrice } = await useAsyncData('offtaker-price', async () => {
  const { data } = await supabase
    .from('sell_price_configs')
    .select('price_per_liter, effective_date')
    .eq('offtaker_id', route.params.id)
    .order('effective_date', { ascending: false })
    .limit(1)
    .single()
  return data
})

const { data: sales } = await useAsyncData('offtaker-sales', async () => {
  const { data } = await supabase
    .from('sale_transactions')
    .select('*')
    .eq('offtaker_id', route.params.id)
    .order('sale_date', { ascending: false })
  return data ?? []
})

const editMode = ref(false)
const form = reactive({ ...offtaker.value })

async function saveEdit() {
  await supabase.from('offtakers').update({
    company_name: form.company_name,
    contact_name: form.contact_name,
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
  sales.value?.reduce((a, b) => a + Number(b.volume_liter), 0) ?? 0
)

const totalPenjualan = computed(() =>
  sales.value?.reduce((a, b) => a + Number(b.total_amount), 0) ?? 0
)
</script>

<template>
  <div v-if="offtaker">
    <div class="flex items-center gap-3 mb-6">
      <UButton to="/admin/offtaker" icon="i-heroicons-arrow-left" color="gray" variant="ghost" />
      <div class="flex-1">
        <h2 class="text-2xl font-bold text-gray-800">{{ offtaker.company_name }}</h2>
        <p class="text-sm text-gray-500 mt-1">Detail & Riwayat Penjualan</p>
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
      <!-- Info -->
      <div class="space-y-4">
        <UCard class="bg-white">
          <template #header>
            <h3 class="font-semibold text-gray-700">Informasi Offtaker</h3>
          </template>

          <div v-if="!editMode" class="space-y-3 text-sm">
            <div>
              <p class="text-gray-400">Kontak</p>
              <p class="font-medium">{{ offtaker.contact_name ?? '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">Telepon</p>
              <p class="font-medium">{{ offtaker.phone ?? '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">Alamat</p>
              <p class="font-medium">{{ offtaker.address ?? '-' }}</p>
            </div>
            <div>
              <p class="text-gray-400">Status</p>
              <UBadge :color="offtaker.is_active ? 'green' : 'gray'" variant="soft">
                {{ offtaker.is_active ? 'Aktif' : 'Nonaktif' }}
              </UBadge>
            </div>
            <div>
              <p class="text-gray-400">Harga Jual Aktif</p>
              <p class="font-bold text-green-600">
                {{ activePrice ? formatRupiah(activePrice.price_per_liter) + '/L' : 'Belum diset' }}
              </p>
            </div>
          </div>

          <div v-else class="space-y-3">
            <UFormGroup label="Nama Perusahaan">
              <UInput v-model="form.company_name" />
            </UFormGroup>
            <UFormGroup label="Kontak">
              <UInput v-model="form.contact_name" />
            </UFormGroup>
            <UFormGroup label="Telepon">
              <UInput v-model="form.phone" />
            </UFormGroup>
            <UFormGroup label="Alamat">
              <UTextarea v-model="form.address" rows="2" />
            </UFormGroup>
            <UFormGroup label="Status">
              <div class="flex items-center gap-2">
                <UToggle v-model="form.is_active" />
                <span class="text-sm">{{ form.is_active ? 'Aktif' : 'Nonaktif' }}</span>
              </div>
            </UFormGroup>
            <UButton color="green" block @click="saveEdit">Simpan</UButton>
          </div>
        </UCard>

        <UCard class="bg-white">
          <template #header>
            <h3 class="font-semibold text-gray-700">Ringkasan</h3>
          </template>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">Total Transaksi</span>
              <span class="font-bold">{{ sales?.length ?? 0 }}x</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Total Volume</span>
              <span class="font-bold text-green-600">{{ totalVolume.toFixed(1) }} L</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Total Penjualan</span>
              <span class="font-bold text-green-600">{{ formatRupiah(totalPenjualan) }}</span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Riwayat Penjualan -->
      <div class="lg:col-span-2">
        <UCard class="bg-white">
          <template #header>
            <h3 class="font-semibold text-gray-700">Riwayat Penjualan</h3>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead>
                <tr class="border-b border-gray-200">
                  <th class="py-3 px-4 font-semibold text-gray-600">Tanggal</th>
                  <th class="py-3 px-4 font-semibold text-gray-600">Volume</th>
                  <th class="py-3 px-4 font-semibold text-gray-600">Total</th>
                  <th class="py-3 px-4 font-semibold text-gray-600">Pembayaran</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!sales?.length">
                  <td colspan="4" class="py-8 text-center text-gray-400">Belum ada transaksi</td>
                </tr>
                <tr
                  v-for="sale in sales"
                  :key="sale.id"
                  class="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td class="py-3 px-4 text-gray-700">{{ formatDate(sale.sale_date) }}</td>
                  <td class="py-3 px-4 text-gray-700">{{ sale.volume_liter }} L</td>
                  <td class="py-3 px-4 font-medium text-gray-800">{{ formatRupiah(sale.total_amount) }}</td>
                  <td class="py-3 px-4">
                    <UBadge :color="sale.payment_status === 'paid' ? 'green' : 'yellow'" variant="soft">
                      {{ sale.payment_status === 'paid' ? 'Lunas' : 'Belum Lunas' }}
                    </UBadge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
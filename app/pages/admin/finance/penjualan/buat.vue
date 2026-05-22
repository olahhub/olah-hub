<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const router = useRouter()

const { data: offtakers } = await useAsyncData('offtakers-sale', async () => {
  const { data } = await supabase
    .from('offtakers')
    .select('id, company_name')
    .eq('is_active', true)
  return data ?? []
})

const { data: stockData } = await useAsyncData('stock-now', async () => {
  const { data } = await supabase.from('stock_ledger').select('type, volume_kg')
  return data ?? []
})

const stokSaatIni = computed(() => {
  if (!stockData.value) return 0
  const masuk = stockData.value.filter(s => s.type === 'in').reduce((a, b) => a + Number(b.volume_kg), 0)
  const keluar = stockData.value.filter(s => s.type === 'out').reduce((a, b) => a + Number(b.volume_kg), 0)
  return masuk - keluar
})

const form = reactive({
  offtaker_id: '',
  volume_kg: '',
  price_per_kg: '',
  sale_date: new Date().toISOString().split('T')[0],
  notes: '',
})

const loading = ref(false)
const errorMsg = ref('')

const totalAmount = computed(() => {
  if (!form.volume_kg || !form.price_per_kg) return 0
  return Number(form.volume_kg) * Number(form.price_per_kg)
})

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(amount)
}

// Auto-fill harga jual aktif saat pilih offtaker
async function onOfftakerChange() {
  if (!form.offtaker_id) return
  const { data } = await supabase
    .from('sell_price_configs')
    .select('price_per_kg')
    .eq('offtaker_id', form.offtaker_id)
    .order('effective_date', { ascending: false })
    .limit(1)
    .single()
  if (data) form.price_per_kg = data.price_per_kg.toString()
}

async function submit() {
  if (!form.offtaker_id || !form.volume_kg || !form.price_per_kg) {
    errorMsg.value = 'Semua field wajib diisi'
    return
  }
  if (Number(form.volume_kg) > stokSaatIni.value) {
    errorMsg.value = `Volume melebihi stok tersedia (${stokSaatIni.value.toFixed(1)} L)`
    return
  }

  loading.value = true
  errorMsg.value = ''

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('sale_transactions').insert({
    offtaker_id: form.offtaker_id,
    volume_kg: Number(form.volume_kg),
    price_per_kg: Number(form.price_per_kg),
    total_amount: totalAmount.value,
    sale_date: form.sale_date,
    notes: form.notes || null,
    created_by: user?.id,
  })

  if (error) {
    errorMsg.value = 'Gagal menyimpan. Coba lagi.'
    loading.value = false
    return
  }

  router.push('/admin/finance')
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <UButton to="/admin/finance" icon="i-heroicons-arrow-left" color="gray" variant="ghost" />
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Catat Penjualan</h2>
        <p class="text-sm text-gray-500 mt-1">Stok tersedia: <strong>{{ stokSaatIni.toFixed(1) }} L</strong></p>
      </div>
    </div>

    <UCard class="max-w-xl bg-white">
      <div class="space-y-4">
        <UFormGroup label="Offtaker" required>
          <select
            v-model="form.offtaker_id"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            @change="onOfftakerChange"
          >
            <option value="">Pilih offtaker</option>
            <option v-for="o in offtakers" :key="o.id" :value="o.id">
              {{ o.company_name }}
            </option>
          </select>
        </UFormGroup>

        <UFormGroup label="Volume (kg)" required>
          <UInput v-model="form.volume_kg" type="number" step="0.1" placeholder="0" />
        </UFormGroup>

        <UFormGroup label="Harga per kg (Rp)" required>
          <UInput v-model="form.price_per_kg" type="number" placeholder="0" />
        </UFormGroup>

        <div v-if="totalAmount > 0" class="bg-green-50 rounded-xl p-4 border border-green-100">
          <p class="text-xs text-green-500">Total Penjualan</p>
          <p class="text-2xl font-bold text-green-700">{{ formatRupiah(totalAmount) }}</p>
        </div>

        <UFormGroup label="Tanggal Penjualan" required>
          <UInput v-model="form.sale_date" type="date" />
        </UFormGroup>

        <UFormGroup label="Catatan">
          <UTextarea v-model="form.notes" placeholder="Opsional" rows="2" />
        </UFormGroup>

        <UAlert v-if="errorMsg" color="red" variant="soft" :description="errorMsg" />

        <div class="flex gap-3 pt-2">
          <UButton color="green" :loading="loading" @click="submit">Simpan Penjualan</UButton>
          <UButton to="/admin/finance" color="gray" variant="ghost">Batal</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
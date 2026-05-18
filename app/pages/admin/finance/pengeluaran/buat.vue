<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const router = useRouter()

const form = reactive({
  category: 'fuel',
  amount: '',
  expense_date: new Date().toISOString().split('T')[0],
  description: '',
})

const loading = ref(false)
const errorMsg = ref('')

const categories = [
  { value: 'fuel', label: 'Bensin' },
  { value: 'maintenance', label: 'Perawatan Kendaraan' },
  { value: 'office', label: 'ATK / Kantor' },
  { value: 'other', label: 'Lain-lain' },
]

async function submit() {
  if (!form.amount || !form.description) {
    errorMsg.value = 'Jumlah dan keterangan wajib diisi'
    return
  }

  loading.value = true
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('operational_expenses').insert({
    category: form.category,
    amount: Number(form.amount),
    expense_date: form.expense_date,
    description: form.description,
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
        <h2 class="text-2xl font-bold text-gray-800">Catat Pengeluaran</h2>
        <p class="text-sm text-gray-500 mt-1">Pengeluaran operasional</p>
      </div>
    </div>

    <UCard class="max-w-xl bg-white">
      <div class="space-y-4">
        <UFormGroup label="Kategori" required>
          <select
            v-model="form.category"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option v-for="c in categories" :key="c.value" :value="c.value">
              {{ c.label }}
            </option>
          </select>
        </UFormGroup>

        <UFormGroup label="Jumlah (Rp)" required>
          <UInput v-model="form.amount" type="number" placeholder="0" />
        </UFormGroup>

        <UFormGroup label="Tanggal" required>
          <UInput v-model="form.expense_date" type="date" />
        </UFormGroup>

        <UFormGroup label="Keterangan" required>
          <UTextarea v-model="form.description" placeholder="Contoh: Bensin motor kurir 2L" rows="2" />
        </UFormGroup>

        <UAlert v-if="errorMsg" color="red" variant="soft" :description="errorMsg" />

        <div class="flex gap-3 pt-2">
          <UButton color="green" :loading="loading" @click="submit">Simpan Pengeluaran</UButton>
          <UButton to="/admin/finance" color="gray" variant="ghost">Batal</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const router = useRouter()

const form = reactive({
  amount: '',
  source: '',
  entry_date: new Date().toISOString().split('T')[0],
  notes: '',
})

const loading = ref(false)
const errorMsg = ref('')

async function submit() {
  if (!form.amount || !form.source) {
    errorMsg.value = 'Jumlah dan sumber modal wajib diisi'
    return
  }

  loading.value = true
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('capital_entries').insert({
    amount: Number(form.amount),
    source: form.source,
    entry_date: form.entry_date,
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
        <h2 class="text-2xl font-bold text-gray-800">Tambah Modal</h2>
        <p class="text-sm text-gray-500 mt-1">Catat penambahan modal usaha</p>
      </div>
    </div>

    <UCard class="max-w-xl bg-white">
      <div class="space-y-4">
        <UFormGroup label="Jumlah Modal (Rp)" required>
          <UInput v-model="form.amount" type="number" placeholder="0" />
        </UFormGroup>

        <UFormGroup label="Sumber Modal" required>
          <UInput v-model="form.source" placeholder="Contoh: Investor A, Pinjaman Bank, dll" />
        </UFormGroup>

        <UFormGroup label="Tanggal" required>
          <UInput v-model="form.entry_date" type="date" />
        </UFormGroup>

        <UFormGroup label="Catatan">
          <UTextarea v-model="form.notes" placeholder="Opsional" rows="2" />
        </UFormGroup>

        <UAlert v-if="errorMsg" color="red" variant="soft" :description="errorMsg" />

        <div class="flex gap-3 pt-2">
          <UButton color="green" :loading="loading" @click="submit">Simpan Modal</UButton>
          <UButton to="/admin/finance" color="gray" variant="ghost">Batal</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
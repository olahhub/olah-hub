<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const router = useRouter()

const form = reactive({
  company_name: '',
  contact_name: '',
  phone: '',
  address: '',
  notes: '',
})

const loading = ref(false)
const errorMsg = ref('')

async function submit() {
  if (!form.company_name) {
    errorMsg.value = 'Nama perusahaan wajib diisi'
    return
  }

  loading.value = true
  errorMsg.value = ''

  const { error } = await supabase.from('offtakers').insert({
    company_name: form.company_name,
    contact_name: form.contact_name || null,
    phone: form.phone || null,
    address: form.address || null,
    notes: form.notes || null,
  })

  if (error) {
    errorMsg.value = 'Gagal menyimpan. Coba lagi.'
    loading.value = false
    return
  }

  router.push('/admin/offtaker')
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <UButton to="/admin/offtaker" icon="i-heroicons-arrow-left" color="gray" variant="ghost" />
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Tambah Offtaker</h2>
        <p class="text-sm text-gray-500 mt-1">Tambah pembeli jelantah baru</p>
      </div>
    </div>

    <UCard class="max-w-xl bg-white">
      <div class="space-y-4">
        <UFormGroup label="Nama Perusahaan" required>
          <UInput v-model="form.company_name" placeholder="PT. Contoh Jaya" />
        </UFormGroup>

        <UFormGroup label="Nama Kontak">
          <UInput v-model="form.contact_name" placeholder="Nama PIC" />
        </UFormGroup>

        <UFormGroup label="Nomor Telepon">
          <UInput v-model="form.phone" placeholder="08xxxxxxxxxx" />
        </UFormGroup>

        <UFormGroup label="Alamat">
          <UTextarea v-model="form.address" placeholder="Alamat perusahaan" rows="3" />
        </UFormGroup>

        <UFormGroup label="Catatan">
          <UTextarea v-model="form.notes" placeholder="Catatan tambahan" rows="2" />
        </UFormGroup>

        <UAlert v-if="errorMsg" color="red" variant="soft" :description="errorMsg" />

        <div class="flex gap-3 pt-2">
          <UButton color="green" :loading="loading" @click="submit">
            Simpan Offtaker
          </UButton>
          <UButton to="/admin/offtaker" color="gray" variant="ghost">
            Batal
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
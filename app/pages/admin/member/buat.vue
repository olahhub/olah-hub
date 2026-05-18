<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const router = useRouter()

const form = reactive({
  full_name: '',
  phone: '',
  address: '',
  location_lat: null as number | null,
  location_lng: null as number | null,
  notes: '',
})

const loading = ref(false)
const errorMsg = ref('')

async function submit() {
  if (!form.full_name) {
    errorMsg.value = 'Nama wajib diisi'
    return
  }

  loading.value = true
  errorMsg.value = ''

  const { error } = await supabase.from('members').insert({
    full_name: form.full_name,
    phone: form.phone || null,
    address: form.address || null,
    location_lat: form.location_lat,
    location_lng: form.location_lng,
    notes: form.notes || null,
  })

  if (error) {
    errorMsg.value = 'Gagal menyimpan. Coba lagi.'
    loading.value = false
    return
  }

  router.push('/admin/member')
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <UButton
        to="/admin/member"
        icon="i-heroicons-arrow-left"
        color="gray"
        variant="ghost"
      />
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Tambah Member</h2>
        <p class="text-sm text-gray-500 mt-1">Tambah sumber jelantah baru</p>
      </div>
    </div>

    <UCard class="max-w-xl">
      <div class="space-y-4">
        <UFormGroup label="Nama Lengkap" required>
          <UInput v-model="form.full_name" placeholder="Nama member" />
        </UFormGroup>

        <UFormGroup label="Nomor Telepon">
          <UInput v-model="form.phone" placeholder="08xxxxxxxxxx" />
        </UFormGroup>

        <UFormGroup label="Alamat">
          <UTextarea v-model="form.address" placeholder="Alamat lengkap titik pickup" rows="3" />
        </UFormGroup>

        <UFormGroup label="Catatan">
          <UTextarea v-model="form.notes" placeholder="Catatan khusus (akses rumah, jam tersedia, dll)" rows="2" />
        </UFormGroup>

        <UAlert
          v-if="errorMsg"
          color="red"
          variant="soft"
          :description="errorMsg"
        />

        <div class="flex gap-3 pt-2">
          <UButton
            color="green"
            :loading="loading"
            @click="submit"
          >
            Simpan Member
          </UButton>
          <UButton
            to="/admin/member"
            color="gray"
            variant="ghost"
          >
            Batal
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
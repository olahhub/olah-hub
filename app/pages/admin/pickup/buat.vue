<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()
const router = useRouter()

const { data: members } = await useAsyncData('members-pickup', async () => {
  const { data } = await supabase
    .from('members')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')
  return data ?? []
})

const form = reactive({
  member_id: '',
  scheduled_date: new Date().toISOString().split('T')[0],
  scheduled_time: '',
  est_volume_liter: '',
  notes: '',
})

const loading = ref(false)
const errorMsg = ref('')

async function submit() {
  if (!form.member_id || !form.scheduled_date) {
    errorMsg.value = 'Member dan tanggal wajib diisi'
    return
  }

  loading.value = true
  errorMsg.value = ''

  const user = await supabase.auth.getUser()

  const { error } = await supabase.from('pickup_schedules').insert({
    member_id: form.member_id,
    scheduled_date: form.scheduled_date,
    scheduled_time: form.scheduled_time || null,
    est_volume_liter: form.est_volume_liter ? Number(form.est_volume_liter) : null,
    notes: form.notes || null,
    status: 'open',
    created_by: user.data.user?.id,
  })

  if (error) {
    errorMsg.value = 'Gagal menyimpan. Coba lagi.'
    loading.value = false
    return
  }

  router.push('/admin/pickup')
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <UButton to="/admin/pickup" icon="i-heroicons-arrow-left" color="gray" variant="ghost" />
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Buat Jadwal Pickup</h2>
        <p class="text-sm text-gray-500 mt-1">Jadwal akan tersedia untuk semua kurir</p>
      </div>
    </div>

    <UCard class="max-w-xl bg-white">
      <div class="space-y-4">
        <UFormGroup label="Member" required>
          <select
            v-model="form.member_id"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Pilih member</option>
            <option v-for="m in members" :key="m.id" :value="m.id">
              {{ m.full_name }}
            </option>
          </select>
        </UFormGroup>

        <UFormGroup label="Tanggal Pickup" required>
          <UInput v-model="form.scheduled_date" type="date" />
        </UFormGroup>

        <UFormGroup label="Jam Pickup">
          <UInput v-model="form.scheduled_time" type="time" />
        </UFormGroup>

        <UFormGroup label="Estimasi Volume (Liter)">
          <UInput v-model="form.est_volume_liter" type="number" placeholder="Contoh: 10" />
        </UFormGroup>

        <UFormGroup label="Catatan">
          <UTextarea v-model="form.notes" placeholder="Instruksi khusus untuk kurir" rows="2" />
        </UFormGroup>

        <UAlert v-if="errorMsg" color="red" variant="soft" :description="errorMsg" />

        <div class="flex gap-3 pt-2">
          <UButton color="green" :loading="loading" @click="submit">Buat Jadwal</UButton>
          <UButton to="/admin/pickup" color="gray" variant="ghost">Batal</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'lapangan' })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const { data: reports } = await useAsyncData('kurir-reports', async () => {
  if (!user) return []
  const { data } = await supabase
    .from('pickup_reports')
    .select('*, members(full_name), pickup_schedules(scheduled_date)')
    .eq('kurir_id', user.id)
    .order('submitted_at', { ascending: false })
  return data ?? []
})

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(amount)
}

const statusColor: Record<string, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
}

const statusLabel: Record<string, string> = {
  pending: 'Menunggu Review',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

const reimburseLabel: Record<string, string> = {
  pending: 'Belum Dibayar',
  approved: 'Sudah Dibayar',
  skipped: '-',
}
</script>

<template>
  <div class="p-4">
    <h2 class="text-base font-bold text-gray-800 mb-4">Riwayat Laporan</h2>

    <div v-if="!reports?.length" class="text-center py-12 text-sm text-gray-400">
      Belum ada riwayat laporan
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="r in reports"
        :key="r.id"
        class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
      >
        <div class="flex items-start justify-between mb-2">
          <p class="font-semibold text-gray-800">{{ r.members?.full_name }}</p>
          <UBadge :color="statusColor[r.status]" variant="soft" size="xs">
            {{ statusLabel[r.status] }}
          </UBadge>
        </div>
        <p class="text-xs text-gray-400 mb-2">
          {{ formatDate(r.pickup_schedules?.scheduled_date) }}
        </p>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="bg-gray-50 rounded-lg p-2">
            <p class="text-gray-400">Volume</p>
            <p class="font-bold text-gray-700">{{ r.actual_volume_liter }} L</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-2">
            <p class="text-gray-400">Dibayar ke Member</p>
            <p class="font-bold text-gray-700">{{ formatRupiah(r.total_paid) }}</p>
          </div>
        </div>
        <div v-if="r.status === 'approved'" class="mt-2">
          <p class="text-xs">
            Reimburse:
            <span
              :class="r.reimburse_status === 'approved' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'"
            >
              {{ reimburseLabel[r.reimburse_status] }}
            </span>
          </p>
        </div>
        <div v-if="r.status === 'rejected' && r.rejection_note" class="mt-2 bg-red-50 rounded-lg p-2">
          <p class="text-xs text-red-600">Alasan: {{ r.rejection_note }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
async function cancelClaim(scheduleId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: logs } = await supabase
    .from('pickup_claim_logs')
    .select('id')
    .eq('schedule_id', scheduleId)
    .eq('kurir_id', user.id)
    .eq('action', 'cancelled')

  if (logs && logs.length >= 2) {
    cancelError.value = 'Kamu sudah 2x membatalkan jadwal ini'
    return
  }

  cancelLoading.value = scheduleId
  cancelError.value = ''

  await supabase
    .from('pickup_schedules')
    .update({
      status: 'open',
      kurir_id: null,
      claimed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('kurir_id', user.id)

  cancelLoading.value = null
  refresh()
}
</script>
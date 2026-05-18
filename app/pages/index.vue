<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()

const { data: userData } = await supabase
  .from('users')
  .select('role')
  .single()

if (userData?.role === 'kurir') {
  router.push('/lapangan')
} else if (userData?.role) {
  router.push('/admin')
} else {
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <UIcon name="i-heroicons-arrow-path" class="animate-spin text-green-600 text-3xl" />
  </div>
</template>
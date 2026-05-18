export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return navigateTo('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = userData?.role

  // Kurir coba akses /admin → redirect ke /lapangan
  if (to.path.startsWith('/admin') && role === 'kurir') {
    return navigateTo('/lapangan')
  }

  // Admin/finance coba akses /lapangan → redirect ke /admin
  if (to.path.startsWith('/lapangan') && role !== 'kurir') {
    return navigateTo('/admin')
  }
})
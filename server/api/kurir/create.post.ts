import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { full_name, email, password, phone } = body

  if (!full_name || !email || !password) {
    return { success: false, error: 'Data tidak lengkap' }
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  // Buat auth user (langsung confirmed)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Gagal buat akun' }
  }

  // Insert ke public.users sebagai kurir
  const { error: userError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authData.user.id,
      full_name,
      role: 'kurir',
      phone: phone || null,
    })

  if (userError) {
    // Rollback auth user kalau insert gagal
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Gagal simpan data kurir' }
  }

  return { success: true }
})
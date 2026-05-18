import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { id, action, is_active } = body

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  if (action === 'delete') {
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)
    
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
    
    console.log('db error:', dbError)
    console.log('auth error:', authError)
    
    return { success: true }
  }

  if (action === 'toggle') {
    await supabaseAdmin
      .from('users')
      .update({ is_active })
      .eq('id', id)
    
    return { success: true }
  }

  return { success: false, error: 'Action tidak dikenal' }
})
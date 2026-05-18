<script setup lang="ts">
definePageMeta({ layout: 'lapangan' })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const { data: profile, refresh } = await useAsyncData('kurir-profile', async () => {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user?.id)
    .single()
  return data
})

const editMode = ref(false)
const form = reactive({ full_name: '', phone: '' })
const saveLoading = ref(false)
const saveMsg = ref('')

function openEdit() {
  form.full_name = profile.value?.full_name ?? ''
  form.phone = profile.value?.phone ?? ''
  editMode.value = true
}

async function saveProfile() {
  saveLoading.value = true
  saveMsg.value = ''
  await supabase.from('users').update({
    full_name: form.full_name,
    phone: form.phone || null,
    updated_at: new Date().toISOString(),
  }).eq('id', user?.id)
  editMode.value = false
  saveLoading.value = false
  saveMsg.value = 'Profil berhasil disimpan'
  refresh()
  setTimeout(() => saveMsg.value = '', 3000)
}

// Ganti password
const showPasswordForm = ref(false)
const passwordForm = reactive({ newPassword: '', confirmPassword: '' })
const passwordLoading = ref(false)
const passwordMsg = ref('')
const passwordError = ref('')

async function changePassword() {
  if (passwordForm.newPassword.length < 6) {
    passwordError.value = 'Password minimal 6 karakter'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Password tidak cocok'
    return
  }

  passwordLoading.value = true
  passwordError.value = ''

  const { error } = await supabase.auth.updateUser({
    password: passwordForm.newPassword
  })

  if (error) {
    passwordError.value = 'Gagal ganti password'
  } else {
    passwordMsg.value = 'Password berhasil diubah'
    showPasswordForm.value = false
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    setTimeout(() => passwordMsg.value = '', 3000)
  }
  passwordLoading.value = false
}

async function logout() {
  await supabase.auth.signOut()
  navigateTo('/login')
}
</script>

<template>
  <div class="p-4">
    <!-- Avatar & Nama -->
    <div class="flex flex-col items-center py-6">
      <div
        class="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white mb-3"
        style="background:linear-gradient(135deg,#16a34a,#15803d)"
      >
        {{ profile?.full_name?.charAt(0) ?? 'K' }}
      </div>
      <p class="text-xl font-bold text-gray-800">{{ profile?.full_name }}</p>
      <p class="text-sm text-gray-400 mt-0.5">{{ user?.email }}</p>
      <span class="mt-2 text-xs px-3 py-1 rounded-lg font-medium" style="background:#f0fdf4;color:#16a34a">
        Kurir Lapangan
      </span>
    </div>

    <!-- Success Messages -->
    <div v-if="saveMsg" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4 text-center">{{ saveMsg }}</div>
    <div v-if="passwordMsg" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4 text-center">{{ passwordMsg }}</div>

    <!-- Info Profil -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <p class="text-sm font-semibold text-gray-700">Informasi Akun</p>
        <button
          v-if="!editMode"
          class="text-xs font-medium px-3 py-1.5 rounded-lg"
          style="background:#f0fdf4;color:#16a34a"
          @click="openEdit"
        >
          Edit
        </button>
      </div>

      <div v-if="!editMode" class="divide-y divide-gray-50">
        <div class="px-4 py-3 flex justify-between">
          <span class="text-sm text-gray-400">Nama</span>
          <span class="text-sm font-medium text-gray-800">{{ profile?.full_name }}</span>
        </div>
        <div class="px-4 py-3 flex justify-between">
          <span class="text-sm text-gray-400">Email</span>
          <span class="text-sm font-medium text-gray-800">{{ user?.email }}</span>
        </div>
        <div class="px-4 py-3 flex justify-between">
          <span class="text-sm text-gray-400">Nomor HP</span>
          <span class="text-sm font-medium text-gray-800">{{ profile?.phone ?? '—' }}</span>
        </div>
      </div>

      <div v-else class="p-4 space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Nama Lengkap</label>
          <input v-model="form.full_name" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Nomor HP</label>
          <input v-model="form.phone" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div class="flex gap-2 pt-1">
          <button
            :disabled="saveLoading"
            style="background-color:#16a34a;color:white;padding:10px 20px;border-radius:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;flex:1"
            @click="saveProfile"
          >
            {{ saveLoading ? 'Menyimpan...' : 'Simpan' }}
          </button>
          <button
            style="background-color:#f3f4f6;color:#374151;padding:10px 20px;border-radius:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;"
            @click="editMode = false"
          >
            Batal
          </button>
        </div>
      </div>
    </div>

    <!-- Ganti Password -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      <button
        class="w-full flex items-center justify-between px-4 py-3"
        @click="showPasswordForm = !showPasswordForm"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:#f0fdf4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" style="color:#16a34a" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span class="text-sm font-medium text-gray-700">Ganti Password</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 transition-transform" :class="showPasswordForm ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div v-if="showPasswordForm" class="px-4 pb-4 space-y-3 border-t border-gray-50">
        <div class="pt-3">
          <label class="block text-xs font-medium text-gray-500 mb-1">Password Baru</label>
          <input v-model="passwordForm.newPassword" type="password" placeholder="Min. 6 karakter" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Konfirmasi Password</label>
          <input v-model="passwordForm.confirmPassword" type="password" placeholder="Ulangi password baru" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div v-if="passwordError" class="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-xl">{{ passwordError }}</div>
        <button
          :disabled="passwordLoading"
          style="background-color:#16a34a;color:white;width:100%;padding:10px;border-radius:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;"
          @click="changePassword"
        >
          {{ passwordLoading ? 'Menyimpan...' : 'Simpan Password Baru' }}
        </button>
      </div>
    </div>

    <!-- Keluar -->
    <button
      class="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
      style="background:#fef2f2;color:#dc2626"
      @click="logout"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Keluar dari Akun
    </button>
  </div>
</template>
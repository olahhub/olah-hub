<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()

// Cek role — kurir only
const { data: { user } } = await supabase.auth.getUser()
const { data: roleData } = await supabase
  .from('users')
  .select('role')
  .eq('id', user?.id)
  .single()

if (roleData?.role !== 'kurir') {
  await navigateTo('/admin')
}

const { data: userData } = await supabase
  .from('users')
  .select('full_name, role, phone')
  .eq('id', user?.id)
  .single()

const { data: notifications, refresh: refreshNotif } = await useAsyncData('kurir-notifs', async () => {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user?.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
  return data ?? []
})

const showNotif = ref(false)

async function markAllRead() {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id)
  refreshNotif()
}

async function logout() {
  await supabase.auth.signOut()
  router.push('/login')
}

function formatNotifTime(date: string) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

const route = useRoute()
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col" style="max-width:480px;margin:0 auto">

    <!-- Header -->
    <header class="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 border-b border-gray-100">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
          style="background-color:#16a34a"
        >
          {{ userData?.full_name?.charAt(0) ?? 'K' }}
        </div>
        <div>
          <p class="text-xs text-gray-400">Selamat datang,</p>
          <p class="text-sm font-bold text-gray-800">{{ userData?.full_name }}</p>
        </div>
      </div>

      <!-- Bell Notifikasi -->
      <div class="relative">
        <button
          class="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
          @click="showNotif = !showNotif"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span
            v-if="notifications?.length"
            class="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
            style="font-size:9px"
          >
            {{ notifications.length > 9 ? '9+' : notifications.length }}
          </span>
        </button>

        <!-- Dropdown Notif -->
        <div
          v-if="showNotif"
          class="absolute right-0 top-12 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-50"
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p class="text-sm font-semibold text-gray-700">Notifikasi</p>
            <button v-if="notifications?.length" class="text-xs text-green-600" @click="markAllRead">
              Tandai dibaca
            </button>
          </div>
          <div class="max-h-60 overflow-y-auto">
            <div v-if="!notifications?.length" class="py-6 text-center text-sm text-gray-400">
              Tidak ada notifikasi
            </div>
            <div
              v-for="notif in notifications"
              :key="notif.id"
              class="px-4 py-3 border-b border-gray-50 hover:bg-gray-50"
            >
              <p class="text-sm text-gray-700">{{ notif.message }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ formatNotifTime(notif.created_at) }}</p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 overflow-auto pb-20">
      <slot />
    </main>

    <!-- Bottom Navigation -->
    <nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full bg-white border-t border-gray-100 flex z-10" style="max-width:480px">
      <NuxtLink
        to="/lapangan"
        class="flex-1 flex flex-col items-center py-3 text-xs transition-colors"
        :class="route.path === '/lapangan' ? 'text-green-600' : 'text-gray-400'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Beranda
      </NuxtLink>
      <NuxtLink
        to="/lapangan/riwayat"
        class="flex-1 flex flex-col items-center py-3 text-xs transition-colors"
        :class="route.path.startsWith('/lapangan/riwayat') ? 'text-green-600' : 'text-gray-400'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Riwayat
      </NuxtLink>
      <NuxtLink
        to="/lapangan/profil"
        class="flex-1 flex flex-col items-center py-3 text-xs transition-colors"
        :class="route.path.startsWith('/lapangan/profil') ? 'text-green-600' : 'text-gray-400'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Profil
      </NuxtLink>
    </nav>
  </div>
</template>
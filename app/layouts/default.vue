<script setup lang="ts">

const supabase = useSupabaseClient()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()
const { data: userData } = await supabase
  .from('users')
  .select('full_name, role')
  .eq('id', user?.id)  // ← tambah ini
  .single()

if (roleData?.role === 'kurir') {
  await navigateTo('/lapangan')
}

// Desktop: sidebar collapse. Mobile: drawer
const sidebarOpen = ref(true)
const mobileMenuOpen = ref(false)

// Tutup drawer saat navigasi
const route = useRoute()
watch(() => route.path, () => {
  mobileMenuOpen.value = false
})

const { data: userData } = await supabase
  .from('users')
  .select('full_name, role')
  .single()

const { data: notifications, refresh: refreshNotif } = await useAsyncData('notifs', async () => {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10)
  return data ?? []
})

const showNotif = ref(false)

async function markAllRead() {
  await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
  refreshNotif()
}

onMounted(() => {
  supabase
    .channel('notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => refreshNotif())
    .subscribe()
})

const navItems = [
  { label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', to: '/admin' },
  { label: 'Pickup', icon: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2', to: '/admin/pickup' },
  { label: 'Member', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', to: '/admin/member' },
  { label: 'Kurir', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', to: '/admin/kurir' },
  { label: 'Stok Gudang', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', to: '/admin/stok' },
  { label: 'Offtaker', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', to: '/admin/offtaker' },
  { label: 'Harga', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z', to: '/admin/harga' },
  { label: 'Keuangan', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', to: '/admin/finance' },
]

async function logout() {
  await supabase.auth.signOut()
  router.push('/login')
}

function formatNotifTime(date: string) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <VitePwaManifest />
  <div class="min-h-screen flex bg-gray-50">

    <!-- Overlay mobile (klik di luar untuk tutup drawer) -->
    <Transition name="fade">
      <div
        v-if="mobileMenuOpen"
        class="fixed inset-0 bg-black/40 z-40 md:hidden"
        @click="mobileMenuOpen = false"
      />
    </Transition>

    <!-- Sidebar (desktop: static, mobile: drawer) -->
    <aside
      class="flex flex-col bg-white border-r border-gray-100 transition-all duration-300 flex-shrink-0
             fixed inset-y-0 left-0 z-50
             md:static md:z-auto md:translate-x-0"
      :class="[
        // Mobile: tampil/sembunyi via translate
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: ikut sidebarOpen
        'md:translate-x-0'
      ]"
      :style="{ width: sidebarOpen ? '240px' : '64px' }"
    >
      <!-- Logo & Toggle -->
      <div class="flex items-center justify-between px-4 py-4 border-b border-gray-100" style="min-height:64px">
        <div v-if="sidebarOpen" class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background-color:#16a34a">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-bold text-gray-800 leading-none">OlahHub</p>
            <p class="text-xs text-gray-400 leading-none mt-0.5">Jelantah</p>
          </div>
        </div>
        <div v-else class="w-7 h-7 rounded-lg flex items-center justify-center mx-auto" style="background-color:#16a34a">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <!-- Tombol tutup: desktop collapse, mobile tutup drawer -->
        <button
          v-if="sidebarOpen"
          class="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
          @click="() => { if (window.innerWidth < 768) mobileMenuOpen = false; else sidebarOpen = false }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <!-- Nav Items -->
      <nav class="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center rounded-xl transition-colors group relative"
          :class="[
            sidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center px-0 py-2.5',
            $route.path === item.to || ($route.path.startsWith(item.to) && item.to !== '/admin')
              ? 'text-green-700 font-medium'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          ]"
          :style="($route.path === item.to || ($route.path.startsWith(item.to) && item.to !== '/admin')) ? 'background-color:#f0fdf4' : ''"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            :class="sidebarOpen ? 'w-4 h-4' : 'w-5 h-5'"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
          </svg>
          <span v-if="sidebarOpen" class="text-sm truncate">{{ item.label }}</span>

          <!-- Tooltip saat collapsed (desktop only) -->
          <div
            v-if="!sidebarOpen"
            class="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 hidden md:block"
          >
            {{ item.label }}
          </div>
        </NuxtLink>
      </nav>

      <!-- Bottom: notif + user -->
      <div class="border-t border-gray-100 p-2">

        <!-- Toggle expand (saat collapsed, desktop only) -->
        <button
          v-if="!sidebarOpen"
          class="w-full hidden md:flex justify-center py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors mb-1"
          @click="sidebarOpen = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Notifikasi -->
        <div class="relative mb-1">
          <button
            class="w-full flex items-center rounded-xl hover:bg-gray-50 transition-colors py-2 relative"
            :class="sidebarOpen ? 'gap-3 px-3' : 'justify-center'"
            @click="showNotif = !showNotif"
          >
            <div class="relative flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span
                v-if="notifications?.length"
                class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold"
                style="font-size:9px"
              >
                {{ notifications.length > 9 ? '9+' : notifications.length }}
              </span>
            </div>
            <span v-if="sidebarOpen" class="text-sm text-gray-500">Notifikasi</span>
          </button>

          <!-- Dropdown Notifikasi -->
          <div
            v-if="showNotif"
            class="absolute bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50"
            :class="sidebarOpen ? 'left-0 w-72' : 'left-full ml-2 w-72'"
          >
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p class="text-sm font-semibold text-gray-700">Notifikasi</p>
              <button v-if="notifications?.length" class="text-xs text-green-600 hover:underline" @click="markAllRead">
                Tandai dibaca
              </button>
            </div>
            <div class="max-h-64 overflow-y-auto">
              <div v-if="!notifications?.length" class="py-6 text-center text-sm text-gray-400">
                Tidak ada notifikasi baru
              </div>
              <div
                v-for="notif in notifications"
                :key="notif.id"
                class="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                @click="() => { router.push('/admin/pickup'); showNotif = false; markAllRead() }"
              >
                <p class="text-sm text-gray-700">{{ notif.message }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ formatNotifTime(notif.created_at) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- User Info -->
        <div
          class="flex items-center rounded-xl py-2"
          :class="sidebarOpen ? 'gap-3 px-3' : 'justify-center'"
        >
          <div
            class="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style="background-color:#16a34a"
          >
            {{ userData?.full_name?.charAt(0) ?? 'A' }}
          </div>
          <div v-if="sidebarOpen" class="flex-1 min-w-0">
            <p class="text-xs font-medium text-gray-700 truncate">{{ userData?.full_name }}</p>
            <p class="text-xs text-gray-400 capitalize">{{ userData?.role }}</p>
          </div>
          <button
            v-if="sidebarOpen"
            class="text-gray-300 hover:text-red-400 transition-colors"
            @click="logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto min-w-0 flex flex-col">

      <!-- Mobile Header (hamburger + judul halaman) -->
      <header class="md:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 flex items-center gap-3" style="min-height:56px">
        <button
          class="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          @click="mobileMenuOpen = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md flex items-center justify-center" style="background-color:#16a34a">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <p class="text-sm font-bold text-gray-800">OlahHub</p>
        </div>

        <!-- Notif bell di mobile header -->
        <button class="ml-auto relative p-2" @click="showNotif = !showNotif">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span
            v-if="notifications?.length"
            class="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold"
            style="font-size:9px"
          >
            {{ notifications.length > 9 ? '9+' : notifications.length }}
          </span>
        </button>
      </header>

      <!-- Page Content -->
      <div class="p-4 md:p-6 flex-1">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
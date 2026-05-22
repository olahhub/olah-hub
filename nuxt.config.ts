export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxtjs/supabase',
    '@vite-pwa/nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint'
  ],

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'OlahHub',
      short_name: 'OlahHub',
      description: 'Sistem Terintegrasi Pengepul Jelantah',
      theme_color: '#16a34a',       // hijau sesuai brand OlahHub
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [
        {
          src: '/icon-192.png',     // pisah file untuk tiap ukuran
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: null,       // ← ubah dari '/' ke null, ini yg bikin halaman blank
      globPatterns: ['**/*.{js,css,html,png,svg,ico}']
    },
    devOptions: {
      enabled: false,               // ← matikan di dev, aktifkan hanya saat build
      type: 'module'
    }
  },

  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login'],
    }
  },

  colorMode: {
    preference: 'light'
  },

  css: ['~/assets/css/main.css']
})
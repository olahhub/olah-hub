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
      name: 'Olah Hub',          
      short_name: 'OlahHub',     
      description: 'Hub untuk olah data dan informasi',
      theme_color: '#ffffff',    
      background_color: '#ffffff',
      icons: [
        {
          src: 'icon.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'icon.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
    },
    devOptions: {
      enabled: true, // Supaya bisa ditest di localhost
      type: 'module'
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
  }
})
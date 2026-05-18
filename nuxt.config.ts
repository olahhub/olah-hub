export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/supabase',
    '@vueuse/nuxt',
  ],

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
  
  css: ['~/assets/css/main.css'],

  compatibilityDate: '2024-01-01',
})
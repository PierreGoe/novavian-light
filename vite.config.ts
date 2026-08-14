import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  base: '/novavian-light/', // TODO https://www.youtube.com/watch?v=U2nRRXhhrd4
  server: {
    // Autorise l'accès via le nom d'hôte local utilisé par le reverse-proxy Docker (docker-compose.yml).
    allowedHosts: ['local.novavian'],
  },
})

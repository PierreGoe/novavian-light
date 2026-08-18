import { fileURLToPath, URL } from 'node:url'
import type { StorybookConfig } from '@storybook/vue3-vite'

const config: StorybookConfig = {
  stories: ['../src/components/ui/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  viteFinal: (viteConfig) => {
    viteConfig.resolve = {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        '@': fileURLToPath(new URL('../src', import.meta.url)),
      },
    }
    // Autorise l'accès via le nom d'hôte local utilisé par le reverse-proxy Docker (docker-compose.yml).
    viteConfig.server = {
      ...viteConfig.server,
      allowedHosts: ['local.novavian'],
    }
    return viteConfig
  },
}

export default config

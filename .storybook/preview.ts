import type { Preview } from '@storybook/vue3-vite'
import '../src/styles/tokens.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'canvas',
      values: [{ name: 'canvas', value: '#1a0f08' }],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview

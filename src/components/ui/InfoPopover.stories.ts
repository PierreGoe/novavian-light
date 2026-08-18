import type { Meta, StoryObj } from '@storybook/vue3-vite'
import InfoPopover from './InfoPopover.vue'

const meta = {
  title: 'UI/InfoPopover',
  component: InfoPopover,
  tags: ['autodocs'],
} satisfies Meta<typeof InfoPopover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { InfoPopover },
    template: `
      <InfoPopover label="Aide">
        Cliquez sur une case accessible pour vous y déplacer.
      </InfoPopover>
    `,
  }),
}

export const WithList: Story = {
  render: () => ({
    components: { InfoPopover },
    template: `
      <InfoPopover label="Légende des états de bâtiment">
        <div style="display: flex; flex-direction: column; gap: 0.3rem;">
          <span>⬆️ Améliorable</span>
          <span>✨ Disponible</span>
          <span>🏗️ En chantier</span>
          <span>🔒 Verrouillé</span>
        </div>
      </InfoPopover>
    `,
  }),
}

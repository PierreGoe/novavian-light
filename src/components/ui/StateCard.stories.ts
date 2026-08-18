import type { Meta, StoryObj } from '@storybook/vue3-vite'
import StateCard from './StateCard.vue'

const meta = {
  title: 'UI/StateCard',
  component: StateCard,
  tags: ['autodocs'],
} satisfies Meta<typeof StateCard>

export default meta
type Story = StoryObj<typeof meta>

export const Locked: Story = {
  args: { state: 'locked' },
  render: (args) => ({
    components: { StateCard },
    setup: () => ({ args }),
    template:
      '<StateCard v-bind="args"><template #icon>🏰</template><strong>Forteresse</strong><div>Niveau 3 requis</div></StateCard>',
  }),
}

export const Available: Story = {
  args: { state: 'available' },
  render: (args) => ({
    components: { StateCard },
    setup: () => ({ args }),
    template:
      '<StateCard v-bind="args"><template #icon>🏗️</template><strong>Scierie</strong><div>Prête à construire</div><template #footer>🪵 120 · 🧱 60</template></StateCard>',
  }),
}

export const Active: Story = {
  args: { state: 'active' },
  render: (args) => ({
    components: { StateCard },
    setup: () => ({ args }),
    template:
      '<StateCard v-bind="args"><template #icon>⚔️</template><strong>Légionnaire</strong><div>En entraînement — 00:42</div></StateCard>',
  }),
}

export const Ready: Story = {
  args: { state: 'ready' },
  render: (args) => ({
    components: { StateCard },
    setup: () => ({ args }),
    template:
      '<StateCard v-bind="args"><template #icon>✅</template><strong>Entrepôt</strong><div>Amélioration terminée</div></StateCard>',
  }),
}

export const Warning: Story = {
  args: { state: 'warning' },
  render: (args) => ({
    components: { StateCard },
    setup: () => ({ args }),
    template:
      '<StateCard v-bind="args"><template #icon>⚠️</template><strong>Grenier</strong><div>Capacité bientôt atteinte</div></StateCard>',
  }),
}

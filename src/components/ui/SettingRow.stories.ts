import type { Meta, StoryObj } from '@storybook/vue3-vite'
import SettingRow from './SettingRow.vue'
import ToggleSwitch from './ToggleSwitch.vue'

const meta = {
  title: 'UI/SettingRow',
  component: SettingRow,
  tags: ['autodocs'],
} satisfies Meta<typeof SettingRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { SettingRow, ToggleSwitch },
    template: `
      <SettingRow>
        <template #label>Musique</template>
        <ToggleSwitch :model-value="true" label="Musique" />
      </SettingRow>
    `,
  }),
}

export const WithDescription: Story = {
  render: () => ({
    components: { SettingRow, ToggleSwitch },
    template: `
      <SettingRow>
        <template #label>Brouillard de guerre</template>
        <template #description>Masque les cases non explorées sur la carte.</template>
        <ToggleSwitch :model-value="false" label="Brouillard de guerre" />
      </SettingRow>
    `,
  }),
}

export const Disabled: Story = {
  render: () => ({
    components: { SettingRow, ToggleSwitch },
    template: `
      <SettingRow disabled>
        <template #label>Musique</template>
        <template #description>Indisponible en mode économie de batterie.</template>
        <ToggleSwitch :model-value="false" label="Musique" disabled />
      </SettingRow>
    `,
  }),
}

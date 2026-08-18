import type { Meta, StoryObj } from '@storybook/vue3-vite'
import DataTable from './DataTable.vue'

const meta = {
  title: 'UI/DataTable',
  component: DataTable,
  tags: ['autodocs'],
  args: {
    headers: ['Date', 'Événement', 'Points'],
  },
} satisfies Meta<typeof DataTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { DataTable },
    setup: () => ({ args }),
    template: `
      <DataTable v-bind="args">
        <tr>
          <td>12/03</td>
          <td>Victoire — Forêt maudite</td>
          <td>+120</td>
        </tr>
        <tr>
          <td>11/03</td>
          <td>Défaite — Ruines antiques</td>
          <td>+0</td>
        </tr>
        <tr>
          <td>10/03</td>
          <td>Victoire — Boss final</td>
          <td>+500</td>
        </tr>
      </DataTable>
    `,
  }),
}

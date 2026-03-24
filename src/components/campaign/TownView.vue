<template>
  <div class="town-view">
    <header class="town-header">
      <h2>{{ town?.name || 'Camp de Base' }}</h2>
      <div class="town-stats">
        <span class="stat">🏘️ Pop: {{ town?.population || 0 }}</span>
        <span class="stat">🏗️ Bâtiments: {{ town?.buildings?.length || 0 }}</span>
        <span class="stat">⚔️ Unités: {{ totalUnits }}</span>
      </div>
    </header>

    <BuildingsSection />
    <UnitsTrainingSection />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import BuildingsSection from './BuildingsSection.vue'
import UnitsTrainingSection from './UnitsTrainingSection.vue'

const missionStore = useMissionStore()
const town = computed(() => missionStore.town.value)
const totalUnits = computed(
  () =>
    town.value?.units?.reduce((sum: number, unit: { count: number }) => sum + unit.count, 0) || 0,
)
</script>

<style scoped>
.town-view {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
}

.town-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
}

.town-header h2 {
  margin: 0 0 0.5rem 0;
  color: #daa520;
  font-size: 1.5rem;
}

.town-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat {
  padding: 0.25rem 0.5rem;
  background: rgba(139, 69, 19, 0.2);
  border-radius: 4px;
  font-size: 0.8rem;
  border: 1px solid rgba(218, 165, 32, 0.2);
}
</style>

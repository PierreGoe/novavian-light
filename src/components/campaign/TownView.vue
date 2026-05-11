<template>
  <div class="town-view">
    <!-- En-tête minimal -->
    <header class="town-header">
      <span class="town-name">{{ town?.name || 'Camp de Base' }}</span>
      <span class="town-pop">👥 {{ town?.population || 0 }}</span>
    </header>

    <!-- Navigation par onglets -->
    <nav class="tab-nav">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.badge !== undefined && tab.badge > 0" class="tab-badge">{{
          tab.badge
        }}</span>
      </button>
    </nav>

    <!-- Contenu de l'onglet actif -->
    <div class="tab-content">
      <!-- Village -->
      <div v-if="activeTab === 'village'">
        <VillagePlanView />
      </div>

      <!-- Ressources -->
      <div v-else-if="activeTab === 'resources'" class="resources-tab">
        <div class="res-grid">
          <div class="res-row" v-for="r in RESOURCES" :key="r.key">
            <span class="res-icon">{{ r.icon }}</span>
            <span class="res-name">{{ r.label }}</span>
            <span class="res-amount">{{ Math.floor(town?.resources?.[r.key] || 0) }}</span>
            <span class="res-rate">+{{ Math.floor(town?.production?.[r.key] || 0) }}/min</span>
          </div>
        </div>

        <!-- Détails production par bâtiment -->
        <div class="prod-buildings">
          <div class="prod-title">Bâtiments producteurs</div>
          <div
            v-for="b in productionBuildings"
            :key="b.id"
            class="prod-row"
          >
            <span class="prod-icon">{{ b.icon }}</span>
            <span class="prod-name">{{ b.name }}</span>
            <span class="prod-level">niv. {{ b.level }}</span>
            <span class="prod-value">{{ b.resourceIcon }} +{{ b.production }}/min</span>
          </div>
          <div v-if="productionBuildings.length === 0" class="prod-empty">
            Aucun bâtiment de production construit.
          </div>
        </div>
      </div>

      <!-- Militaire -->
      <div v-else-if="activeTab === 'military'">
        <UnitsTrainingSection />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import { BUILDING_DEFINITIONS } from '@/data/buildings'
import type { BuildingType } from '@/data/buildings'
import VillagePlanView from './VillagePlanView.vue'
import UnitsTrainingSection from './UnitsTrainingSection.vue'

const missionStore = useMissionStore()
const town = computed(() => missionStore.town.value)

const totalUnits = computed(
  () => town.value?.units?.reduce((sum: number, u: { count: number }) => sum + u.count, 0) || 0,
)

type TabId = 'village' | 'resources' | 'military'
const activeTab = ref<TabId>('village')

const TABS = computed(() => [
  { id: 'village' as TabId, icon: '🏛️', label: 'Village', badge: undefined },
  { id: 'resources' as TabId, icon: '🌾', label: 'Ressources', badge: undefined },
  { id: 'military' as TabId, icon: '⚔️', label: 'Militaire', badge: totalUnits.value },
])

const RESOURCES = [
  { key: 'wood' as const, icon: '🪵', label: 'Bois' },
  { key: 'clay' as const, icon: '🧱', label: 'Argile' },
  { key: 'iron' as const, icon: '⚒️', label: 'Fer' },
  { key: 'crop' as const, icon: '🌾', label: 'Céréales' },
]

const RESOURCE_ICONS: Record<string, string> = {
  wood: '🪵',
  clay: '🧱',
  iron: '⚒️',
  crop: '🌾',
}

// Bâtiments qui ont une production active
const productionBuildings = computed(() => {
  return (town.value?.buildings ?? [])
    .filter((b) => BUILDING_DEFINITIONS[b.type as BuildingType]?.productionPerLevel)
    .map((b) => {
      const def = BUILDING_DEFINITIONS[b.type as BuildingType]
      const prod = def.productionPerLevel!
      return {
        id: b.id,
        icon: def.icon,
        name: def.name,
        level: b.level,
        resourceIcon: RESOURCE_ICONS[prod.resource] ?? '',
        production: prod.amount * b.level,
      }
    })
})
</script>

<style scoped>
.town-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ---- En-tête ---- */
.town-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem 0.6rem;
  border-bottom: 1px solid rgba(218, 165, 32, 0.15);
  flex-shrink: 0;
}

.town-name {
  font-size: 1rem;
  font-weight: 700;
  color: #daa520;
  letter-spacing: 0.03em;
}

.town-pop {
  font-size: 0.75rem;
  color: #6b7280;
}

/* ---- Onglets ---- */
.tab-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 0.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #6b7280;
  font-size: 0.78rem;
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s,
    background 0.2s;
  position: relative;
}

.tab-btn:hover {
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.03);
}

.tab-btn.active {
  color: #daa520;
  border-bottom-color: #daa520;
  background: rgba(218, 165, 32, 0.05);
}

.tab-icon {
  font-size: 0.9rem;
}

.tab-label {
  font-weight: 500;
}

.tab-badge {
  font-size: 0.65rem;
  padding: 0.05rem 0.35rem;
  background: rgba(218, 165, 32, 0.15);
  border: 1px solid rgba(218, 165, 32, 0.3);
  border-radius: 8px;
  color: #daa520;
  line-height: 1.4;
}

/* ---- Contenu ---- */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
}

/* ---- Onglet Ressources ---- */
.res-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1.25rem;
}

.res-row {
  display: grid;
  grid-template-columns: 1.5rem 1fr auto auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.15s;
}

.res-row:last-child {
  border-bottom: none;
}

.res-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.res-icon {
  font-size: 1rem;
  text-align: center;
}

.res-name {
  font-size: 0.8rem;
  color: #94a3b8;
}

.res-amount {
  font-size: 0.85rem;
  font-weight: 600;
  color: #f4e4bc;
  text-align: right;
  min-width: 3.5rem;
}

.res-rate {
  font-size: 0.72rem;
  color: #4ade80;
  text-align: right;
  min-width: 4rem;
}

.prod-title {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #4b5563;
  margin-bottom: 0.5rem;
}

.prod-buildings {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.prod-row {
  display: grid;
  grid-template-columns: 1.5rem 1fr auto auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.03);
}

.prod-icon {
  font-size: 0.9rem;
  text-align: center;
}

.prod-name {
  font-size: 0.78rem;
  color: #94a3b8;
}

.prod-level {
  font-size: 0.7rem;
  color: #4b5563;
}

.prod-value {
  font-size: 0.78rem;
  color: #4ade80;
  font-weight: 600;
  text-align: right;
}

.prod-empty {
  font-size: 0.78rem;
  color: #4b5563;
  font-style: italic;
  padding: 0.5rem 0.25rem;
}
</style>

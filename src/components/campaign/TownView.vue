<template>
  <div class="town-view">
    <!-- En-tête minimal -->
    <header class="town-header">
      <span class="town-name">{{ town?.name || 'Camp de Base' }}</span>
    </header>

    <!-- Navigation par onglets -->
    <SegmentedControl
      class="tab-nav"
      :options="
        TABS.map((tab) => ({
          value: tab.id,
          label: tab.label,
          icon: tab.icon,
          badge: tab.badge && tab.badge > 0 ? tab.badge : undefined,
        }))
      "
      :model-value="activeTab"
      @update:model-value="activeTab = $event as TabId"
    />

    <!-- Contenu de l'onglet actif -->
    <div class="tab-content">
      <!-- Village -->
      <div v-if="activeTab === 'village'">
        <VillagePlanView :focus-type="focusBuilding" />
      </div>

      <!-- Ressources -->
      <div v-else-if="activeTab === 'resources'" class="resources-tab">
        <div class="res-grid">
          <IconRow
            v-for="key in TRAVIAN_RESOURCE_ORDER"
            :key="key"
            class="res-row"
            :icon="TRAVIAN_RESOURCES[key].emoji"
            :label="TRAVIAN_RESOURCES[key].label"
            :title="resourceTooltip(key)"
          >
            <ResourceCounter :value="missionStore.displayResources.value[key]" />/{{
              formatNumber(capacity)
            }}
            <span class="res-rate">+{{ Math.floor(town?.production?.[key] || 0) }}/min</span>
          </IconRow>
        </div>

        <!-- Détails production par bâtiment -->
        <div class="prod-buildings">
          <SectionLabel>Bâtiments producteurs</SectionLabel>
          <IconRow
            v-for="b in productionBuildings"
            :key="b.id"
            class="prod-row prod-row--link"
            :icon="b.icon"
            :label="b.name"
            :sublabel="`niv. ${b.level}`"
            title="Voir ce bâtiment dans le plan du village"
            @click="goToBuilding(b.type)"
          >
            <span class="prod-value">{{ b.resourceIcon }} +{{ b.production }}/min</span>
          </IconRow>
          <EmptyState
            v-if="productionBuildings.length === 0"
            message="Aucun bâtiment de production construit."
          />
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMissionStore, getResourceCapacity } from '@/stores/missionStore'
import { BUILDING_DEFINITIONS, getHQLevel } from '@/data/buildings'
import type { BuildingType } from '@/data/buildings'
import { TRAVIAN_RESOURCES, TRAVIAN_RESOURCE_ORDER } from '@/data/resources'
import type { TravianResourceKey } from '@/data/resources'
import { formatNumber } from '@/utils/formatNumber'
import VillagePlanView from './VillagePlanView.vue'
import ResourceCounter from '@/components/ui/ResourceCounter.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import IconRow from '@/components/ui/IconRow.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const missionStore = useMissionStore()
const town = computed(() => missionStore.town.value)
const hqLevel = computed(() => getHQLevel(town.value?.buildings ?? []))
const capacity = computed(() => getResourceCapacity(hqLevel.value))

type TabId = 'village' | 'resources'
const activeTab = ref<TabId>('village')

// Bâtiment à mettre en avant dans le plan du village (clic sur une ligne
// « Bâtiments producteurs » de l'onglet Ressources → bascule + sélection).
// Réinitialisé en quittant l'onglet Village pour ne pas re-sélectionner le
// même bâtiment à chaque retour.
const focusBuilding = ref<BuildingType | null>(null)

const goToBuilding = (type: BuildingType) => {
  focusBuilding.value = type
  activeTab.value = 'village'
}

watch(activeTab, (tab) => {
  if (tab !== 'village') focusBuilding.value = null
})

/**
 * Tooltip d'un compteur de ressource : valeurs exactes, taux et temps estimé
 * avant stockage plein (même contenu que le header de campagne).
 */
const resourceTooltip = (key: TravianResourceKey): string => {
  const exact = Math.floor(missionStore.displayResources.value[key])
  const rate = Math.floor(town.value?.production?.[key] || 0)
  const lines = [
    `${TRAVIAN_RESOURCES[key].label} : ${exact.toLocaleString('fr-FR')} / ${capacity.value.toLocaleString('fr-FR')}`,
    `Production : +${rate}/min`,
  ]
  if (exact >= capacity.value) {
    lines.push('Stockage plein — production perdue')
  } else if (rate > 0) {
    const minUntilFull = (capacity.value - exact) / rate
    const totalSec = Math.ceil(minUntilFull * 60)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    const label = h > 0 ? `${h}h ${m}min` : m > 0 ? `${m}min ${s}s` : `${s}s`
    lines.push(`Plein dans ${label}`)
  }
  return lines.join('\n')
}

const TABS = computed(() => [
  {
    id: 'village' as TabId,
    icon: '🏛️',
    label: 'Village',
    badge: missionStore.trainingQueue.value.length,
  },
  { id: 'resources' as TabId, icon: '🌾', label: 'Ressources', badge: undefined },
])

// Bâtiments qui ont une production active
const productionBuildings = computed(() => {
  return (town.value?.buildings ?? [])
    .filter((b) => BUILDING_DEFINITIONS[b.type as BuildingType]?.productionPerLevel)
    .map((b) => {
      const def = BUILDING_DEFINITIONS[b.type as BuildingType]
      const prod = def.productionPerLevel!
      return {
        id: b.id,
        type: b.type as BuildingType,
        icon: def.icon,
        name: def.name,
        level: b.level,
        resourceIcon: TRAVIAN_RESOURCES[prod.resource]?.emoji ?? '',
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
  border-bottom: 1px solid rgba(var(--color-accent-rgb), 0.15);
  flex-shrink: 0;
}

.town-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-accent-ink);
  letter-spacing: 0.03em;
}

/* ---- Onglets ---- */
.tab-nav {
  display: flex;
  width: 100%;
  flex-shrink: 0;
  margin-bottom: 0.5rem;
}

.tab-nav :deep(.segment) {
  flex: 1;
  justify-content: center;
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
  border: 1px solid rgba(var(--overlay-rgb), 0.07);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1.25rem;
}

.res-row {
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.05);
  transition: background 0.15s;
}

.res-row:last-child {
  border-bottom: none;
}

.res-row:hover {
  background: rgba(var(--overlay-rgb), 0.03);
}

.res-rate {
  color: var(--color-success-strong);
  font-weight: 600;
  margin-left: 0.4rem;
}

.prod-buildings {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.prod-row {
  padding: 0.4rem 0.6rem;
  border-radius: 7px;
  background: rgba(var(--overlay-rgb), 0.03);
}

/* Ligne cliquable → plan du village avec le bâtiment sélectionné */
.prod-row--link {
  cursor: pointer;
  transition: background 0.15s;
}

.prod-row--link:hover {
  background: rgba(var(--color-accent-rgb), 0.08);
}

.prod-value {
  color: var(--color-success-strong);
  font-weight: 600;
}
</style>

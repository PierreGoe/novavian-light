<template>
  <div class="campaign-view" :style="{ '--timers-panel-width': timersPanelWidth }">
    <!--
      Volontairement custom, sur son propre fond sombre : c'est un scrim plein écran de
      transition entre deux missions, pensé comme un moment cinématique bref plutôt qu'un
      contenu de page — pas un candidat BaseDialog/NoticeBox.
    -->
    <Transition name="fade">
      <div v-if="missionStore.isTransitioning.value" class="transition-overlay">
        <div class="transition-content">
          <div class="spinner"></div>
          <h2>🏆 Mission Réussie !</h2>
          <p>Préparation de la prochaine mission...</p>
        </div>
      </div>
    </Transition>

    <!-- En-tête avec informations de mission -->
    <header class="campaign-header">
      <div class="campaign-info">
        <h1>{{ missionName }}</h1>
        <div class="campaign-status">
          <Badge v-if="missionDifficulty" :tone="DIFFICULTY_TONES[missionDifficulty]">
            {{ missionDifficulty.toUpperCase() }}
          </Badge>
        </div>
      </div>
      <!-- Ressources Travian -->
      <div class="resources-display">
        <div class="resource-group">
          <div
            v-for="key in TRAVIAN_RESOURCE_ORDER"
            :key="key"
            class="resource-item"
            :class="{ 'resource-item--full': isResourceFull(key) }"
            :aria-label="TRAVIAN_RESOURCES[key].label"
            :title="resourceTooltip(key)"
          >
            <span class="resource-icon" aria-hidden="true">{{
              TRAVIAN_RESOURCES[key].emoji
            }}</span>
            <span class="resource-values">
              <ResourceCounter
                class="resource-amount"
                :value="missionStore.displayResources.value[key]"
              />
              <span class="resource-cap">/{{ formatNumber(capacity) }}</span>
            </span>
            <span class="resource-production"
              >+{{ Math.floor(town?.production?.[key] || 0) }}/min</span
            >
          </div>
        </div>

        <!-- Séparateur : ressources de ville (production locale) vs méta-ressources
             (comptes joueur, transversaux à toute la campagne) -->
        <div class="resource-divider" role="separator" aria-orientation="vertical"></div>

        <div class="resource-group">
          <div
            class="resource-item resource-item--link"
            role="button"
            tabindex="0"
            :aria-label="PLAYER_RESOURCES.mapFragment.label"
            title="Fragments de carte — révèlent un cadran verrouillé sur la carte (cliquer pour y aller)"
            @click="router.push({ name: 'campaign-map' })"
            @keydown.enter="router.push({ name: 'campaign-map' })"
          >
            <span class="resource-icon" aria-hidden="true">{{
              PLAYER_RESOURCES.mapFragment.emoji
            }}</span>
            <span class="resource-values">
              <ResourceCounter
                class="resource-amount"
                :value="gameStore.gameState.inventory.mapFragments"
              />
            </span>
          </div>
          <div class="resource-item" aria-label="Troupes disponibles" :title="unitsTooltip">
            <span class="resource-icon" aria-hidden="true">⚔️</span>
            <span class="resource-values">
              <ResourceCounter class="resource-amount" :value="totalUnits" />
            </span>
          </div>
        </div>
      </div>

      <div class="header-actions">
        <ThreatIndicator />
        <VictoryPointsDisplay />
        <div class="time-display">
          <span class="time-item" title="Temps de mission (plafonne à 2h en offline)">
            ⏱️ {{ formattedGameTime }}
          </span>
          <span class="time-separator">|</span>
          <span class="time-item time-real" title="Heure réelle"> 🕒 {{ formattedRealTime }} </span>
        </div>
        <Button variant="secondary" @click="exitCampaign">🏠 Retour aux missions</Button>
      </div>
    </header>

    <!-- Zone principale : sous-vue Village ou Carte (routée) -->
    <main class="campaign-content">
      <div class="campaign-router-view">
        <router-view />
      </div>
    </main>

    <!-- Panneau de timers — sidebar fixe côté droit, symétrique à SideNavBar -->
    <TimersPanel />

    <!-- Rapport de combat (overlay) — vit ici pour s'ouvrir peu importe la sous-vue active -->
    <CombatReportOverlay :report="combatReport" @close="combatReport = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMissionStore, getResourceCapacity, UNIT_DEFINITIONS } from '@/stores/missionStore'
import { useMapStore } from '@/stores/mapStore'
import { useGameStore } from '@/stores/gameStore'
import { getHQLevel } from '@/data/buildings'
import { TRAVIAN_RESOURCES, TRAVIAN_RESOURCE_ORDER, PLAYER_RESOURCES } from '@/data/resources'
import type { TravianResourceKey } from '@/data/resources'
import { formatNumber } from '@/utils/formatNumber'
import { useExplorationTicker } from '@/composables/useExplorationTicker'
import VictoryPointsDisplay from './VictoryPointsDisplay.vue'
import ThreatIndicator from './ThreatIndicator.vue'
import TimersPanel from './TimersPanel.vue'
import CombatReportOverlay from '../map/CombatReportOverlay.vue'
import ResourceCounter from '@/components/ui/ResourceCounter.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const missionStore = useMissionStore()
const mapStore = useMapStore()
const gameStore = useGameStore()
const { combatReport, start: startTicker, stop: stopTicker } = useExplorationTicker()

// Computed
const currentMission = computed(() => missionStore.currentMission.value)
const town = computed(() => missionStore.town.value)
const hqLevel = computed(() => getHQLevel(town.value?.buildings ?? []))
const capacity = computed(() => getResourceCapacity(hqLevel.value))
const missionName = computed(() => currentMission.value?.name || 'Camp de Base')
// Total des troupes disponibles en garnison (hors mouvements/missions), pour l'indicateur
// du header — le détail par type reste dans le tooltip, cf. BarracksCard.vue pour l'équivalent
// détaillé (icône par type) affiché dans la vue Village.
const totalUnits = computed(() =>
  (town.value?.units ?? []).reduce((sum, u) => sum + u.count, 0),
)
const unitsTooltip = computed(() => {
  const units = town.value?.units ?? []
  if (units.length === 0) return 'Aucune troupe disponible'
  return units.map((u) => `${UNIT_DEFINITIONS[u.type].name} : ${u.count}`).join(' · ')
})
/** Vrai si la ressource est au plafond de stockage (production perdue) */
const isResourceFull = (key: TravianResourceKey): boolean =>
  Math.floor(missionStore.displayResources.value[key]) >= capacity.value

/**
 * Tooltip riche d'un compteur de ressource : valeurs exactes (non abrégées),
 * taux de production et temps estimé avant stockage plein.
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
    const msUntilFull = ((capacity.value - exact) / rate) * 60_000
    lines.push(`Plein dans ${formatDuration(msUntilFull)}`)
  }
  return lines.join('\n')
}

const missionDifficulty = computed(() => currentMission.value?.difficulty)
const DIFFICULTY_TONES = {
  easy: 'success',
  medium: 'warning',
  hard: 'danger',
  elite: 'epic',
} as const

// Temps
const now = ref(Date.now())

const formattedGameTime = computed(() => {
  // Force reactivity on `now`
  void now.value
  const ms = missionStore.getGameTimestamp()
  return formatDuration(ms)
})

const formattedRealTime = computed(() => {
  const d = new Date(now.value)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

// Horloge réactive pour les timers affichés (le store gère déjà la production)
const resourceIntervalId = setInterval(() => {
  now.value = Date.now()
}, 1000)

// Actions
const exitCampaign = () => {
  missionStore.exitMission()
  router.push('/mission-tree')
}

// Largeur réservée au panneau de timers (sidebar fixe côté droit) — locale à ce composant
// (le panneau n'existe que sur cette route), synchronisée avec son état collapse stocké
// dans localStorage par TimersPanel.vue. Les valeurs 260px/64px reprennent celles de la
// sidebar de navigation (SideNavBar.vue) pour une largeur collapsed symétrique.
const TIMERS_STORAGE_KEY = 'timers-panel-collapsed'
const timersPanelWidth = ref(localStorage.getItem(TIMERS_STORAGE_KEY) === 'true' ? '64px' : '260px')
const onTimersPanelToggle = (e: Event) => {
  timersPanelWidth.value = (e as CustomEvent<boolean>).detail ? '64px' : '260px'
}

// Lifecycle — ce composant reste monté tant que le joueur est dans la Campagne (Village ou
// Carte), c'est donc l'unique point de démarrage des services de fond (production, file de
// construction/entraînement, résolution des mouvements/combats/raids).
onMounted(() => {
  missionStore.loadMissionState()
  missionStore.startAllServices()
  mapStore.loadMapState()
  startTicker()
  window.addEventListener('timers-panel-toggle', onTimersPanelToggle)
})

onUnmounted(() => {
  clearInterval(resourceIntervalId)
  missionStore.stopAllServices()
  stopTicker()
  mapStore.saveMapState()
  window.removeEventListener('timers-panel-toggle', onTimersPanelToggle)
})
</script>

<style scoped>
.campaign-view {
  min-height: 100vh;
  background: var(--gradient-canvas);
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  /* Le panneau de timers est une sidebar fixe (TimersPanel.vue) — on réserve l'espace à
     droite sur tout le layout (header inclus), comme App.vue le fait à gauche pour la
     sidebar de navigation (--sidebar-width). Variable locale : le panneau n'existe que
     sur cette route, inutile de la remonter globalement dans App.vue. */
  padding-right: var(--timers-panel-width, 260px);
  transition: padding-right 0.25s ease;
}

/* Desktop étroit (769px–1200px) : le panneau de timers est forcé en mode replié
   (TimersPanel.vue), on plafonne donc l'espace réservé à 64px. */
@media (min-width: 769px) and (max-width: 1200px) {
  .campaign-view {
    padding-right: 64px;
  }
}

@media (max-width: 768px) {
  /* Le panneau de timers se masque au même palier que la sidebar de navigation. */
  .campaign-view {
    padding-right: 0;
  }
}

.campaign-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: rgba(var(--color-white-rgb), 0.7);
  border-bottom: 1px solid rgba(var(--color-accent-rgb), 0.3);
  backdrop-filter: blur(10px);
}

.campaign-info h1 {
  font-size: 1.8rem;
  margin: 0;
  color: var(--color-accent-ink);
}

.campaign-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.resources-display {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.resource-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

/* Sépare visuellement les ressources de ville (production locale, bois/argile/fer/céréales)
   des méta-ressources (comptes joueur transversaux à la campagne : fragments, troupes). */
.resource-divider {
  width: 1px;
  align-self: stretch;
  min-height: 1.6rem;
  background: rgba(var(--color-accent-rgb), 0.25);
}

.resource-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  background: rgba(var(--color-accent-rgb), 0.08);
  border-radius: 6px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  line-height: 1.1;
}

/* Ressource au plafond : teinte d'alerte — la production est perdue */
.resource-item--full {
  background: rgba(var(--color-warning-rgb), 0.14);
  border-color: rgba(var(--color-warning-rgb), 0.55);
}

/* Compteur cliquable (fragments de carte → vue carte) */
.resource-item--link {
  cursor: pointer;
  transition: background 0.15s;
}

.resource-item--link:hover {
  background: rgba(var(--color-accent-rgb), 0.16);
}

.resource-icon {
  font-size: 1rem;
}

.resource-values {
  display: flex;
  align-items: baseline;
  gap: 0.1rem;
}

.resource-amount {
  font-weight: bold;
  font-size: 0.88rem;
  color: var(--color-text);
}

.resource-cap {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.resource-production {
  font-size: 0.68rem;
  color: var(--color-success-strong);
  opacity: 0.85;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 1rem;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(var(--color-white-rgb), 0.5);
  border: 1px solid rgba(var(--color-accent-rgb), 0.2);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

.time-item {
  color: var(--color-accent-ink);
  white-space: nowrap;
}

.time-real {
  color: var(--color-text-muted);
}

.time-separator {
  color: rgba(var(--color-accent-rgb), 0.3);
}

.campaign-content {
  flex: 1;
  padding: 2rem;
}

.campaign-router-view {
  height: 100%;
  background: rgba(var(--overlay-rgb), 0.03);
  border-radius: 12px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.15);
  overflow: hidden;
}

/* Écran de transition */
.transition-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.transition-content {
  text-align: center;
  color: #f4e4bc;
}

.transition-content h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

.transition-content p {
  font-size: 1.2rem;
  margin-top: 1rem;
  opacity: 0.8;
}

.spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 215, 0, 0.2);
  border-top-color: #ffd700;
  border-radius: 50%;
  margin: 0 auto 2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .campaign-header {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .resources-display {
    gap: 1rem;
  }
}
</style>

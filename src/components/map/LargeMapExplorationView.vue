<template>
  <div class="large-map-exploration-view">
    <!-- BANDEAU D'ALERTE RAID — affiché dès qu'une forteresse est hostile -->
    <Transition name="raid-banner">
      <div v-if="nextHostileRaid" class="raid-alert-banner">
        <TimerClock
          :progress="1 - raidProgressRatio"
          :remaining-ms="raidCountdownSeconds !== null ? raidCountdownSeconds * 1000 : undefined"
          icon="⚔️"
          progress-color="#ef4444"
        />
        <!-- Infos texte -->
        <div class="raid-alert-text">
          <strong>RAID ENNEMI IMMINENT</strong>
          <span class="raid-alert-sub">{{ nextHostileRaidLocation }}</span>
        </div>
      </div>
    </Transition>

    <!-- VUE CARTE -->
    <template v-if="!selectedTile">
      <!-- Fragments de carte -->
      <div class="map-fragments-bar" v-if="gameStore.gameState.inventory.mapFragments > 0">
        <span class="fragments-icon">🗺️</span>
        <span class="fragments-label">
          {{ gameStore.gameState.inventory.mapFragments }} fragment{{
            gameStore.gameState.inventory.mapFragments > 1 ? 's' : ''
          }}
          de carte
        </span>
        <span class="fragments-hint">Cliquez sur un cadran 🔒 pour le révéler</span>
      </div>

      <!-- Instructions -->
      <div class="controls-help-wrap">
        <span class="controls-help-trigger">⌨️</span>
        <div class="controls-help-tooltip">
          <div class="help-item">🖱️ <strong>Clic & Glisser</strong> : Déplacer la carte</div>
          <div class="help-item">⌨️ <strong>Flèches / WASD</strong> : Navigation</div>
          <div class="help-item">🔍 <strong>Proche / Normal / Loin</strong> : Zoom</div>
          <div class="help-item">⌨️ <strong>Espace</strong> : Centrer sur position</div>
        </div>
      </div>

      <!-- Grande grille de la carte -->
      <section class="map-section">
        <LargeMapGrid
          :tiles="mapTiles"
          :selected-tile-id="selectedTileId"
          @select-tile="handleTileSelect"
          @unlock-chunk="handleUnlockChunk"
        />
      </section>

      <!-- Mouvements (éclaireurs + troupes en transit) -->
      <MovementsPanel />
    </template>

    <!-- VUE DÉTAILS (remplace la carte) -->
    <template v-else>
      <div class="tile-details-view">
        <button class="back-btn" @click="closeDetails">← Retour à la carte</button>
        <TileDetails
          :tile="selectedTile"
          @attack-tile="handleAttackTile"
          @trade-tile="handleTradeTile"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMapStore, HOSTILE_ATTACK_INTERVAL_MS, type MovementUnit } from '../../stores/mapStore'
import { useMissionStore } from '../../stores/missionStore'
import { useGameStore } from '../../stores/gameStore'
import { gameSettings } from '../../stores/gameSettingsStore'
import { useToastStore } from '../../stores/toastStore'
import { useExplorationTicker } from '@/composables/useExplorationTicker'

// Composants
import LargeMapGrid from './LargeMapGrid.vue'
import TileDetails from './TileDetails.vue'
import MovementsPanel from './MovementsPanel.vue'
import TimerClock from '@/components/ui/TimerClock.vue'

// Stores
const mapStore = useMapStore()
const missionStore = useMissionStore()
const gameStore = useGameStore()
const toastStore = useToastStore()

// Ticker d'exploration (mouvements, combats, raids) — démarré par CampaignLayout.vue,
// on ne fait ici que lire son horloge partagée pour la bannière de raid.
const { now } = useExplorationTicker()

// État local
const selectedTileId = ref<string | null>(null)

// Computed
const mapTiles = computed(() => mapStore.mapTiles.value)
const selectedTile = computed(() => {
  if (!selectedTileId.value) return null
  return mapStore.getTileById(selectedTileId.value)
})

/** Zone hostile avec le raid le plus imminent */
const nextHostileRaid = computed(() => {
  const zones = Object.values(mapStore.mapState.fortressZones).filter(
    (z) => z.hostilityState === 'hostile' && z.nextAttackAt,
  )
  if (zones.length === 0) return null
  return zones.reduce((a, b) =>
    (a.nextAttackAt ?? Infinity) < (b.nextAttackAt ?? Infinity) ? a : b,
  )
})

/** Secondes restantes avant le prochain raid (réactif via now) */
const raidCountdownSeconds = computed(() => {
  if (!nextHostileRaid.value?.nextAttackAt) return null
  const remaining = nextHostileRaid.value.nextAttackAt - now.value
  return Math.max(0, Math.ceil(remaining / 1000))
})

/** Ratio de progression du cercle (1 = plein, 0 = vide) */
const raidProgressRatio = computed(() => {
  if (!nextHostileRaid.value?.nextAttackAt) return 1
  const remaining = Math.max(0, nextHostileRaid.value.nextAttackAt - now.value)
  return remaining / HOSTILE_ATTACK_INTERVAL_MS
})

/** Coordonnées de la forteresse hostile la plus imminente */
const nextHostileRaidLocation = computed(() => {
  if (!nextHostileRaid.value) return ''
  const tile = mapStore.getTileById(nextHostileRaid.value.fortressTileId)
  return tile ? `Forteresse (${tile.position.x}, ${tile.position.y})` : 'Forteresse hostile'
})

/** Ferme la vue détails et revient à la carte */
const closeDetails = () => {
  selectedTileId.value = null
  mapStore.clearSelection()
}

// Methods
const handleTileSelect = (tileId: string) => {
  const tile = mapStore.getTileById(tileId)

  if (!tile) {
    toastStore.showError('Case introuvable')
    return
  }

  // Les plaines sont des cases neutres non interactives
  if (tile.type === 'plains') return

  // Les cases non explorées sont ignorées (cadran bloqué ou brouillard)
  if (!tile.explored && !gameSettings.disableFogOfWar) return

  // Sélectionner la case
  const success = mapStore.selectTile(tileId)
  if (success) {
    selectedTileId.value = tileId
  }
}

const handleAttackTile = (tileId: string, selectedUnits: MovementUnit[]) => {
  const tile = mapStore.getTileById(tileId)
  if (!tile) return

  if (selectedUnits.length === 0 || selectedUnits.every((u) => u.count <= 0)) {
    toastStore.showWarning("Vous n'avez aucune unité à envoyer !")
    return
  }

  // Bloquer si un mouvement est déjà en cours vers cette tuile
  if (mapStore.getMovementsToTile(tileId).length > 0) {
    toastStore.showWarning('Des troupes sont déjà en route vers cette case.')
    return
  }

  // Les unités viennent déjà du plan d'attaque (AttackPanel), pas besoin de snapshot manuel
  const travelMs = mapStore.calculateTravelTimeMs(tileId, selectedUnits)
  const totalSeconds = Math.ceil(travelMs / 1000)
  const travelLabel =
    totalSeconds >= 60
      ? `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
      : `${totalSeconds}s`

  const movement = mapStore.dispatchTroops(tileId, selectedUnits)
  if (!movement) {
    toastStore.showError('Impossible de calculer le trajet.')
    return
  }

  // Retirer les troupes envoyées de la garnison — elles ne sont plus disponibles pendant le voyage
  const townUnits = missionStore.missionState.town.units
  for (const sentUnit of selectedUnits) {
    const garrisonUnit = townUnits.find((u) => u.type === sentUnit.type)
    if (garrisonUnit) {
      garrisonUnit.count = Math.max(0, garrisonUnit.count - sentUnit.count)
    }
  }
  missionStore.missionState.town.units = townUnits.filter((u) => u.count > 0)

  toastStore.addToast(`🪖 Troupes envoyées — arrivée dans ${travelLabel}`, 'info')
  // Revenir à la carte pour voir le mouvement en temps réel
  closeDetails()
}

/* ------------------------------------------------------------------------
 * Le reste de la logique de résolution de combat (executeCombat,
 * generateEnemyGarrison, applyPostVictorySpecialPowers) vit désormais dans
 * useExplorationTicker.ts, pour continuer à tourner même hors de cette vue.
 * ------------------------------------------------------------------------ */

/** Débloque un cadran via un fragment de carte */
const handleUnlockChunk = (chunkId: string) => {
  if (gameStore.gameState.inventory.mapFragments <= 0) {
    toastStore.showWarning('Aucun fragment de carte disponible')
    return
  }
  const success = gameStore.useMapFragment(chunkId)
  if (success) {
    toastStore.showSuccess('🗺️ Nouveau territoire révélé !')
  }
}

const handleTradeTile = (_tileId: string) => {
  toastStore.addToast('Système de commerce en développement', 'info')
}

</script>

<style scoped>
.large-map-exploration-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

/* ── Bandeau alerte raid ── */
.raid-alert-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  margin-bottom: 14px;
  background: linear-gradient(135deg, rgba(140, 15, 15, 0.92), rgba(80, 8, 8, 0.95));
  border: 1px solid rgba(239, 68, 68, 0.6);
  border-radius: 10px;
  color: #fff;
}

.raid-alert-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.raid-alert-text strong {
  font-size: 0.95em;
  letter-spacing: 0.06em;
}

.raid-alert-sub {
  font-size: 0.8em;
  color: #fca5a5;
}

/* Transition entrée/sortie du bandeau */
.raid-banner-enter-active {
  transition: all 0.4s ease;
}
.raid-banner-leave-active {
  transition: all 0.3s ease;
}
.raid-banner-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}
.raid-banner-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.map-fragments-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #1a1040, #2d1f6e);
  border: 1px solid #5b4aaa;
  border-radius: 8px;
  margin-bottom: 10px;
  color: #c0b8ff;
  font-size: 0.9em;
}

.fragments-icon {
  font-size: 1.2em;
}

.fragments-label {
  font-weight: bold;
  color: #e0d8ff;
}

.fragments-hint {
  font-size: 0.8em;
  color: #8878cc;
  margin-left: auto;
  font-style: italic;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 20px;
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  border-radius: 12px;
  color: white;
}

.map-header h2 {
  margin: 0;
  font-size: 1.5em;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.map-size-info {
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.9em;
  font-weight: 500;
}

.controls-help-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-bottom: 10px;
}

.controls-help-trigger {
  font-size: 1rem;
  cursor: help;
  opacity: 0.55;
  transition: opacity 0.15s;
  user-select: none;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid rgba(42, 82, 152, 0.3);
  background: rgba(42, 82, 152, 0.08);
}
.controls-help-trigger:hover {
  opacity: 1;
}

.controls-help-tooltip {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 100;
  background: rgba(10, 15, 30, 0.97);
  border: 1px solid rgba(42, 82, 152, 0.4);
  border-radius: 10px;
  padding: 0.6rem 0.85rem;
  min-width: 240px;
  flex-direction: column;
  gap: 0.4rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

.controls-help-wrap:hover .controls-help-tooltip {
  display: flex;
}

.help-item {
  font-size: 0.82em;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
}

.help-item strong {
  color: #e2e8f0;
}

.map-section {
  margin: 20px 0;
}

.tile-details-view {
  position: relative;
  width: 100%;
  min-height: 600px;
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  box-sizing: border-box;
  margin: 20px 0;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #ccc;
  padding: 10px 18px;
  margin-bottom: 16px;
  cursor: pointer;
  font-size: 0.95em;
  transition:
    background 0.15s,
    color 0.15s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.notification-placeholder {
  display: none;
}

.slide-fade-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .large-map-exploration-view {
    padding: 10px;
  }

  .map-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .map-header h2 {
    font-size: 1.2em;
  }

  .controls-help {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>

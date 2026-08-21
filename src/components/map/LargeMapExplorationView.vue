<template>
  <div class="large-map-exploration-view">
    <!-- BANDEAU D'ALERTE RAID — affiché dès qu'une forteresse est hostile -->
    <Transition name="raid-banner">
      <NoticeBox v-if="nextHostileRaid" variant="danger" icon="" class="raid-alert-banner">
        <div class="raid-alert-body">
          <TimerClock
            :progress="1 - raidProgressRatio"
            :remaining-ms="raidCountdownSeconds !== null ? raidCountdownSeconds * 1000 : undefined"
            icon="⚔️"
            progress-color="var(--color-danger)"
          />
          <!-- Infos texte -->
          <div class="raid-alert-text">
            <strong>RAID ENNEMI IMMINENT</strong>
            <button
              v-if="nextHostileRaidTile"
              type="button"
              class="raid-alert-sub raid-alert-link"
              title="Voir la forteresse hostile"
              @click="handleTileSelect(nextHostileRaidTile.id)"
            >
              {{ nextHostileRaidLocation }} →
            </button>
            <span v-else class="raid-alert-sub">{{ nextHostileRaidLocation }}</span>
          </div>
        </div>
      </NoticeBox>
    </Transition>

    <!-- VUE CARTE -->
    <template v-if="!selectedTile">
      <!-- Instructions -->
      <InfoPopover icon="⌨️" label="Aide clavier & souris" class="controls-help">
        <div class="help-item">🖱️ <strong>Clic & Glisser</strong> : Déplacer la carte</div>
        <div class="help-item">⌨️ <strong>Flèches / WASD</strong> : Navigation</div>
        <div class="help-item">🔍 <strong>Proche / Normal / Loin</strong> : Zoom</div>
        <div class="help-item">⌨️ <strong>Espace</strong> : Centrer sur position</div>
        <div class="help-item">⌨️ <strong>Échap</strong> : Fermer la fiche de case</div>
        <div class="help-item">
          🔒 <strong>Cadran verrouillé</strong> : cliquez pour le révéler (1 fragment de carte 🗺️)
        </div>
      </InfoPopover>

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
        <Button variant="secondary" @click="closeDetails">← Retour à la carte</Button>
        <TileDetails
          :tile="selectedTile"
          @attack-tile="handleAttackTile"
          @select-tile="handleTileSelect"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMapStore, HOSTILE_ATTACK_INTERVAL_MS, type MovementUnit } from '../../stores/mapStore'
import { useMissionStore } from '../../stores/missionStore'
import type { MilitaryUnit } from '../../stores/missionStore'
import { useGameStore } from '../../stores/gameStore'
import { gameSettings } from '../../stores/gameSettingsStore'
import { useToastStore } from '../../stores/toastStore'
import { useExplorationTicker } from '@/composables/useExplorationTicker'

// Composants
import LargeMapGrid from './LargeMapGrid.vue'
import TileDetails from './TileDetails.vue'
import MovementsPanel from './MovementsPanel.vue'
import TimerClock from '@/components/ui/TimerClock.vue'
import NoticeBox from '@/components/ui/NoticeBox.vue'
import InfoPopover from '@/components/ui/InfoPopover.vue'
import Button from '@/components/ui/Button.vue'

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

/** Tuile de la forteresse hostile — null si non sélectionnable (brouillard) */
const nextHostileRaidTile = computed(() => {
  if (!nextHostileRaid.value) return null
  const tile = mapStore.getTileById(nextHostileRaid.value.fortressTileId)
  if (!tile) return null
  return tile.explored || gameSettings.disableFogOfWar ? tile : null
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

/**
 * Navigation inter-écrans : d'autres vues (rapports, timers, toasts…)
 * sélectionnent une tuile via mapStore.selectTile() puis routent vers la carte.
 * On synchronise cette sélection externe avec l'état local de la vue ;
 * si la sélection est refusée (brouillard, plaine…), on nettoie le store
 * pour ne pas laisser un état orphelin.
 */
watch(
  () => mapStore.mapState.selectedTileId,
  (id) => {
    if (id && id !== selectedTileId.value) {
      handleTileSelect(id)
      if (selectedTileId.value !== id) mapStore.clearSelection()
    }
  },
  { immediate: true },
)

/** Échap ferme la fiche de case et revient à la carte */
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && selectedTileId.value) closeDetails()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

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
  for (const sentUnit of selectedUnits) {
    missionStore.removeUnits(sentUnit.type as MilitaryUnit['type'], sentUnit.count)
  }

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
</script>

<style scoped>
.large-map-exploration-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

/* ── Bandeau alerte raid ── */
.raid-alert-banner {
  margin-bottom: 14px;
}

.raid-alert-body {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
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
  color: var(--color-danger);
}

.raid-alert-sub {
  font-size: 0.8em;
  color: var(--color-text-muted);
}

/* Variante cliquable du sous-titre : lien vers la forteresse hostile */
.raid-alert-link {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  align-self: flex-start;
  text-align: left;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.raid-alert-link:hover {
  color: var(--color-danger-light);
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

.controls-help {
  margin-bottom: 10px;
}

.help-item {
  font-size: 0.85em;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.help-item + .help-item {
  margin-top: 0.3rem;
}

.help-item strong {
  color: var(--color-text);
}

.map-section {
  margin: 20px 0;
}

/* Pas de "fausse carte" blanche autour du bento : les cellules posent
   directement sur le canvas, comme le bento du village. Largeur bornée à
   1000px — la largeur de confort d'une fiche de détail, pas celle de la carte. */
.tile-details-view {
  position: relative;
  max-width: 1000px;
  margin: 20px auto;
}

.tile-details-view > .btn {
  margin-bottom: 16px;
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

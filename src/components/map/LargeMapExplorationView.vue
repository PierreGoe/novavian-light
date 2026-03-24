<template>
  <div class="large-map-exploration-view">
    <!-- Instructions -->
    <div class="controls-help">
      <div class="help-item">🖱️ <strong>Clic & Glisser</strong>: Déplacer la carte</div>
      <div class="help-item">⌨️ <strong>Flèches / WASD</strong>: Navigation</div>
      <div class="help-item">🔍 <strong>Boutons +/-</strong>: Zoom</div>
      <div class="help-item">⌨️ <strong>Espace</strong>: Centrer sur position</div>
    </div>

    <!-- Grande grille de la carte -->
    <section class="map-section">
      <LargeMapGrid
        :tiles="mapTiles"
        :selected-tile-id="selectedTileId"
        @select-tile="handleTileSelect"
      />
    </section>

    <!-- Détails de la tuile sélectionnée -->
    <TileDetails
      v-if="selectedTile"
      :tile="selectedTile"
      @attack-tile="handleAttackTile"
      @trade-tile="handleTradeTile"
      @explore-tile="handleExploreTile"
      @scout-tile="handleScoutTile"
    />

    <!-- Panel éclaireurs -->
    <section class="scouts-panel">
      <div class="scouts-panel-header">
        <h3 class="scouts-title">🔭 Éclaireurs</h3>
        <div class="scouts-available">
          <span v-for="i in 4" :key="i" class="scout-dot" :class="{ active: i <= scoutsAvailable }"
            >🧍</span
          >
          <span class="scouts-count"
            >{{ scoutsAvailable }} / 4 disponible{{ scoutsAvailable > 1 ? 's' : '' }}</span
          >
        </div>
      </div>

      <!-- Missions en cours -->
      <div v-if="activeScoutMissions.length > 0" class="scouts-section">
        <div class="scouts-section-label">En mission</div>
        <div class="scouts-list">
          <div
            v-for="mission in activeScoutMissions"
            :key="mission.id"
            class="scout-mission active"
          >
            <div class="scout-mission-icon">🔭</div>
            <div class="scout-mission-info">
              <span class="scout-coords">({{ mission.target.x }}, {{ mission.target.y }})</span>
              <div class="scout-progress-bar">
                <div
                  class="scout-progress-fill"
                  :style="{ width: getMissionProgress(mission) + '%' }"
                ></div>
              </div>
            </div>
            <div class="scout-timer">{{ formatTimeRemaining(mission.endsAt) }}</div>
          </div>
        </div>
      </div>

      <!-- Missions terminées récemment -->
      <div v-if="completedScoutMissions.length > 0" class="scouts-section">
        <div class="scouts-section-label">Terminées</div>
        <div class="scouts-list">
          <div
            v-for="mission in completedScoutMissions"
            :key="mission.id"
            class="scout-mission completed"
          >
            <div class="scout-mission-icon">✅</div>
            <div class="scout-mission-info">
              <span class="scout-coords">({{ mission.target.x }}, {{ mission.target.y }})</span>
              <span class="scout-done-label">Zone découverte</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Aucune mission -->
      <div
        v-if="activeScoutMissions.length === 0 && completedScoutMissions.length === 0"
        class="scouts-empty"
      >
        Cliquez sur une case inconnue pour envoyer un éclaireur
      </div>
    </section>

    <!-- Bouton + panneau historique des rapports -->
    <section class="reports-panel">
      <button class="reports-toggle" @click="showReportsPanel = !showReportsPanel">
        📜 Rapports ({{ missionStore.battleReports.value.length }})
        <span v-if="missionStore.unreadReportsCount.value > 0" class="unread-badge">
          {{ missionStore.unreadReportsCount.value }}
        </span>
      </button>

      <div v-if="showReportsPanel" class="reports-list">
        <div v-if="missionStore.battleReports.value.length === 0" class="reports-empty">
          Aucun rapport de bataille
        </div>
        <div
          v-for="report in missionStore.battleReports.value"
          :key="report.id"
          class="report-entry"
          :class="[
            report.attackerVictory ? 'entry-victory' : 'entry-defeat',
            { 'entry-unread': !report.read },
          ]"
          @click="viewSavedReport(report)"
        >
          <span class="report-entry-icon">{{ report.attackerVictory ? '🏆' : '💔' }}</span>
          <div class="report-entry-info">
            <span class="report-entry-name">
              <span v-if="!report.read" class="new-dot"></span>
              {{ report.tileName }}
            </span>
            <span class="report-entry-date">{{ formatReportDate(report.date) }}</span>
          </div>
          <button
            class="report-delete-btn"
            title="Supprimer"
            @click.stop="missionStore.deleteBattleReport(report.id)"
          >
            ✕
          </button>
        </div>
      </div>
    </section>

    <!-- Rapport de combat (overlay) -->
    <Transition name="slide-fade">
      <section v-if="combatReport" class="combat-report-panel">
        <div class="report-header" :class="combatReport.attackerVictory ? 'victory' : 'defeat'">
          <span class="report-icon">{{ combatReport.attackerVictory ? '🏆' : '💔' }}</span>
          <span class="report-title">{{
            combatReport.attackerVictory ? 'Victoire !' : 'Défaite'
          }}</span>
        </div>

        <p class="report-summary">{{ combatReport.summary }}</p>

        <div class="report-details">
          <div class="report-side">
            <h4>{{ combatReport.attacker.army.label }}</h4>
            <div class="report-stat">⚔️ Force : {{ combatReport.attacker.totalPowerUsed }}</div>
            <div
              v-for="(killed, type) in combatReport.attacker.losses.killed"
              :key="type"
              class="report-loss"
            >
              {{ type }} : -{{ killed }} tué(s)
            </div>
            <div v-if="combatReport.attacker.losses.survivors.length > 0" class="report-survivors">
              Survivants :
              {{
                combatReport.attacker.losses.survivors.map((u) => `${u.count} ${u.type}`).join(', ')
              }}
            </div>
          </div>

          <div class="report-divider"></div>

          <div class="report-side">
            <h4>{{ combatReport.defender.army.label }}</h4>
            <div class="report-stat">🛡️ Force : {{ combatReport.defender.totalPowerUsed }}</div>
            <div
              v-for="(killed, type) in combatReport.defender.losses.killed"
              :key="type"
              class="report-loss"
            >
              {{ type }} : -{{ killed }} tué(s)
            </div>
            <div v-if="combatReport.defender.losses.survivors.length > 0" class="report-survivors">
              Survivants :
              {{
                combatReport.defender.losses.survivors.map((u) => `${u.count} ${u.type}`).join(', ')
              }}
            </div>
          </div>
        </div>

        <button class="report-close-btn" @click="combatReport = null">Fermer</button>
      </section>
    </Transition>

    <!-- Toast de notification -->
    <Transition name="slide-fade">
      <div v-if="notification" class="notification" :class="notification.type">
        {{ notification.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMapStore, type MapTile } from '../../stores/mapStore'
import { useMissionStore } from '../../stores/missionStore'
import { defaultResolver } from '../../combat/combatResolver'
import type { Army, CombatReport, CombatUnit, SavedBattleReport } from '../../combat/types'
import { ENEMY_BASE_INFANTRY, ENEMY_STRONGHOLD_INFANTRY } from '../../config'

// Composants
import LargeMapGrid from './LargeMapGrid.vue'
import TileDetails from './TileDetails.vue'

// Stores
const mapStore = useMapStore()
const missionStore = useMissionStore()

// État local
const selectedTileId = ref<string | null>(null)
const notification = ref<{ message: string; type: string } | null>(null)
const currentTime = ref(Date.now())
const combatReport = ref<CombatReport | null>(null)
const showReportsPanel = ref(false)

// Computed
const mapTiles = computed(() => mapStore.mapTiles.value)
const selectedTile = computed(() => {
  if (!selectedTileId.value) return null
  return mapStore.getTileById(selectedTileId.value)
})
const scoutsAvailable = computed(() => missionStore.scoutsAvailable.value)
const activeScoutMissions = computed(() =>
  missionStore.getScoutMissions.value.filter((m) => m.status === 'pending'),
)
const completedScoutMissions = computed(() =>
  missionStore.getScoutMissions.value.filter((m) => m.status === 'completed'),
)

// Helpers scouts
const formatTimeRemaining = (endsAt: number): string => {
  const remaining = Math.max(0, endsAt - currentTime.value)
  const seconds = Math.ceil(remaining / 1000)
  if (seconds <= 0) return 'Arrivée...'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m${seconds % 60}s`
}

const getMissionProgress = (mission: { startedAt: number; endsAt: number }): number => {
  const total = mission.endsAt - mission.startedAt
  const elapsed = currentTime.value - mission.startedAt
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

// Methods
const handleTileSelect = (tileId: string) => {
  const tile = mapStore.getTileById(tileId)

  if (!tile) {
    showNotification('Case introuvable', 'error')
    return
  }

  // Si la case n'est pas explorée, proposer une mission d'éclaireur
  if (!tile.explored) {
    const target = { x: tile.position.x, y: tile.position.y }

    // Vérifier si on peut lancer une mission
    if (!missionStore.canStartScoutMission(target)) {
      if (missionStore.scoutsAvailable.value <= 0) {
        showNotification('Aucun éclaireur disponible', 'warning')
      } else {
        showNotification("Cette case est déjà en cours d'exploration", 'warning')
      }
      return
    }

    // Lancer la mission d'éclaireur
    const success = missionStore.startScoutMission(target)
    if (success) {
      showNotification(`🔭 Éclaireur envoyé vers (${target.x}, ${target.y})`, 'success')
    } else {
      showNotification("Impossible de lancer la mission d'éclaireur", 'error')
    }
    return
  }

  // Si la case est explorée, la sélectionner normalement
  const success = mapStore.selectTile(tileId)
  if (success) {
    selectedTileId.value = tileId
  }
}

const handleAttackTile = (tileId: string) => {
  const tile = mapStore.getTileById(tileId)
  if (!tile) return

  const playerUnits = missionStore.town.value?.units || []
  if (playerUnits.length === 0 || playerUnits.every((u) => u.count <= 0)) {
    showNotification("Vous n'avez aucune unité à envoyer !", 'warning')
    return
  }

  // Construire l'armée attaquante
  const attackerUnits: CombatUnit[] = playerUnits
    .filter((u) => u.count > 0)
    .map((u) => ({
      type: u.type,
      count: u.count,
      attack: u.attack,
      defense: u.defense,
      health: u.health,
    }))

  const attackerArmy: Army = {
    label: 'Vos troupes',
    units: attackerUnits,
    modifiers: [],
  }

  // Utiliser la garnison mémorisée ou en générer une nouvelle (snapshot)
  if (!tile.garrison) {
    const generated = generateEnemyGarrison(tile)
    tile.garrison = { units: generated.units }
  }

  // Si la garnison est vide (déjà vaincue)
  if (tile.garrison.units.length === 0 || tile.garrison.units.every((u) => u.count <= 0)) {
    tile.type = 'ruins'
    tile.garrison = undefined
    mapStore.saveMapState()
    showNotification('Ce village est déjà sans défenses — converti en ruines.', 'info')
    return
  }

  const isStronghold = tile.type === 'stronghold'
  const defenderArmy: Army = {
    label: isStronghold ? 'Garnison de la Forteresse' : 'Garnison du Village Ennemi',
    units: tile.garrison.units.filter((u) => u.count > 0),
    modifiers: [],
  }

  // Résoudre
  const report = defaultResolver.resolve(attackerArmy, defenderArmy)
  combatReport.value = report

  // Appliquer les pertes joueur
  applyPlayerLosses(report)

  // Mettre à jour la garnison ennemie avec les survivants
  tile.garrison.units = report.defender.losses.survivors
  tile.garrison.lastAttackedAt = missionStore.getGameTimestamp()

  // Si victoire, convertir la case
  if (report.attackerVictory) {
    tile.type = 'ruins'
    tile.garrison = undefined
    showNotification(report.summary, 'success')
  } else {
    showNotification(report.summary, 'error')
  }

  // Sauvegarder le rapport
  const tileName = mapStore.getTileName(
    tile.type === 'ruins' ? (isStronghold ? 'stronghold' : 'village_enemy') : tile.type,
  )
  const saved: SavedBattleReport = {
    ...report,
    id: `battle-${Date.now()}`,
    gameTimestamp: missionStore.getGameTimestamp(),
    tileId: tile.id,
    tileName,
    date: new Date().toISOString(),
    read: false,
  }
  missionStore.addBattleReport(saved)

  mapStore.saveMapState()
  missionStore.saveMissionState()
}

/** Génère une garnison ennemie selon le type de case (appelé une seule fois au 1er combat) */
function generateEnemyGarrison(tile: MapTile): { units: CombatUnit[] } {
  const isStronghold = tile.type === 'stronghold'
  const baseCount = isStronghold ? ENEMY_STRONGHOLD_INFANTRY : ENEMY_BASE_INFANTRY
  const variation = Math.floor(Math.random() * 3)

  const units: CombatUnit[] = [
    { type: 'infantry', count: baseCount + variation, attack: 35, defense: 30, health: 90 },
  ]

  if (isStronghold) {
    units.push(
      { type: 'archer', count: 3 + variation, attack: 20, defense: 10, health: 70 },
      { type: 'cavalry', count: 2, attack: 80, defense: 40, health: 120 },
    )
  } else if (Math.random() > 0.5) {
    units.push({ type: 'archer', count: 1 + variation, attack: 20, defense: 10, health: 70 })
  }

  return { units }
}

/** Applique les pertes du rapport aux unités du joueur dans le missionStore */
function applyPlayerLosses(report: CombatReport) {
  const townUnits = missionStore.missionState.town.units

  for (const [unitType, killedCount] of Object.entries(report.attacker.losses.killed)) {
    const unit = townUnits.find((u) => u.type === unitType)
    if (unit) {
      unit.count = Math.max(0, unit.count - killedCount)
    }
  }

  // Retirer les unités à 0
  missionStore.missionState.town.units = townUnits.filter((u) => u.count > 0)
}

const handleTradeTile = (tileId: string) => {
  // TODO: Implémenter le système de commerce
  showNotification('Système de commerce en développement', 'info')
  console.log('Trade with tile:', tileId)
}

const handleExploreTile = (tileId: string) => {
  // TODO: Implémenter l'exploration des ruines
  showNotification('Exploration des ruines en développement', 'info')
  console.log('Explore tile:', tileId)
}

const handleScoutTile = (tileId: string) => {
  const result = mapStore.scout(tileId)
  if (result.success) {
    showNotification(result.message, 'success')
  } else {
    showNotification(result.message, 'error')
  }
}

const showNotification = (message: string, type: string) => {
  notification.value = { message, type }
  setTimeout(() => {
    notification.value = null
  }, 3000)
}

/** Ouvre un rapport sauvegardé dans l'overlay */
const viewSavedReport = (report: SavedBattleReport) => {
  missionStore.markReportRead(report.id)
  showReportsPanel.value = false
  combatReport.value = null
  requestAnimationFrame(() => {
    combatReport.value = report
  })
}

/** Formate une date ISO en label court */
const formatReportDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Timer pour la régénération automatique des points
let regenerationTimer: number | null = null
let displayRefreshTimer: number | null = null

// Lifecycle
onMounted(() => {
  // Charger l'état de la carte (doit être fait AVANT tout le reste)
  const hasLoadedMap = mapStore.loadMapState()

  // Charger l'état du mission store
  missionStore.loadMissionState()

  // Démarrer les services du mission store
  missionStore.startAllServices()

  // Synchroniser immédiatement les cases découvertes au chargement
  const discoveredTiles = missionStore.getDiscoveredTiles.value
  let hasChanges = false
  discoveredTiles.forEach((tileKey: string) => {
    const [x, y] = tileKey.split(',').map(Number)
    const tile = mapStore.getTileAt(x, y)
    if (tile && !tile.explored) {
      tile.explored = true
      hasChanges = true
    }
  })
  if (hasChanges) {
    mapStore.saveMapState()
  }

  // Démarrer le timer de régénération automatique
  regenerationTimer = window.setInterval(() => {
    mapStore.regenerateExplorationPoints()
  }, 60000) // Vérifier toutes les minutes

  // Timer pour forcer le rafraîchissement de l'affichage des timers
  // Les computed vérifieront automatiquement l'état des missions
  displayRefreshTimer = window.setInterval(() => {
    // Mettre à jour le temps pour forcer le recalcul des timers
    currentTime.value = Date.now()

    // Synchroniser les cases découvertes avec le mapStore
    const discoveredTiles = missionStore.getDiscoveredTiles.value
    let hasChanges = false
    discoveredTiles.forEach((tileKey: string) => {
      const [x, y] = tileKey.split(',').map(Number)
      const tile = mapStore.getTileAt(x, y)
      if (tile && !tile.explored) {
        tile.explored = true
        hasChanges = true
      }
    })
    // Ne sauvegarder qu'une seule fois s'il y a eu des changements
    if (hasChanges) {
      mapStore.saveMapState()
    }
  }, 1000) // Vérifier toutes les secondes pour un affichage fluide
})

onUnmounted(() => {
  // Nettoyer les timers
  if (regenerationTimer) {
    clearInterval(regenerationTimer)
  }
  if (displayRefreshTimer) {
    clearInterval(displayRefreshTimer)
  }

  // Arrêter les services du mission store
  missionStore.stopAllServices()

  // Sauvegarder l'état
  mapStore.saveMapState()
})
</script>

<style scoped>
.large-map-exploration-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
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

.controls-help {
  background: rgba(42, 82, 152, 0.1);
  border: 1px solid rgba(42, 82, 152, 0.3);
  border-radius: 8px;
  padding: 12px 20px;
  margin-bottom: 15px;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: center;
}

.help-item {
  font-size: 0.85em;
  color: #666;
  display: flex;
  align-items: center;
  gap: 5px;
}

.help-item strong {
  color: #333;
}

.map-section {
  margin: 20px 0;
}

/* ===== Scout Panel ===== */
.scouts-panel {
  background: rgba(15, 25, 50, 0.7);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 16px;
}

.scouts-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}

.scouts-title {
  margin: 0;
  font-size: 1rem;
  color: #93c5fd;
  font-weight: 600;
}

.scouts-available {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scout-dot {
  font-size: 1rem;
  opacity: 0.25;
  transition: opacity 0.3s ease;
}

.scout-dot.active {
  opacity: 1;
}

.scouts-count {
  font-size: 0.8rem;
  color: #93c5fd;
  margin-left: 4px;
  white-space: nowrap;
}

.scouts-section {
  margin-bottom: 12px;
}

.scouts-section-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 6px;
}

.scouts-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scout-mission {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
}

.scout-mission.active {
  border-color: rgba(100, 149, 237, 0.3);
}

.scout-mission.completed {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.05);
}

.scout-mission-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.scout-mission-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.scout-coords {
  font-size: 0.82rem;
  color: #cbd5e1;
  font-weight: 500;
}

.scout-done-label {
  font-size: 0.75rem;
  color: #4ade80;
}

.scout-progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.scout-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #93c5fd);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.scout-timer {
  font-size: 0.8rem;
  color: #93c5fd;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.scouts-empty {
  font-size: 0.82rem;
  color: #475569;
  text-align: center;
  padding: 10px 0;
  font-style: italic;
}

/* Combat Report Panel */
.combat-report-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 2px solid #334155;
  border-radius: 16px;
  padding: 28px 32px;
  width: 420px;
  max-width: 90vw;
  z-index: 1100;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.7),
    0 0 40px rgba(59, 130, 246, 0.1);
  color: #e2e8f0;
}

.report-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  margin-bottom: 16px;
}

.report-header.victory {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1));
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.report-header.defeat {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1));
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.report-icon {
  font-size: 1.8rem;
}

.report-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.report-header.victory .report-title {
  color: #4ade80;
}

.report-header.defeat .report-title {
  color: #f87171;
}

.report-summary {
  text-align: center;
  font-size: 0.9rem;
  color: #94a3b8;
  margin-bottom: 20px;
  line-height: 1.5;
}

.report-details {
  display: flex;
  gap: 16px;
  align-items: stretch;
}

.report-side {
  flex: 1;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 14px;
}

.report-side h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #cbd5e1;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #334155;
}

.report-stat {
  font-size: 0.82rem;
  color: #93c5fd;
  margin-bottom: 8px;
  font-weight: 500;
}

.report-loss {
  font-size: 0.8rem;
  color: #f87171;
  margin-bottom: 4px;
}

.report-survivors {
  font-size: 0.8rem;
  color: #4ade80;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #334155;
}

.report-divider {
  width: 2px;
  background: linear-gradient(to bottom, transparent, #475569, transparent);
  flex-shrink: 0;
}

.report-close-btn {
  display: block;
  width: 100%;
  margin-top: 20px;
  padding: 10px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.report-close-btn:hover {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* Reports History Panel */
.reports-panel {
  margin-top: 12px;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 1px solid #334155;
  border-radius: 10px;
  overflow: hidden;
}

.reports-toggle {
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.reports-toggle:hover {
  color: #e2e8f0;
  background: rgba(51, 65, 85, 0.4);
}

.reports-list {
  max-height: 260px;
  overflow-y: auto;
  border-top: 1px solid #334155;
}

.reports-empty {
  font-size: 0.82rem;
  color: #475569;
  text-align: center;
  padding: 14px;
  font-style: italic;
}

.report-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid rgba(51, 65, 85, 0.4);
}

.report-entry:last-child {
  border-bottom: none;
}

.report-entry:hover {
  background: rgba(51, 65, 85, 0.5);
}

.report-entry-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.report-entry-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.report-entry-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-victory .report-entry-name {
  color: #4ade80;
}

.entry-defeat .report-entry-name {
  color: #f87171;
}

.report-entry-date {
  font-size: 0.72rem;
  color: #64748b;
}

.report-entry-arrow {
  color: #475569;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.entry-unread {
  background: rgba(59, 130, 246, 0.08);
}

.new-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3b82f6;
  margin-right: 5px;
  vertical-align: middle;
}

.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ef4444;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  margin-left: 8px;
}

.report-delete-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.report-delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.notification.success {
  background: linear-gradient(135deg, #4caf50, #388e3c);
}

.notification.error {
  background: linear-gradient(135deg, #f44336, #d32f2f);
}

.notification.warning {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}

.notification.info {
  background: linear-gradient(135deg, #2196f3, #1976d2);
}

/* Animations */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.3s ease;
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

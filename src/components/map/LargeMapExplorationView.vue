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
    <ScoutsPanel />

    <!-- Historique des rapports -->
    <BattleReportsPanel @view-report="openCombatReport" />

    <!-- Rapport de combat (overlay) -->
    <CombatReportOverlay :report="combatReport" @close="combatReport = null" />

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
import { useGameStore } from '../../stores/gameStore'
import { defaultResolver } from '../../combat/combatResolver'
import type { Army, CombatReport, CombatUnit, SavedBattleReport } from '../../combat/types'
import {
  ENEMY_BASE_INFANTRY,
  ENEMY_STRONGHOLD_INFANTRY,
  SCOUT_MISSION_DURATION_MS,
} from '../../config'
import { useNotifications } from '../../composables/useNotifications'

// Composants
import LargeMapGrid from './LargeMapGrid.vue'
import TileDetails from './TileDetails.vue'
import ScoutsPanel from './ScoutsPanel.vue'
import BattleReportsPanel from './BattleReportsPanel.vue'
import CombatReportOverlay from './CombatReportOverlay.vue'

// Stores
const mapStore = useMapStore()
const missionStore = useMissionStore()
const gameStore = useGameStore()
const { notification, showNotification } = useNotifications()

// État local
const selectedTileId = ref<string | null>(null)
const combatReport = ref<CombatReport | null>(null)

// Computed
const mapTiles = computed(() => mapStore.mapTiles.value)
const selectedTile = computed(() => {
  if (!selectedTileId.value) return null
  return mapStore.getTileById(selectedTileId.value)
})

const openCombatReport = (report: SavedBattleReport) => {
  combatReport.value = null
  requestAnimationFrame(() => {
    combatReport.value = report
  })
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

    // Calculer les bonus d'éclaireur issus des artefacts actifs
    const scouts = gameStore.getEquippedArtifacts.value
    const scoutRangeBonus = scouts
      .filter((a) => a.specialPower?.type === 'scout_range_bonus')
      .reduce((sum, a) => sum + (a.specialPower?.value ?? 0), 0)
    const hasDoubleSpeed = scouts.some((a) => a.specialPower?.type === 'double_scout_speed')

    // Lancer la mission d'éclaireur
    const success = missionStore.startScoutMission(target, {
      extraRevealRadius: scoutRangeBonus > 0 ? scoutRangeBonus : undefined,
      durationOverride: hasDoubleSpeed ? Math.floor(SCOUT_MISSION_DURATION_MS / 2) : undefined,
    })
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

  const isStronghold = tile.type === 'stronghold'

  // Construire les modificateurs issus des artefacts actifs
  const equippedArtifacts = gameStore.getEquippedArtifacts.value
  const artifactModifiers: CombatModifier[] = []

  // Agrégation des bonus militaire/défense des artefacts (% → multiplicateur)
  const totalMilitary = equippedArtifacts.reduce((sum, a) => sum + (a.effects.military ?? 0), 0)
  const totalDefense = equippedArtifacts.reduce((sum, a) => sum + (a.effects.defense ?? 0), 0)
  if (totalMilitary > 0) {
    artifactModifiers.push({
      id: 'artifact-military',
      name: 'Bonus militaire des reliques',
      source: 'artifact',
      attackMultiplier: 1 + totalMilitary / 100,
    })
  }
  if (totalDefense > 0) {
    artifactModifiers.push({
      id: 'artifact-defense',
      name: 'Bonus défense des reliques',
      source: 'artifact',
      defenseMultiplier: 1 + totalDefense / 100,
    })
  }

  // Pouvoir spécial : first_strike → meilleure résistance aux dégâts reçus
  const hasFirstStrike = equippedArtifacts.some((a) => a.specialPower?.type === 'first_strike')
  if (hasFirstStrike) {
    artifactModifiers.push({
      id: 'artifact-first-strike',
      name: 'Frappe en premier',
      source: 'artifact',
      defenseMultiplier: 1.5,
    })
  }

  // Pouvoir spécial : siege_bonus → bonus offensif pour les forteresses
  if (isStronghold) {
    const siegeBonus = equippedArtifacts
      .filter((a) => a.specialPower?.type === 'siege_bonus')
      .reduce((sum, a) => sum + (a.specialPower?.value ?? 0), 0)
    if (siegeBonus > 0) {
      artifactModifiers.push({
        id: 'artifact-siege',
        name: 'Bonus de siège',
        source: 'artifact',
        attackMultiplier: 1 + siegeBonus / 100,
      })
    }
  }

  const attackerArmy: Army = {
    label: 'Vos troupes',
    units: attackerUnits,
    modifiers: artifactModifiers,
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

  const defenderArmy: Army = {
    label: isStronghold ? 'Garnison de la Forteresse' : 'Garnison du Village Ennemi',
    units: tile.garrison.units.filter((u) => u.count > 0),
    modifiers: [],
  }

  // Résoudre
  const report = defaultResolver.resolve(attackerArmy, defenderArmy)
  combatReport.value = report

  // Consommer une utilisation des artefacts à durée limitée actifs
  equippedArtifacts
    .filter((a) => a.durability !== 'permanent')
    .forEach((a) => gameStore.consumeArtifactUse(a.id))

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

    // Points de victoire au combat
    // +1 PV pour chaque victoire en combat
    gameStore.addVictoryPoints('combat', 1, `Victoire en combat contre ${defenderArmy.label}`)
    // +2 PV supplémentaires pour destruction d'un village ou forteresse
    if (isStronghold) {
      gameStore.addVictoryPoints('combat', 4, 'Forteresse ennemie détruite')
    } else {
      gameStore.addVictoryPoints('combat', 2, 'Village ennemi détruit')
    }

    // Pouvoirs spéciaux : effets post-victoire
    applyPostVictorySpecialPowers(equippedArtifacts, tile.position)
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

import type { Artifact } from '../../stores/gameStore'

/**
 * Applique les effets spéciaux déclenchés au moment de la victoire
 * (gold_on_victory, leadership_on_victory, fog_reveal_on_victory, healing_after_combat)
 */
function applyPostVictorySpecialPowers(artifacts: Artifact[], position: { x: number; y: number }) {
  let goldGained = 0
  let leadershipGained = 0

  for (const artifact of artifacts) {
    const sp = artifact.specialPower
    if (!sp) continue

    switch (sp.type) {
      case 'gold_on_victory':
        goldGained += sp.value
        break

      case 'leadership_on_victory':
        leadershipGained += sp.value
        break

      case 'fog_reveal_on_victory': {
        // Révéler les cases dans un rayon autour de la position actuelle
        const radius = sp.value
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            const tile = mapStore.getTileAt(position.x + dx, position.y + dy)
            if (tile && !tile.explored) {
              tile.explored = true
            }
          }
        }
        showNotification(`✨ ${artifact.name} révèle les environs !`, 'success')
        break
      }

      case 'healing_after_combat': {
        // Restaurer sp.value% des unités tuées au combat
        const townUnits = missionStore.missionState.town.units
        let totalRestored = 0
        for (const unit of townUnits) {
          const restored = Math.floor(unit.count * (sp.value / 100))
          if (restored > 0) {
            unit.count += restored
            totalRestored += restored
          }
        }
        if (totalRestored > 0) {
          showNotification(`💚 ${artifact.name} restaure ${totalRestored} unité(s) !`, 'success')
        }
        break
      }
    }
  }

  if (goldGained > 0) {
    gameStore.addGold(goldGained)
    showNotification(`💰 +${goldGained} or (reliques actives)`, 'success')
  }
  if (leadershipGained > 0) {
    gameStore.updateLeadership(leadershipGained, 'add')
    showNotification(`👑 +${leadershipGained} leadership (reliques actives)`, 'success')
  }
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

const handleTradeTile = (_tileId: string) => {
  showNotification('Système de commerce en développement', 'info')
}

const handleExploreTile = (_tileId: string) => {
  showNotification('Exploration des ruines en développement', 'info')
}

const handleScoutTile = (tileId: string) => {
  const result = mapStore.scout(tileId)
  if (result.success) {
    showNotification(result.message, 'success')
  } else {
    showNotification(result.message, 'error')
  }
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
    if (hasChanges) {
      mapStore.saveMapState()
    }
  }, 1000)
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

<template>
  <div class="large-map-exploration-view">
    <!-- BANDEAU D'ALERTE RAID — affiché dès qu'une forteresse est hostile -->
    <Transition name="raid-banner">
      <div v-if="nextHostileRaid" class="raid-alert-banner">
        <!-- Timer circulaire style training queue -->
        <div class="raid-clock-ring">
          <svg viewBox="0 0 60 60" class="raid-clock-svg">
            <circle class="raid-clock-track" cx="30" cy="30" r="26" />
            <circle
              class="raid-clock-progress"
              cx="30"
              cy="30"
              r="26"
              :stroke-dasharray="163.36"
              :stroke-dashoffset="163.36 * raidProgressRatio"
            />
          </svg>
          <div class="raid-clock-inner">
            <span class="raid-clock-icon">⚔️</span>
            <span class="raid-clock-time" v-if="raidCountdownSeconds !== null">{{
              formatCountdown(raidCountdownSeconds)
            }}</span>
          </div>
        </div>
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

      <!-- Historique des rapports -->
      <BattleReportsPanel @view-report="openCombatReport" />
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

    <!-- Rapport de combat (overlay) -->
    <CombatReportOverlay :report="combatReport" @close="combatReport = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  useMapStore,
  HOSTILE_ATTACK_INTERVAL_MS,
  type MapTile,
  type MovementUnit,
  type TroopMovement,
} from '../../stores/mapStore'
import { useMissionStore, UNIT_DEFINITIONS, type MilitaryUnit } from '../../stores/missionStore'
import { useGameStore } from '../../stores/gameStore'
import { formatDuration } from '../../utils/formatDuration'
import {
  defaultResolver,
  computeSiegeDestruction,
  getDestructionLabel,
} from '../../combat/combatResolver'
import type {
  Army,
  CombatModifier,
  CombatReport,
  CombatUnit,
  SavedBattleReport,
} from '../../combat/types'
import { ENEMY_REGEN_INTERVAL_MS } from '../../config'
import { gameSettings } from '../../stores/gameSettingsStore'
import { useToastStore } from '../../stores/toastStore'

// Composants
import LargeMapGrid from './LargeMapGrid.vue'
import TileDetails from './TileDetails.vue'
import MovementsPanel from './MovementsPanel.vue'
import BattleReportsPanel from './BattleReportsPanel.vue'
import CombatReportOverlay from './CombatReportOverlay.vue'

// Stores
const mapStore = useMapStore()
const missionStore = useMissionStore()
const gameStore = useGameStore()
const toastStore = useToastStore()

// État local
const selectedTileId = ref<string | null>(null)
const combatReport = ref<CombatReport | null>(null)
const now = ref(Date.now())

// Ouvrir un rapport quand le store le demande (clic sur toast de raid)
watch(
  () => missionStore.pendingReportToOpen.value,
  (report) => {
    if (report) {
      combatReport.value = report
      missionStore.consumePendingReport()
    }
  },
)

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

/** Formate un nombre de secondes en "5m 23s" ou "45s" */
const formatCountdown = (seconds: number): string => formatDuration(seconds * 1000)

const openCombatReport = (report: SavedBattleReport) => {
  combatReport.value = null
  requestAnimationFrame(() => {
    combatReport.value = report
  })
}

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

/** Résout le combat quand les troupes arrivent à destination.
 * Retourne les unités survivantes à remettre dans la garnison au retour. */
const executeCombat = (movement: TroopMovement, tile: MapTile): MovementUnit[] => {
  // Vérifier que la tuile est toujours hostile (peut avoir changé pendant le trajet)
  if (!['village_enemy', 'stronghold'].includes(tile.type)) {
    toastStore.addToast("La cible n'est plus hostile, troupes revenues.", 'info')
    return movement.units
  }

  const isStronghold = tile.type === 'stronghold'

  // Armée attaquante depuis le snapshot du mouvement (état au moment du départ)
  const attackerUnits: CombatUnit[] = movement.units.map((u) => ({
    type: u.type,
    count: u.count,
    attack: u.attack,
    defense: u.defense,
    health: u.health,
  }))

  // Construire les modificateurs issus des artefacts actifs (lus à la résolution)
  const equippedArtifacts = gameStore.getEquippedArtifacts.value
  const artifactModifiers: CombatModifier[] = []

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

  const hasFirstStrike = equippedArtifacts.some((a) => a.specialPower?.type === 'first_strike')
  if (hasFirstStrike) {
    artifactModifiers.push({
      id: 'artifact-first-strike',
      name: 'Frappe en premier',
      source: 'artifact',
      defenseMultiplier: 1.5,
    })
  }

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
    const siegeUnits = movement.units.filter((u) => u.type === 'siege')
    const hasSiegeUnit = siegeUnits.length > 0 && siegeUnits.some((u) => u.count > 0)
    const tileName = mapStore.getTileName(tile.type)

    if (hasSiegeUnit && tile.type === 'village_enemy') {
      // Village sans défenses : les machines de siège travaillent sans résistance
      // → destruction maximale garantie (toutes les machines = plein rendement)
      const siegeCount = siegeUnits.reduce((s, u) => s + u.count, 0)
      const destructionAmount = computeSiegeDestruction(siegeCount)
      const { newLevel, isRuined } = mapStore.applyVillageDestruction(tile.id, destructionAmount)

      if (isRuined) {
        toastStore.showSuccess('🏚️ Village sans défenses rasé par vos machines de siège !')
        gameStore.addCombatVictoryVp(`Victoire sans résistance — ${tileName}`)
        gameStore.addVillageVp(2, 'Village ennemi détruit')
      } else {
        toastStore.showSuccess(
          `🔥 Village sans défenses endommagé à ${newLevel}% — ${getDestructionLabel(newLevel)}`,
        )
        gameStore.addCombatVictoryVp(`Victoire sans résistance — ${tileName}`)
      }
    } else if (hasSiegeUnit && tile.type === 'stronghold') {
      // Forteresse sans garnison : destruction instantanée (même comportement qu'avant)
      tile.type = 'ruins'
      tile.garrison = undefined
      tile.lootStock = undefined
      mapStore.saveMapState()
      toastStore.showSuccess('🏰 Forteresse sans défenses détruite par vos machines de siège !')
    } else {
      toastStore.addToast(
        '⚠️ Ce village est sans défenses — équipez des armes de siège pour le détruire.',
        'info',
      )
    }

    // Rapport spécial "village vide"
    const currentDestructionLevel = (tile as { destructionLevel?: number }).destructionLevel ?? 0
    const emptyReport: SavedBattleReport = {
      id: `battle-${Date.now()}`,
      gameTimestamp: missionStore.getGameTimestamp(),
      tileId: tile.id,
      tileName,
      date: new Date().toISOString(),
      read: false,
      attackerVictory: hasSiegeUnit,
      summary: hasSiegeUnit
        ? `🏚️ ${tileName} sans défenses — machines de siège utilisées (destruction : ${currentDestructionLevel}%).`
        : `🏚️ Village ${tileName} sans défenses — aucun combat. Revenez avec des armes de siège pour le détruire.`,
      attacker: {
        army: { label: 'Vos troupes', units: [...movement.units], modifiers: [] },
        losses: { killed: {}, survivors: [...movement.units] },
        totalPowerUsed: 0,
      },
      defender: {
        army: { label: 'Garnison du village', units: [], modifiers: [] },
        losses: { killed: {}, survivors: [] },
        totalPowerUsed: 0,
      },
      extra: { emptyGarrison: true, siegeUsed: hasSiegeUnit, destructionLevel: currentDestructionLevel },
    }
    combatReport.value = null
    missionStore.addBattleReport(emptyReport)

    // Toast cliquable pour voir le rapport (village vide)
    const emptyToastMsg = hasSiegeUnit
      ? `🏚️ Village ${tileName} démoli — cliquez pour voir le rapport`
      : `🏚️ Village ${tileName} sans défenses — cliquez pour voir le rapport`
    toastStore.addToast(emptyToastMsg, hasSiegeUnit ? 'success' : 'info', {
      duration: 6000,
      onClick: () => {
        combatReport.value = emptyReport
      },
    })

    mapStore.saveMapState()
    missionStore.saveMissionState()
    return movement.units // Pas de combat, toutes les troupes reviennent
  }

  const defenderArmy: Army = {
    label: isStronghold ? 'Garnison de la Forteresse' : 'Garnison du Village Ennemi',
    units: tile.garrison.units.filter((u) => u.count > 0),
    modifiers: [],
  }

  // Résoudre le combat
  const report = defaultResolver.resolve(attackerArmy, defenderArmy)

  // Consommer une utilisation des artefacts à durée limitée actifs
  equippedArtifacts
    .filter((a) => a.durability !== 'permanent')
    .forEach((a) => gameStore.consumeArtifactUse(a.id))

  // Mettre à jour la garnison ennemie avec les survivants
  tile.garrison.units = report.defender.losses.survivors
  tile.garrison.lastAttackedAt = missionStore.getGameTimestamp()

  // Si victoire
  if (report.attackerVictory) {
    // Vérifier si le joueur dispose d'armes de siège (nécessaires pour détruire un village)
    const hasSiegeUnit = movement.units.some((u) => u.type === 'siege')

    // --- Pillage (capacité limitée par le poids des survivants) ---
    const attackerSurvivors = report.attacker.losses.survivors
    const pillageResult = mapStore.pillageVillage(tile.id, attackerSurvivors)
    // Attacher le résultat au rapport pour l'afficher dans l'overlay
    report.pillage = pillageResult
    const { loot, carryCapacity, wasCapacityLimited, wasRecentlyPillaged } = pillageResult
    const lootTotal = loot.gold + loot.wood + loot.iron + loot.crop
    if (lootTotal > 0) {
      gameStore.addGold(loot.gold)
      missionStore.addResources({ wood: loot.wood, iron: loot.iron, crop: loot.crop })
      const lootMsg = `💰 Butin : ${loot.gold}or ${loot.wood}🪵 ${loot.iron}⚙️ ${loot.crop}🌾`
      toastStore.showSuccess(lootMsg)
      if (wasCapacityLimited) {
        toastStore.addToast(
          `🎒 Capacité de transport atteinte (${carryCapacity} ressources max avec vos survivants)`,
          'info',
        )
      }
      if (wasRecentlyPillaged) {
        toastStore.addToast('⚠️ Village récemment pillé — butin réduit de 50%', 'info')
      }
    }

    if (hasSiegeUnit) {
      if (isStronghold) {
        // Forteresse : destruction instantanée (objectif majeur — comportement conservé)
        tile.type = 'ruins'
        tile.garrison = undefined
        tile.lootStock = undefined
        toastStore.showSuccess(report.summary)
        gameStore.addCombatVictoryVp(`Victoire en combat contre ${defenderArmy.label}`)
        gameStore.addVictoryPoints('combat', 4, 'Forteresse ennemie détruite')
        // Déverrouiller les cadrans adjacents à la forteresse détruite
        const newChunks = mapStore.unlockAdjacentChunks(tile.id)
        if (newChunks.length > 0) {
          toastStore.showSuccess(
            `🗺️ ${newChunks.length} nouveau cadran${newChunks.length > 1 ? 's' : ''} découvert${newChunks.length > 1 ? 's' : ''} !`,
          )
        }
      } else {
        // Village : destruction progressive basée sur les machines de siège survivantes
        const siegeSurvivors = report.attacker.losses.survivors
          .filter((u) => u.type === 'siege')
          .reduce((s, u) => s + u.count, 0)
        const destructionAmount = computeSiegeDestruction(siegeSurvivors)
        const { newLevel, isRuined } = mapStore.applyVillageDestruction(tile.id, destructionAmount)
        report.siegeDestruction = destructionAmount

        if (isRuined) {
          // Destruction totale atteinte
          toastStore.showSuccess(
            `💥 Village rasé ! ${destructionAmount}% de dégâts de siège — total : 100%`,
          )
          gameStore.addCombatVictoryVp(`Victoire en combat contre ${defenderArmy.label}`)
          gameStore.addVillageVp(2, 'Village ennemi détruit')
        } else {
          // Destruction partielle : le village est endommagé mais pas encore rasé
          toastStore.showSuccess(
            `🔥 ${report.summary} — Village endommagé (${getDestructionLabel(newLevel)}, ${newLevel}%)`,
          )
          gameStore.addCombatVictoryVp(`Victoire en combat contre ${defenderArmy.label}`)
          // La garnison commence à régénérer (le village survit)
          tile.garrison.units = []
          tile.garrison.maxUnits = report.defender.army.units.map((u) => ({ ...u }))
          tile.garrison.regenStartedAt = Date.now()
        }
      }
    } else {
      // Sans armes de siège : la garnison est vaincue mais le village reste et commence à régénérer
      if (!tile.garrison) tile.garrison = { units: [] }
      tile.garrison.units = []
      tile.garrison.maxUnits = report.defender.army.units.map((u) => ({ ...u }))
      tile.garrison.regenStartedAt = Date.now()
      toastStore.showSuccess(report.summary + ' (sans siège — village non détruit)')
      // Victoire simple capée quelle que soit la cible (village ou forteresse)
      gameStore.addCombatVictoryVp(`Victoire en combat contre ${defenderArmy.label}`)
    }

    applyPostVictorySpecialPowers(equippedArtifacts, tile.position)
  } else {
    // Après défaite, si la garnison avait commencé à régénérer, on repart du niveau actuel
    if (tile.garrison && tile.garrison.units.length > 0) {
      tile.garrison.maxUnits = report.defender.army.units.map((u) => ({ ...u }))
      tile.garrison.regenStartedAt = undefined // Arrêter la régén en cours
    }
    toastStore.showError(report.summary)

    // Une défaite entame le leadership du joueur (le fail-state du jeu repose dessus).
    // On réutilise la pénalité déjà calculée pour la mission de campagne en cours si
    // disponible, sinon on retombe sur une pénalité par défaut selon le type de cible.
    const missionLeadershipPenalty = missionStore.missionState.currentMission?.losePenalty?.leadership
    const fallbackLeadershipLoss = isStronghold
      ? Math.floor(Math.random() * 101) + 150 // Forteresse : 150-250
      : Math.floor(Math.random() * 71) + 50 // Village ennemi : 50-120
    const leadershipLoss =
      missionLeadershipPenalty && missionLeadershipPenalty > 0
        ? missionLeadershipPenalty
        : fallbackLeadershipLoss

    gameStore.updateLeadership(leadershipLoss, 'lose')
    toastStore.showError(`👑 -${leadershipLoss} leadership (défaite)`)
  }

  // Augmenter l'hostilité de la forteresse responsable après tout combat
  mapStore.onEnemyTileAttacked(tile.id)
  // Replanifier le prochain raid (l'hostilité a pu atteindre le seuil hostile)
  gameStore.scheduleNextRaid()

  // Notifier le joueur si la forteresse passe en mode averti ou hostile
  const fortress =
    mapStore.getControllingFortress(tile.id) ?? (tile.type === 'stronghold' ? tile.id : null)
  if (fortress) {
    const zone = mapStore.getFortressZone(fortress)
    if (zone?.hostilityState === 'warned') {
      toastStore.showWarning('⚠️ Une forteresse ennemie surveille vos agissements (Avertie)')
    } else if (zone?.hostilityState === 'hostile') {
      toastStore.showError('🔴 Forteresse ennemie HOSTILE — des raids vont commencer !')
    }
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

  // Afficher un toast cliquable pour ouvrir le rapport
  const toastMsg = report.attackerVictory
    ? `⚔️ Victoire contre ${tileName} — cliquez pour voir le rapport`
    : `💀 Défaite contre ${tileName} — cliquez pour voir le rapport`
  const toastType = report.attackerVictory ? 'success' : 'error'
  toastStore.addToast(toastMsg, toastType, {
    duration: 8000,
    onClick: () => {
      combatReport.value = saved
    },
  })

  mapStore.saveMapState()
  missionStore.saveMissionState()

  // Retourner les survivants pour qu'ils soient remis dans la garnison au retour
  return report.attacker.losses.survivors
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
        toastStore.showSuccess(`✨ ${artifact.name} révèle les environs !`)
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
          toastStore.showSuccess(`💚 ${artifact.name} restaure ${totalRestored} unité(s) !`)
        }
        break
      }
    }
  }

  if (goldGained > 0) {
    gameStore.addGold(goldGained)
    toastStore.showSuccess(`💰 +${goldGained} or (reliques actives)`)
  }
  if (leadershipGained > 0) {
    gameStore.updateLeadership(leadershipGained, 'add')
    toastStore.showSuccess(`👑 +${leadershipGained} leadership (reliques actives)`)
  }
}

// Nœuds "élite" (voir mapGenerator.ts) ≈ 3x la récompense en or des combats classiques :
// la garnison doit être notablement plus forte pour que ce soit un vrai risque/récompense,
// pas juste de l'or gratuit. Constantes isolées ici pour être faciles à retrouver/ajuster.
const ELITE_GARRISON_COUNT_MULTIPLIER = 1.6
const ELITE_GARRISON_STAT_MULTIPLIER = 1.25

/** Génère une garnison ennemie selon le type de case (appelé une seule fois au 1er combat) */
function generateEnemyGarrison(tile: MapTile): { units: CombatUnit[] } {
  const isStronghold = tile.type === 'stronghold'
  const baseCount = isStronghold
    ? gameSettings.enemyStrongholdInfantry
    : gameSettings.enemyBaseInfantry
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

  const isEliteMission = missionStore.missionState.currentMission?.difficulty === 'elite'
  if (isEliteMission) {
    return {
      units: units.map((u) => ({
        ...u,
        count: Math.max(1, Math.round(u.count * ELITE_GARRISON_COUNT_MULTIPLIER)),
        attack: Math.round(u.attack * ELITE_GARRISON_STAT_MULTIPLIER),
        defense: Math.round(u.defense * ELITE_GARRISON_STAT_MULTIPLIER),
        health: Math.round(u.health * ELITE_GARRISON_STAT_MULTIPLIER),
      })),
    }
  }

  return { units }
}

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

// Timer pour forcer le rafraîchissement de l'affichage
let displayRefreshTimer: number | null = null
/** Timer de régénération du stock ennemi (Phase 2 — toutes les ENEMY_REGEN_INTERVAL_MS ms) */
let lootRegenTimer: number | null = null

// Lifecycle
onMounted(() => {
  // Charger l'état de la carte
  mapStore.loadMapState()

  // Charger et démarrer les services du mission store
  missionStore.loadMissionState()
  missionStore.startAllServices()

  // Timer Phase 2 — régénérer stock ennemi et garnisons
  lootRegenTimer = window.setInterval(() => {
    mapStore.tickLootRegen()
    mapStore.tickGarrisonRegen()
  }, ENEMY_REGEN_INTERVAL_MS)

  // Timer de résolution des mouvements de troupes + mise à jour horloge réactive
  displayRefreshTimer = window.setInterval(() => {
    now.value = Date.now()
    const arrivals = mapStore.getArrivedMovements()
    for (const movement of arrivals) {
      if (movement.isReturning) {
        // Troupes de retour : remettre les survivants dans la garnison
        const townUnits = missionStore.missionState.town.units
        for (const unit of movement.units) {
          if (unit.count <= 0) continue
          const existing = townUnits.find((u) => u.type === unit.type)
          if (existing) {
            existing.count += unit.count
          } else {
            const unitType = unit.type as MilitaryUnit['type']
            townUnits.push({
              id: `${unitType}-${Date.now()}`,
              type: unitType,
              count: unit.count,
              attack: unit.attack,
              defense: unit.defense,
              health: unit.health,
              cost: UNIT_DEFINITIONS[unitType].cost,
              trainingTime: UNIT_DEFINITIONS[unitType].baseTrainingTime,
            })
          }
        }
        missionStore.saveMissionState()
        toastStore.addToast('🏠 Vos troupes sont rentrées au village.', 'info')
        mapStore.resolveMovement(movement.id)
      } else {
        // Troupes à destination : résoudre le combat puis créer le mouvement de retour
        const tile = mapStore.getTileById(movement.targetTileId)
        const survivors = tile ? executeCombat(movement, tile) : movement.units
        const returnMs = movement.arrivalTime - movement.departureTime
        const totalReturnSec = Math.ceil(returnMs / 1000)
        const returnLabel =
          totalReturnSec >= 60
            ? `${Math.floor(totalReturnSec / 60)}m ${totalReturnSec % 60}s`
            : `${totalReturnSec}s`
        mapStore.createReturnMovement(movement, survivors)
        mapStore.resolveMovement(movement.id)
        toastStore.addToast(`↩️ Troupes en route vers la base — retour dans ${returnLabel}`, 'info')
      }
    }
  }, 1000)
})

onUnmounted(() => {
  if (displayRefreshTimer) clearInterval(displayRefreshTimer)
  if (lootRegenTimer) clearInterval(lootRegenTimer)
  missionStore.stopAllServices()
  mapStore.saveMapState()
})
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

/* Cercle SVG */
.raid-clock-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.raid-clock-svg {
  width: 64px;
  height: 64px;
  display: block;
}

.raid-clock-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.12);
  stroke-width: 3;
}

.raid-clock-progress {
  fill: none;
  stroke: #ef4444;
  stroke-width: 3;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 1s linear;
}

.raid-clock-inner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  pointer-events: none;
}

.raid-clock-icon {
  font-size: 1.4rem;
  line-height: 1;
}

.raid-clock-time {
  font-size: 0.6rem;
  color: #fca5a5;
  font-weight: bold;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
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

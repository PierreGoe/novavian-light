// Ticker d'exploration : résout en continu les mouvements de troupes, les combats et la
// régénération des garnisons/butins, indépendamment de la sous-vue Campagne actuellement
// affichée (Carte ou Village). L'état (`now`, `combatReport`) est déclaré au niveau module
// pour rester partagé même si le composable est appelé depuis plusieurs composants (par ex.
// LargeMapExplorationView.vue a besoin de lire `now`/`combatReport` sans redémarrer le ticker).
//
// IMPORTANT : `start()`/`stop()` ne doivent être appelés que depuis CampaignLayout.vue, qui
// reste monté en permanence tant que le joueur est dans la Campagne. Les appeler depuis un
// autre composant démarrerait un second intervalle en parallèle.
import { ref, watch } from 'vue'
import { useMapStore, type MapTile, type MovementUnit, type TroopMovement } from '@/stores/mapStore'
import { useMissionStore, type MilitaryUnit } from '@/stores/missionStore'
import { useGameStore, type Artifact } from '@/stores/gameStore'
import {
  defaultResolver,
  computeSiegeDestruction,
  getDestructionLabel,
} from '@/combat/combatResolver'
import { getUnitRole } from '@/combat/roles'
import type {
  Army,
  CombatModifier,
  CombatReport,
  CombatUnit,
  SavedBattleReport,
} from '@/combat/types'
import { ENEMY_REGEN_INTERVAL_MS } from '@/config'
import { gameSettings } from '@/stores/gameSettingsStore'
import { getVillageDev } from '@/game/timePressure'
import { useToastStore } from '@/stores/toastStore'
import router from '@/router'

/** Libellé de coordonnées « (x, y) » d'une tuile — pour situer les toasts sur la carte */
const coordsLabel = (tile: MapTile) => `(${tile.position.x}, ${tile.position.y})`

const now = ref(Date.now())
const combatReport = ref<CombatReport | null>(null)

// Nœuds "élite" (voir mapGenerator.ts) ≈ 3x la récompense en or des combats classiques :
// la garnison doit être notablement plus forte pour que ce soit un vrai risque/récompense,
// pas juste de l'or gratuit. Constantes isolées ici pour être faciles à retrouver/ajuster.
const ELITE_GARRISON_COUNT_MULTIPLIER = 1.6
const ELITE_GARRISON_STAT_MULTIPLIER = 1.25

let displayRefreshTimer: number | null = null
let lootRegenTimer: number | null = null
let pendingReportUnwatch: (() => void) | null = null

export function useExplorationTicker() {
  const mapStore = useMapStore()
  const missionStore = useMissionStore()
  const gameStore = useGameStore()
  const toastStore = useToastStore()

  /** Ouvre la fiche d'une tuile sur la carte (navigation inter-écrans depuis un toast) */
  const goToTile = (tileId: string) => {
    mapStore.selectTile(tileId)
    router.push({ name: 'campaign-map' })
  }

  /**
   * Génère une garnison ennemie selon le type de case (appelé une seule fois au 1er combat).
   * Les effectifs sont multipliés par le développement du village (pression du temps) —
   * `dev` est retourné pour être mémorisé dans `garrison.lastGrowthDev` (croissance future).
   * ⚠️ `estimateGarrisonStrength` (mapStore) miroite cette formule : recaler les deux ensemble.
   */
  function generateEnemyGarrison(tile: MapTile): { units: CombatUnit[]; dev: number } {
    const isStronghold = tile.type === 'stronghold'
    const baseCount = isStronghold
      ? gameSettings.enemyStrongholdInfantry
      : gameSettings.enemyBaseInfantry
    const variation = Math.floor(Math.random() * 3)

    let units: CombatUnit[] = [
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
      units = units.map((u) => ({
        ...u,
        count: Math.max(1, Math.round(u.count * ELITE_GARRISON_COUNT_MULTIPLIER)),
        attack: Math.round(u.attack * ELITE_GARRISON_STAT_MULTIPLIER),
        defense: Math.round(u.defense * ELITE_GARRISON_STAT_MULTIPLIER),
        health: Math.round(u.health * ELITE_GARRISON_STAT_MULTIPLIER),
      }))
    }

    // Pression du temps : plus la mission avance, plus les villages sont garnis
    // (effectifs seulement — les stats unitaires restent lisibles pour le joueur)
    const dev = getVillageDev(tile)
    if (dev > 1) {
      units = units.map((u) => ({ ...u, count: Math.max(1, Math.round(u.count * dev)) }))
    }

    return { units, dev }
  }

  /**
   * Applique les effets spéciaux déclenchés au moment de la victoire
   * (gold_on_victory, leadership_on_victory, fog_reveal_on_victory, healing_after_combat)
   */
  function applyPostVictorySpecialPowers(
    artifacts: Artifact[],
    position: { x: number; y: number },
  ) {
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
          let totalRestored = 0
          for (const unit of missionStore.missionState.town.units) {
            const restored = Math.floor(unit.count * (sp.value / 100))
            if (restored > 0) {
              missionStore.addUnits(unit.type, restored)
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

  /** Fouille des ruines à l'arrivée des troupes : trésor unique par ruine et par partie.
   * Retourne les unités inchangées (aucune perte — la fouille est sans combat). */
  function exploreRuins(movement: TroopMovement, tile: MapTile): MovementUnit[] {
    const loc = coordsLabel(tile)
    const loot = mapStore.lootRuinTreasure(tile.id)

    // Ruines déjà fouillées, ou village rasé pendant le trajet (ruines sans trésor)
    if (!loot) {
      toastStore.addToast(
        `🏛️ Ruines ${loc} — rien à fouiller, vos troupes font demi-tour.`,
        'info',
      )
      return movement.units
    }

    gameStore.addGold(loot.gold)
    missionStore.addResources({ wood: loot.wood, iron: loot.iron, crop: loot.crop })
    missionStore.saveMissionState()

    toastStore.showSuccess(
      `💎 Trésor découvert dans les ruines ${loc} ! 🪙 ${loot.gold} · 🪵 ${loot.wood} · ⚒️ ${loot.iron} · 🌾 ${loot.crop}`,
      { duration: 8000, onClick: () => goToTile(tile.id) },
    )
    return movement.units
  }

  /** Résout le combat quand les troupes arrivent à destination.
   * Retourne les unités survivantes à remettre dans la garnison au retour. */
  function executeCombat(movement: TroopMovement, tile: MapTile): MovementUnit[] {
    // Vérifier que la tuile est toujours hostile (peut avoir changé pendant le trajet)
    if (!['village_enemy', 'stronghold'].includes(tile.type)) {
      toastStore.addToast(
        `${mapStore.getTileName(tile.type)} ${coordsLabel(tile)} n'est plus hostile — troupes revenues.`,
        'info',
      )
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
      tile.garrison = { units: generated.units, lastGrowthDev: generated.dev }
    } else {
      // Pression du temps : la garnison a pu se développer depuis le dernier combat
      mapStore.applyVillageGrowth(tile)
    }

    // Si la garnison est vide (déjà vaincue)
    if (tile.garrison.units.length === 0 || tile.garrison.units.every((u) => u.count <= 0)) {
      const siegeUnits = movement.units.filter((u) => getUnitRole(u.type) === 'siege')
      const hasSiegeUnit = siegeUnits.length > 0 && siegeUnits.some((u) => u.count > 0)
      const tileName = mapStore.getTileName(tile.type)
      const loc = coordsLabel(tile)
      const vpBefore = gameStore.victoryPoints.value.combat

      // Un seul toast (cliquable vers le rapport) composé selon l'issue —
      // évite la rafale qui évince les toasts précédents (MAX_ACTIVE_TOASTS)
      let emptyToastMsg: string
      let emptyToastType: 'success' | 'info' = 'info'

      if (hasSiegeUnit && tile.type === 'village_enemy') {
        // Village sans défenses : les machines de siège travaillent sans résistance
        // → destruction maximale garantie (toutes les machines = plein rendement)
        const siegeCount = siegeUnits.reduce((s, u) => s + u.count, 0)
        const destructionAmount = computeSiegeDestruction(siegeCount)
        const { newLevel, isRuined } = mapStore.applyVillageDestruction(tile.id, destructionAmount)

        if (isRuined) {
          emptyToastMsg = `🏚️ Village ${loc} sans défenses rasé par vos machines de siège !`
          gameStore.addCombatVictoryVp(`Victoire sans résistance — ${tileName}`, tile.id)
          gameStore.addVillageVp(2, 'Village ennemi détruit', tile.id)
        } else {
          emptyToastMsg = `🔥 Village ${loc} sans défenses endommagé à ${newLevel}% — ${getDestructionLabel(newLevel)}`
          gameStore.addCombatVictoryVp(`Victoire sans résistance — ${tileName}`, tile.id)
        }
        emptyToastType = 'success'
      } else if (hasSiegeUnit && tile.type === 'stronghold') {
        // Forteresse sans garnison : destruction instantanée (même comportement qu'avant)
        tile.type = 'ruins'
        tile.garrison = undefined
        tile.lootStock = undefined
        mapStore.saveMapState()
        emptyToastMsg = `🏰 Forteresse ${loc} sans défenses détruite par vos machines de siège !`
        emptyToastType = 'success'
      } else {
        emptyToastMsg = `⚠️ ${tileName} ${loc} sans défenses — équipez des armes de siège pour le détruire.`
      }

      const vpGained = gameStore.victoryPoints.value.combat - vpBefore
      if (vpGained > 0) emptyToastMsg += ` (+${vpGained} PV)`

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
          ? `🏚️ ${tileName} ${loc} sans défenses — machines de siège utilisées (destruction : ${currentDestructionLevel}%).`
          : `🏚️ ${tileName} ${loc} sans défenses — aucun combat. Revenez avec des armes de siège pour le détruire.`,
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
        extra: {
          emptyGarrison: true,
          siegeUsed: hasSiegeUnit,
          destructionLevel: currentDestructionLevel,
        },
      }
      combatReport.value = null
      missionStore.addBattleReport(emptyReport)

      // Toast unique cliquable pour voir le rapport (cible vide)
      toastStore.addToast(`${emptyToastMsg} Cliquez pour voir le rapport.`, emptyToastType, {
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

    // Détails repris dans le toast final unique (butin, issue, PV, leadership) — le
    // détail complet (capacité, pillage récent…) reste visible dans le rapport sauvegardé
    let victoryNote = ''
    let defeatLeadershipLoss = 0

    // Si victoire
    if (report.attackerVictory) {
      const vpBefore = gameStore.victoryPoints.value.combat
      // Vérifier si le joueur dispose d'armes de siège (nécessaires pour détruire un village)
      const hasSiegeUnit = movement.units.some((u) => getUnitRole(u.type) === 'siege')

      // --- Pillage (capacité limitée par le poids des survivants) ---
      const attackerSurvivors = report.attacker.losses.survivors
      const pillageResult = mapStore.pillageVillage(tile.id, attackerSurvivors)
      // Attacher le résultat au rapport pour l'afficher dans l'overlay
      report.pillage = pillageResult
      const { loot } = pillageResult
      const lootTotal = loot.gold + loot.wood + loot.iron + loot.crop
      if (lootTotal > 0) {
        gameStore.addGold(loot.gold)
        missionStore.addResources({ wood: loot.wood, iron: loot.iron, crop: loot.crop })
      }

      if (hasSiegeUnit) {
        if (isStronghold) {
          // Forteresse : destruction instantanée (objectif majeur — comportement conservé)
          tile.type = 'ruins'
          tile.garrison = undefined
          tile.lootStock = undefined
          victoryNote = 'forteresse détruite'
          gameStore.addCombatVictoryVp(`Victoire en combat contre ${defenderArmy.label}`, tile.id)
          gameStore.addVictoryPoints('combat', 4, 'Forteresse ennemie détruite', tile.id)
          // Déverrouiller les cadrans adjacents à la forteresse détruite
          const newChunks = mapStore.unlockAdjacentChunks(tile.id)
          if (newChunks.length > 0) {
            toastStore.showSuccess(
              `🗺️ ${newChunks.length} nouveau cadran${newChunks.length > 1 ? 's' : ''} découvert${newChunks.length > 1 ? 's' : ''} ! Cliquez pour voir la carte.`,
              { onClick: () => router.push({ name: 'campaign-map' }) },
            )
          }
        } else {
          // Village : destruction progressive basée sur les machines de siège survivantes
          const siegeSurvivors = report.attacker.losses.survivors
            .filter((u) => getUnitRole(u.type) === 'siege')
            .reduce((s, u) => s + u.count, 0)
          const destructionAmount = computeSiegeDestruction(siegeSurvivors)
          const { newLevel, isRuined } = mapStore.applyVillageDestruction(
            tile.id,
            destructionAmount,
          )
          report.siegeDestruction = destructionAmount

          if (isRuined) {
            // Destruction totale atteinte
            victoryNote = `village rasé (${destructionAmount}% de dégâts de siège)`
            gameStore.addCombatVictoryVp(`Victoire en combat contre ${defenderArmy.label}`, tile.id)
            gameStore.addVillageVp(2, 'Village ennemi détruit', tile.id)
          } else {
            // Destruction partielle : le village est endommagé mais pas encore rasé
            victoryNote = `village endommagé à ${newLevel}% (${getDestructionLabel(newLevel)})`
            gameStore.addCombatVictoryVp(`Victoire en combat contre ${defenderArmy.label}`, tile.id)
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
        victoryNote = 'sans siège — village non détruit'
        // Victoire simple capée quelle que soit la cible (village ou forteresse)
        gameStore.addCombatVictoryVp(`Victoire en combat contre ${defenderArmy.label}`, tile.id)
      }

      // Compléments du toast final : butin emporté et PV réellement gagnés (plafonds déduits)
      const vpGained = gameStore.victoryPoints.value.combat - vpBefore
      const extras = [
        lootTotal > 0 ? `💰 ${lootTotal} ressources` : '',
        vpGained > 0 ? `+${vpGained} PV` : '',
      ].filter(Boolean)
      if (extras.length > 0) victoryNote += ` · ${extras.join(' · ')}`

      applyPostVictorySpecialPowers(equippedArtifacts, tile.position)
    } else {
      // Après défaite, si la garnison avait commencé à régénérer, on repart du niveau actuel
      if (tile.garrison && tile.garrison.units.length > 0) {
        tile.garrison.maxUnits = report.defender.army.units.map((u) => ({ ...u }))
        tile.garrison.regenStartedAt = undefined // Arrêter la régén en cours
      }

      // Une défaite entame le leadership du joueur (le fail-state du jeu repose dessus).
      // On réutilise la pénalité déjà calculée pour la mission de campagne en cours si
      // disponible, sinon on retombe sur une pénalité par défaut selon le type de cible.
      const missionLeadershipPenalty =
        missionStore.missionState.currentMission?.losePenalty?.leadership
      const fallbackLeadershipLoss = isStronghold
        ? Math.floor(Math.random() * 101) + 150 // Forteresse : 150-250
        : Math.floor(Math.random() * 71) + 50 // Village ennemi : 50-120
      const leadershipLoss =
        missionLeadershipPenalty && missionLeadershipPenalty > 0
          ? missionLeadershipPenalty
          : fallbackLeadershipLoss

      gameStore.updateLeadership(leadershipLoss, 'lose')
      // Repris dans le toast final unique (le détail des pertes est dans le rapport)
      defeatLeadershipLoss = leadershipLoss
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
      const fortressTile = mapStore.getTileById(fortress)
      const fortressLoc = fortressTile ? ` ${coordsLabel(fortressTile)}` : ''
      if (zone?.hostilityState === 'warned') {
        toastStore.showWarning(
          `⚠️ La forteresse${fortressLoc} surveille vos agissements (Avertie) — cliquez pour la voir`,
          { onClick: () => goToTile(fortress) },
        )
      } else if (zone?.hostilityState === 'hostile') {
        toastStore.showError(
          `🔴 Forteresse${fortressLoc} HOSTILE — des raids vont commencer ! Cliquez pour la voir`,
          { onClick: () => goToTile(fortress) },
        )
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

    // Toast final unique, cliquable pour ouvrir le rapport — il porte l'issue, le
    // butin, les PV ou la perte de leadership (le détail complet est dans le rapport)
    const toastMsg = report.attackerVictory
      ? `⚔️ Victoire contre ${tileName} ${coordsLabel(tile)}${victoryNote ? ` — ${victoryNote}` : ''} — cliquez pour voir le rapport`
      : `💀 Défaite contre ${tileName} ${coordsLabel(tile)} — 👑 -${defeatLeadershipLoss} leadership — cliquez pour voir le rapport`
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

  const start = () => {
    if (displayRefreshTimer || lootRegenTimer) return // déjà démarré

    // Ouvrir un rapport quand le store le demande (clic sur toast de raid)
    pendingReportUnwatch = watch(
      () => missionStore.pendingReportToOpen.value,
      (report) => {
        if (report) {
          combatReport.value = report
          missionStore.consumePendingReport()
        }
      },
    )

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
          for (const unit of movement.units) {
            missionStore.addUnits(unit.type as MilitaryUnit['type'], unit.count)
          }
          missionStore.saveMissionState()
          toastStore.addToast('🏠 Vos troupes sont rentrées au village.', 'info', {
            onClick: () => router.push({ name: 'campaign-village' }),
          })
          mapStore.resolveMovement(movement.id)
        } else {
          // Troupes à destination : résoudre l'action (fouille de ruines ou combat)
          // puis créer le mouvement de retour
          const tile = mapStore.getTileById(movement.targetTileId)
          const survivors = !tile
            ? movement.units
            : tile.type === 'ruins'
              ? exploreRuins(movement, tile)
              : executeCombat(movement, tile)
          const returnMs = movement.arrivalTime - movement.departureTime
          const totalReturnSec = Math.ceil(returnMs / 1000)
          const returnLabel =
            totalReturnSec >= 60
              ? `${Math.floor(totalReturnSec / 60)}m ${totalReturnSec % 60}s`
              : `${totalReturnSec}s`
          mapStore.createReturnMovement(movement, survivors)
          mapStore.resolveMovement(movement.id)
          // Situer l'origine du retour (la tuile peut être devenue des ruines après le combat)
          const originLabel = tile ? ` depuis ${mapStore.getTileName(tile.type)} ${coordsLabel(tile)}` : ''
          toastStore.addToast(
            `↩️ Troupes en route vers la base${originLabel} — retour dans ${returnLabel}`,
            'info',
          )
        }
      }
    }, 1000)
  }

  const stop = () => {
    if (displayRefreshTimer) {
      clearInterval(displayRefreshTimer)
      displayRefreshTimer = null
    }
    if (lootRegenTimer) {
      clearInterval(lootRegenTimer)
      lootRegenTimer = null
    }
    if (pendingReportUnwatch) {
      pendingReportUnwatch()
      pendingReportUnwatch = null
    }
  }

  return { now, combatReport, start, stop }
}

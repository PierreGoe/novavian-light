/**
 * Source unique de vérité pour tous les bâtiments de la ville de mission.
 * Centralise : niveaux max, tables de coûts d'amélioration, temps de construction,
 * gains de production, prérequis (bâtiment principal) et métadonnées d'affichage.
 *
 * Chaque bâtiment possède une table `levels` de 10 entrées max.
 * L'index i correspond au coût pour passer du niveau i au niveau i+1.
 * Les niveaux supérieurs à 10 utilisent la dernière entrée de la table.
 */

import type { TravianResources } from '@/stores/missionStore'

// Types de bâtiments disponibles
export type BuildingType =
  | 'headquarters' // Bâtiment principal — débloque les autres
  | 'barracks' // Casernes — entraîne l'infanterie / archers / cavalerie / siège
  | 'lumbermill' // Scierie — produit du bois
  | 'farm' // Ferme — produit des céréales
  | 'quarry' // Carrière — produit de l'argile (nécessite HQ niv. 4)
  | 'mine' // Mine de fer — produit du fer (nécessite HQ niv. 4)
  | 'wall' // Mur d'enceinte — bonus de défense contre les raids ennemis

// Entrée d'un niveau dans la table d'upgrade
export interface UpgradeLevelEntry {
  wood: number
  clay: number
  iron: number
  crop: number
  /** Temps de construction en secondes */
  buildTime: number
}

// Métadonnées statiques d'un bâtiment
export interface BuildingDefinition {
  type: BuildingType
  name: string
  icon: string
  description: string
  maxLevel: number
  /** Niveau requis du bâtiment principal (headquarters) pour construire / améliorer */
  hqLevelRequired: number
  /**
   * Table de coûts indexée par niveau actuel (max 10 entrées).
   * levels[0] = coût de construction (niv 0 → 1)
   * levels[i] = coût pour passer du niveau i au niveau i+1
   */
  levels: UpgradeLevelEntry[]
  /** Production par minute ajoutée à chaque niveau (null si pas de production) */
  productionPerLevel: { resource: keyof TravianResources; amount: number } | null
}

// Définitions complètes de tous les bâtiments
export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  headquarters: {
    type: 'headquarters',
    name: 'Bâtiment Principal',
    icon: '🏰',
    description: 'Centre de commandement. Son niveau débloque de nouveaux bâtiments.',
    maxLevel: 10,
    hqLevelRequired: 0,
    // prettier-ignore
    // Coûts légers — QG = étape de déblocage, pas un obstacle (÷6 vs originaux)
    levels: [
      { wood:   35, clay:   25, iron:   17, crop:   13, buildTime:    15 }, // 0 → 1
      { wood:   70, clay:   55, iron:   35, crop:   28, buildTime:    30 }, // 1 → 2
      { wood:  125, clay:   95, iron:   63, crop:   50, buildTime:    60 }, // 2 → 3
      { wood:  200, clay:  150, iron:  100, crop:   80, buildTime:   120 }, // 3 → 4
      { wood:  300, clay:  225, iron:  150, crop:  120, buildTime:   240 }, // 4 → 5
      { wood:  435, clay:  325, iron:  215, crop:  175, buildTime:   480 }, // 5 → 6
      { wood:  620, clay:  465, iron:  310, crop:  245, buildTime:   900 }, // 6 → 7
      { wood:  865, clay:  650, iron:  435, crop:  345, buildTime:  1800 }, // 7 → 8
      { wood: 1200, clay:  900, iron:  600, crop:  480, buildTime:  3000 }, // 8 → 9
      { wood: 1630, clay: 1225, iron:  815, crop:  650, buildTime:  6000 }, // 9 → 10
    ],
    productionPerLevel: null,
  },

  barracks: {
    type: 'barracks',
    name: 'Casernes',
    icon: '🏛️',
    description: "Forme les troupes. Un niveau plus élevé réduit le temps d'entraînement.",
    maxLevel: 20,
    hqLevelRequired: 3,
    // prettier-ignore
    levels: [
      { wood:  120, clay:   80, iron:  100, crop:   50, buildTime:    45 }, // 0 → 1
      { wood:  250, clay:  170, iron:  210, crop:  105, buildTime:    90 }, // 1 → 2
      { wood:  420, clay:  280, iron:  350, crop:  175, buildTime:   180 }, // 2 → 3
      { wood:  650, clay:  430, iron:  540, crop:  270, buildTime:   360 }, // 3 → 4
      { wood:  950, clay:  630, iron:  790, crop:  395, buildTime:   720 }, // 4 → 5
      { wood: 1300, clay:  870, iron: 1090, crop:  545, buildTime:  1440 }, // 5 → 6
      { wood: 1750, clay: 1170, iron: 1460, crop:  730, buildTime:  2700 }, // 6 → 7
      { wood: 2300, clay: 1530, iron: 1920, crop:  960, buildTime:  4500 }, // 7 → 8
      { wood: 3000, clay: 2000, iron: 2500, crop: 1250, buildTime:  7200 }, // 8 → 9
      { wood: 3900, clay: 2600, iron: 3250, crop: 1625, buildTime: 10800 }, // 9 → 10
    ],
    productionPerLevel: null,
  },

  lumbermill: {
    type: 'lumbermill',
    name: 'Scierie',
    icon: '🪓',
    description: 'Produit du bois. Chaque niveau augmente la production.',
    maxLevel: 20,
    hqLevelRequired: 1,
    // Coût principal : argile + fer (pas de bois — c'est justement ce qui manque)
    // prettier-ignore
    // Coûts ÷3 pour parties 10-15 min
    levels: [
      { wood:   8, clay:  40, iron:  22, crop:  15, buildTime:   7 }, // 0 → 1
      { wood:  18, clay:  85, iron:  45, crop:  32, buildTime:  15 }, // 1 → 2
      { wood:  30, clay: 143, iron:  77, crop:  53, buildTime:  30 }, // 2 → 3
      { wood:  47, clay: 223, iron: 120, crop:  83, buildTime:  60 }, // 3 → 4
      { wood:  68, clay: 330, iron: 177, crop: 123, buildTime: 120 }, // 4 → 5
      { wood:  97, clay: 462, iron: 247, crop: 173, buildTime: 240 }, // 5 → 6
      { wood: 132, clay: 633, iron: 337, crop: 237, buildTime: 480 }, // 6 → 7
      { wood: 177, clay: 847, iron: 452, crop: 317, buildTime: 900 }, // 7 → 8
      { wood: 235, clay: 1120, iron: 597, crop: 418, buildTime: 1500 }, // 8 → 9
      { wood: 308, clay: 1470, iron: 783, crop: 550, buildTime: 2400 }, // 9 → 10
    ],
    // Rééquilibrage : la production totale de départ (toutes ressources) était gonflée par
    // un multiplicateur "mission mode ×3" codé en dur dans missionStore.ts, désormais retiré.
    // Ces montants sont la valeur "×3" divisée par 3 (100/96/72/120 par ressource) — l'ordre
    // de grandeur d'origine, avant le bug — répartis en amount/niveau ici.
    productionPerLevel: { resource: 'wood', amount: 100 },
  },

  farm: {
    type: 'farm',
    name: 'Ferme',
    icon: '🌾',
    description: 'Produit des céréales. Chaque niveau augmente la production.',
    maxLevel: 20,
    hqLevelRequired: 1,
    // Coût principal : bois + argile (peu de céréales — c'est justement ce qui manque)
    // prettier-ignore
    // Coûts ÷3 pour parties 10-15 min
    levels: [
      { wood:  27, clay:  32, iron:  13, crop:   5, buildTime:   7 }, // 0 → 1
      { wood:  57, clay:  67, iron:  28, crop:  10, buildTime:  15 }, // 1 → 2
      { wood:  95, clay: 113, iron:  48, crop:  18, buildTime:  30 }, // 2 → 3
      { wood: 148, clay: 177, iron:  75, crop:  28, buildTime:  60 }, // 3 → 4
      { wood: 217, clay: 260, iron: 110, crop:  42, buildTime: 120 }, // 4 → 5
      { wood: 305, clay: 365, iron: 155, crop:  58, buildTime: 240 }, // 5 → 6
      { wood: 417, clay: 498, iron: 212, crop:  80, buildTime: 480 }, // 6 → 7
      { wood: 557, clay: 665, iron: 283, crop: 107, buildTime: 900 }, // 7 → 8
      { wood: 737, clay: 880, iron: 375, crop: 142, buildTime: 1500 }, // 8 → 9
      { wood: 968, clay: 1158, iron: 493, crop: 187, buildTime: 2400 }, // 9 → 10
    ],
    productionPerLevel: { resource: 'crop', amount: 120 },
  },

  quarry: {
    type: 'quarry',
    name: 'Carrière',
    icon: '🗿',
    description: "Produit de l'argile. Nécessite le Bâtiment Principal niveau 4.",
    maxLevel: 20,
    hqLevelRequired: 1,
    // Coût principal : bois + fer (peu d'argile — c'est justement ce qui manque)
    // prettier-ignore
    // Coûts ÷3 pour parties 10-15 min
    levels: [
      { wood:  38, clay:   7, iron:  32, crop:  20, buildTime:   8 }, // 0 → 1
      { wood:  80, clay:  14, iron:  67, crop:  42, buildTime:  18 }, // 1 → 2
      { wood: 137, clay:  23, iron: 113, crop:  70, buildTime:  37 }, // 2 → 3
      { wood: 213, clay:  37, iron: 177, crop: 110, buildTime:  73 }, // 3 → 4
      { wood: 310, clay:  53, iron: 258, crop: 160, buildTime: 147 }, // 4 → 5
      { wood: 435, clay:  75, iron: 362, crop: 225, buildTime: 293 }, // 5 → 6
      { wood: 593, clay: 102, iron: 493, crop: 307, buildTime: 587 }, // 6 → 7
      { wood: 793, clay: 137, iron: 660, crop: 410, buildTime: 1173 }, // 7 → 8
      { wood: 1050, clay: 180, iron: 873, crop: 543, buildTime: 1920 }, // 8 → 9
      { wood: 1378, clay: 237, iron: 1147, crop: 713, buildTime: 2880 }, // 9 → 10
    ],
    productionPerLevel: { resource: 'clay', amount: 96 },
  },

  mine: {
    type: 'mine',
    name: 'Mine de Fer',
    icon: '⛏️',
    description: 'Produit du fer. Nécessite le Bâtiment Principal niveau 4.',
    maxLevel: 20,
    hqLevelRequired: 1,
    // Coût principal : bois + argile (peu de fer — c'est justement ce qui manque)
    // prettier-ignore
    // Coûts ÷3 pour parties 10-15 min
    levels: [
      { wood:  43, clay:  35, iron:   6, crop:  15, buildTime:   8 }, // 0 → 1
      { wood:  92, clay:  73, iron:  13, crop:  32, buildTime:  18 }, // 1 → 2
      { wood: 155, clay: 125, iron:  21, crop:  53, buildTime:  37 }, // 2 → 3
      { wood: 242, clay: 195, iron:  33, crop:  83, buildTime:  73 }, // 3 → 4
      { wood: 353, clay: 285, iron:  49, crop: 122, buildTime: 147 }, // 4 → 5
      { wood: 495, clay: 398, iron:  68, crop: 172, buildTime: 293 }, // 5 → 6
      { wood: 675, clay: 543, iron:  93, crop: 233, buildTime: 587 }, // 6 → 7
      { wood: 903, clay: 727, iron: 125, crop: 313, buildTime: 1173 }, // 7 → 8
      { wood: 1197, clay: 960, iron: 165, crop: 415, buildTime: 1920 }, // 8 → 9
      { wood: 1573, clay: 1262, iron: 217, crop: 545, buildTime: 2880 }, // 9 → 10
    ],
    productionPerLevel: { resource: 'iron', amount: 72 },
  },

  wall: {
    type: 'wall',
    name: "Mur d'enceinte",
    icon: '🧱',
    description:
      'Protège la ville : +8 % de défense par niveau pour vos troupes lors des raids ennemis.',
    maxLevel: 10,
    hqLevelRequired: 2,
    // Coût principal : argile + bois (matériaux de fortification)
    // prettier-ignore
    levels: [
      { wood:  70, clay:  110, iron:  40, crop:  25, buildTime:   30 }, // 0 → 1
      { wood: 115, clay:  180, iron:  65, crop:  40, buildTime:   60 }, // 1 → 2
      { wood: 185, clay:  290, iron: 105, crop:  65, buildTime:  120 }, // 2 → 3
      { wood: 295, clay:  465, iron: 170, crop: 105, buildTime:  240 }, // 3 → 4
      { wood: 470, clay:  745, iron: 270, crop: 170, buildTime:  480 }, // 4 → 5
      { wood: 750, clay: 1190, iron: 430, crop: 270, buildTime:  900 }, // 5 → 6
      { wood: 1200, clay: 1905, iron: 690, crop: 430, buildTime: 1500 }, // 6 → 7
      { wood: 1920, clay: 3050, iron: 1105, crop: 690, buildTime: 2400 }, // 7 → 8
      { wood: 3075, clay: 4880, iron: 1765, crop: 1105, buildTime: 3600 }, // 8 → 9
      { wood: 4920, clay: 7805, iron: 2825, crop: 1765, buildTime: 5400 }, // 9 → 10
    ],
    productionPerLevel: null,
  },
}

/** Bonus de défense du mur d'enceinte appliqué aux troupes en ville : +8 % par niveau */
export const WALL_DEFENSE_BONUS_PER_LEVEL = 0.08

/** Niveau actuel du mur d'enceinte (0 = pas de mur ou premier chantier pas fini) */
export const getWallLevel = (buildings: { type: string; level: number }[]): number =>
  buildings.find((b) => b.type === 'wall')?.level ?? 0

/** Multiplicateur de défense conféré par le mur (1 = pas de bonus) */
export const getWallDefenseMultiplier = (buildings: { type: string; level: number }[]): number =>
  1 + getWallLevel(buildings) * WALL_DEFENSE_BONUS_PER_LEVEL

/**
 * Retourne l'entrée de la table de niveaux pour un bâtiment et un niveau donné.
 * Si le niveau dépasse la table (max 10 entrées), retourne la dernière entrée.
 * Retourne une entrée vide si le bâtiment est inconnu.
 */
export const getBuildingUpgrade = (type: BuildingType, level: number): UpgradeLevelEntry => {
  const def = BUILDING_DEFINITIONS[type]
  if (!def || def.levels.length === 0) {
    return { wood: 0, clay: 0, iron: 0, crop: 0, buildTime: 0 }
  }
  const idx = Math.max(0, Math.min(level, def.levels.length - 1))
  return def.levels[idx]
}

/**
 * Retourne le niveau du bâtiment principal dans une liste de bâtiments.
 */
export const getHQLevel = (buildings: { type: string; level: number }[]): number => {
  return buildings.find((b) => b.type === 'headquarters')?.level ?? 0
}

/**
 * Vérifie si un bâtiment peut être amélioré selon le niveau HQ actuel et le niveau max.
 */
export const canBuildingBeUpgraded = (
  buildingType: BuildingType,
  currentLevel: number,
  hqLevel: number,
): boolean => {
  const def = BUILDING_DEFINITIONS[buildingType]
  if (!def) return false
  if (currentLevel >= def.maxLevel) return false
  // Pour améliorer, le HQ doit être au moins au niveau requis
  // (le bâtiment existe déjà, donc on vérifie juste le max level)
  return hqLevel >= def.hqLevelRequired
}

/**
 * Vérifie si un bâtiment peut être construit (n'existe pas encore).
 * Le HQ doit atteindre hqLevelRequired pour débloquer le bâtiment.
 */
export const isBuildingUnlocked = (buildingType: BuildingType, hqLevel: number): boolean => {
  return hqLevel >= BUILDING_DEFINITIONS[buildingType].hqLevelRequired
}

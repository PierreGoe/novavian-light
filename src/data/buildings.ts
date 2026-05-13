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
    levels: [
      { wood:  200, clay:  150, iron:  100, crop:   80, buildTime:    30 }, // 0 → 1
      { wood:  420, clay:  320, iron:  210, crop:  170, buildTime:    75 }, // 1 → 2
      { wood:  750, clay:  560, iron:  375, crop:  300, buildTime:   180 }, // 2 → 3
      { wood: 1200, clay:  900, iron:  600, crop:  480, buildTime:   360 }, // 3 → 4
      { wood: 1800, clay: 1350, iron:  900, crop:  720, buildTime:   720 }, // 4 → 5
      { wood: 2600, clay: 1950, iron: 1300, crop: 1040, buildTime:  1440 }, // 5 → 6
      { wood: 3700, clay: 2800, iron: 1850, crop: 1480, buildTime:  2700 }, // 6 → 7
      { wood: 5200, clay: 3900, iron: 2600, crop: 2080, buildTime:  5400 }, // 7 → 8
      { wood: 7200, clay: 5400, iron: 3600, crop: 2880, buildTime:  9000 }, // 8 → 9
      { wood: 9800, clay: 7350, iron: 4900, crop: 3920, buildTime: 18000 }, // 9 → 10
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
    levels: [
      { wood:   25, clay:  120, iron:   65, crop:   45, buildTime:   20 }, // 0 → 1
      { wood:   55, clay:  255, iron:  135, crop:   95, buildTime:   45 }, // 1 → 2
      { wood:   90, clay:  430, iron:  230, crop:  160, buildTime:   90 }, // 2 → 3
      { wood:  140, clay:  670, iron:  360, crop:  250, buildTime:  180 }, // 3 → 4
      { wood:  205, clay:  990, iron:  530, crop:  370, buildTime:  360 }, // 4 → 5
      { wood:  290, clay: 1385, iron:  740, crop:  520, buildTime:  720 }, // 5 → 6
      { wood:  395, clay: 1900, iron: 1010, crop:  710, buildTime: 1440 }, // 6 → 7
      { wood:  530, clay: 2540, iron: 1355, crop:  950, buildTime: 2700 }, // 7 → 8
      { wood:  705, clay: 3360, iron: 1790, crop: 1255, buildTime: 4500 }, // 8 → 9
      { wood:  925, clay: 4410, iron: 2350, crop: 1650, buildTime: 7200 }, // 9 → 10
    ],
    productionPerLevel: { resource: 'wood', amount: 10 },
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
    levels: [
      { wood:   80, clay:   95, iron:   40, crop:   15, buildTime:   20 }, // 0 → 1
      { wood:  170, clay:  200, iron:   85, crop:   30, buildTime:   45 }, // 1 → 2
      { wood:  285, clay:  340, iron:  145, crop:   55, buildTime:   90 }, // 2 → 3
      { wood:  445, clay:  530, iron:  225, crop:   85, buildTime:  180 }, // 3 → 4
      { wood:  650, clay:  780, iron:  330, crop:  125, buildTime:  360 }, // 4 → 5
      { wood:  915, clay: 1095, iron:  465, crop:  175, buildTime:  720 }, // 5 → 6
      { wood: 1250, clay: 1495, iron:  635, crop:  240, buildTime: 1440 }, // 6 → 7
      { wood: 1670, clay: 1995, iron:  850, crop:  320, buildTime: 2700 }, // 7 → 8
      { wood: 2210, clay: 2640, iron: 1125, crop:  425, buildTime: 4500 }, // 8 → 9
      { wood: 2905, clay: 3475, iron: 1480, crop:  560, buildTime: 7200 }, // 9 → 10
    ],
    productionPerLevel: { resource: 'crop', amount: 12 },
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
    levels: [
      { wood:  115, clay:   20, iron:   95, crop:   60, buildTime:   25 }, // 0 → 1
      { wood:  240, clay:   42, iron:  200, crop:  125, buildTime:   55 }, // 1 → 2
      { wood:  410, clay:   70, iron:  340, crop:  210, buildTime:  110 }, // 2 → 3
      { wood:  640, clay:  110, iron:  530, crop:  330, buildTime:  220 }, // 3 → 4
      { wood:  930, clay:  160, iron:  775, crop:  480, buildTime:  440 }, // 4 → 5
      { wood: 1305, clay:  225, iron: 1085, crop:  675, buildTime:  880 }, // 5 → 6
      { wood: 1780, clay:  305, iron: 1480, crop:  920, buildTime: 1760 }, // 6 → 7
      { wood: 2380, clay:  410, iron: 1980, crop: 1230, buildTime: 3520 }, // 7 → 8
      { wood: 3150, clay:  540, iron: 2620, crop: 1630, buildTime: 5760 }, // 8 → 9
      { wood: 4135, clay:  710, iron: 3440, crop: 2140, buildTime: 8640 }, // 9 → 10
    ],
    productionPerLevel: { resource: 'clay', amount: 8 },
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
    levels: [
      { wood:  130, clay:  105, iron:   18, crop:   45, buildTime:   25 }, // 0 → 1
      { wood:  275, clay:  220, iron:   38, crop:   95, buildTime:   55 }, // 1 → 2
      { wood:  465, clay:  375, iron:   64, crop:  160, buildTime:  110 }, // 2 → 3
      { wood:  725, clay:  585, iron:  100, crop:  250, buildTime:  220 }, // 3 → 4
      { wood: 1060, clay:  855, iron:  146, crop:  365, buildTime:  440 }, // 4 → 5
      { wood: 1485, clay: 1195, iron:  205, crop:  515, buildTime:  880 }, // 5 → 6
      { wood: 2025, clay: 1630, iron:  280, crop:  700, buildTime: 1760 }, // 6 → 7
      { wood: 2710, clay: 2180, iron:  374, crop:  940, buildTime: 3520 }, // 7 → 8
      { wood: 3590, clay: 2880, iron:  495, crop: 1245, buildTime: 5760 }, // 8 → 9
      { wood: 4720, clay: 3785, iron:  650, crop: 1635, buildTime: 8640 }, // 9 → 10
    ],
    productionPerLevel: { resource: 'iron', amount: 6 },
  },
}

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

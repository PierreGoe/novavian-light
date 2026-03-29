/**
 * Source unique de vérité pour tous les bâtiments de la ville de mission.
 * Centralise : niveaux max, coûts d'amélioration, gains de production,
 * prérequis (bâtiment principal) et métadonnées d'affichage.
 */

import type { TravianResources } from '@/stores/missionStore'

// Types de bâtiments disponibles
export type BuildingType =
  | 'headquarters' // Bâtiment principal — débloque les autres
  | 'barracks'    // Casernes — entraîne l'infanterie / archers / cavalerie / siège
  | 'lumbermill'  // Scierie — produit du bois
  | 'farm'        // Ferme — produit des céréales
  | 'quarry'      // Carrière — produit de l'argile (nécessite HQ niv. 4)
  | 'mine'        // Mine de fer — produit du fer (nécessite HQ niv. 4)

// Métadonnées statiques d'un bâtiment
export interface BuildingDefinition {
  type: BuildingType
  name: string
  icon: string
  description: string
  maxLevel: number
  /** Niveau requis du bâtiment principal (headquarters) pour construire / améliorer */
  hqLevelRequired: number
  /** Calcule le coût d'amélioration vers le prochain niveau (level = niveau actuel) */
  upgradeCost: (level: number) => TravianResources
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
    hqLevelRequired: 0, // Toujours disponible
    upgradeCost: (level) => ({
      wood: level * 200,
      clay: level * 150,
      iron: level * 100,
      crop: level * 80,
    }),
    productionPerLevel: null,
  },

  barracks: {
    type: 'barracks',
    name: 'Casernes',
    icon: '🏛️',
    description: 'Forme les troupes. Un niveau plus élevé réduit le temps d\'entraînement.',
    maxLevel: 20,
    hqLevelRequired: 1,
    upgradeCost: (level) => ({
      wood: level * 120,
      clay: level * 80,
      iron: level * 100,
      crop: level * 50,
    }),
    productionPerLevel: null,
  },

  lumbermill: {
    type: 'lumbermill',
    name: 'Scierie',
    icon: '🪓',
    description: 'Produit du bois. Chaque niveau augmente la production.',
    maxLevel: 20,
    hqLevelRequired: 1,
    upgradeCost: (level) => ({
      wood: level * 80,
      clay: level * 100,
      iron: level * 40,
      crop: level * 30,
    }),
    productionPerLevel: { resource: 'wood', amount: 10 },
  },

  farm: {
    type: 'farm',
    name: 'Ferme',
    icon: '🌾',
    description: 'Produit des céréales. Chaque niveau augmente la production.',
    maxLevel: 20,
    hqLevelRequired: 1,
    upgradeCost: (level) => ({
      wood: level * 60,
      clay: level * 80,
      iron: level * 30,
      crop: level * 50,
    }),
    productionPerLevel: { resource: 'crop', amount: 12 },
  },

  quarry: {
    type: 'quarry',
    name: 'Carrière',
    icon: '🗿',
    description: 'Produit de l\'argile. Nécessite le Bâtiment Principal niveau 4.',
    maxLevel: 20,
    hqLevelRequired: 4,
    upgradeCost: (level) => ({
      wood: level * 90,
      clay: level * 60,
      iron: level * 70,
      crop: level * 40,
    }),
    productionPerLevel: { resource: 'clay', amount: 8 },
  },

  mine: {
    type: 'mine',
    name: 'Mine de Fer',
    icon: '⛏️',
    description: 'Produit du fer. Nécessite le Bâtiment Principal niveau 4.',
    maxLevel: 20,
    hqLevelRequired: 4,
    upgradeCost: (level) => ({
      wood: level * 100,
      clay: level * 80,
      iron: level * 50,
      crop: level * 35,
    }),
    productionPerLevel: { resource: 'iron', amount: 6 },
  },
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

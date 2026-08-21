import type { BuildingType } from './buildings'

/**
 * Disposition de l'arbre du village : le Bâtiment Principal au centre (hub),
 * les 6 autres bâtiments en branches hexagonales autour de lui (angle en
 * degrés, 0 = haut, sens horaire). Rendu dans VillageSkillTree.vue — angle
 * est ignoré pour l'entrée isCenter.
 */
export interface VillageNodeLayout {
  type: BuildingType
  angle: number
  isCenter?: boolean
}

export const VILLAGE_LAYOUT: VillageNodeLayout[] = [
  { type: 'wall', angle: 0 },
  { type: 'farm', angle: 60 },
  { type: 'mine', angle: 120 },
  { type: 'barracks', angle: 180 },
  { type: 'quarry', angle: 240 },
  { type: 'lumbermill', angle: 300 },
  { type: 'headquarters', angle: 0, isCenter: true },
]

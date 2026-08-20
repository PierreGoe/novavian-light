import type { MapNode } from '@/stores/gameStore'
import { GRID_COLUMNS } from './mapGenerator'

// Géométrie partagée de la grille de la carte de mission — utilisée à la fois pour positionner
// les nœuds (MissionMapLayer.vue) et pour tracer les connexions (MissionTree.vue), afin que les
// deux restent toujours parfaitement alignés.
export const SLOT_WIDTH = 100
export const ROW_HEIGHT = 110
export const MAP_WIDTH = SLOT_WIDTH * GRID_COLUMNS

// Arrondi au pixel entier : le jitter produit des positions fractionnaires qui font
// baver les bordures fines (anticrénelage à cheval sur deux pixels, visible en DPR 1).
export const nodeCenterX = (node: Pick<MapNode, 'col' | 'jitterX'>): number =>
  Math.round((node.col + 0.5) * SLOT_WIDTH + (node.jitterX ?? 0) * SLOT_WIDTH)

export const nodeCenterY = (row: number): number => row * ROW_HEIGHT + ROW_HEIGHT / 2

import type { BuildingType } from './buildings'

/**
 * Disposition de la grille Bento du village. L'ordre du tableau pilote le
 * placement (`grid-auto-flow: dense` dans VillagePlanView.vue re-packe les
 * cartes dans cet ordre) — pas de `grid-template-areas` nommées, pour que la
 * réorganisation manuelle (drag & drop, prévue plus tard) n'ait besoin que de
 * réordonner ce tableau, sans toucher au CSS.
 */
export interface VillageCardLayout {
  type: BuildingType
  colSpan: number
  rowSpan: number
}

// 4 colonnes × 3 lignes : QG + Casernes en 2×2 côte à côte, les 4 bâtiments de
// ressource remplissent exactement la 3ᵉ ligne — grille pleine, sans trou.
export const VILLAGE_LAYOUT: VillageCardLayout[] = [
  { type: 'headquarters', colSpan: 2, rowSpan: 2 },
  { type: 'barracks', colSpan: 2, rowSpan: 2 },
  { type: 'lumbermill', colSpan: 1, rowSpan: 1 },
  { type: 'farm', colSpan: 1, rowSpan: 1 },
  { type: 'quarry', colSpan: 1, rowSpan: 1 },
  { type: 'mine', colSpan: 1, rowSpan: 1 },
]

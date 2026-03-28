import { type TerrainType } from './TerrainTypes'
import { cloneGrid, countNeighborsOfType, type TerrainGrid } from './TerrainGrid'

/**
 * Paramètres de l'automate cellulaire.
 * Chaque terrain a un seuil de survie/naissance inspiré du "Game of Life".
 *
 * surviveThreshold : nb de voisins identiques minimum pour qu'une cellule conserve son terrain
 * birthThreshold   : nb de voisins identiques minimum pour qu'une cellule plain devienne ce terrain
 */
export interface CARules {
  surviveThreshold: number
  birthThreshold: number
}

export const DEFAULT_CA_RULES: Record<TerrainType, CARules> = {
  // Montagnes : clusters plus petits et dispersés
  mountain: { surviveThreshold: 4, birthThreshold: 6 },
  // Lacs : légèrement plus petits aussi
  water: { surviveThreshold: 4, birthThreshold: 5 },
  // Forêts inchangées
  forest: { surviveThreshold: 2, birthThreshold: 3 },
  plain: { surviveThreshold: 0, birthThreshold: 0 },
}

/**
 * Applique une étape de l'automate cellulaire sur la grille.
 * Ordre de priorité pour la conversion : mountain > water > forest > plain
 */
const applyOneStep = (grid: TerrainGrid, rules: Record<TerrainType, CARules>): TerrainGrid => {
  const next = cloneGrid(grid)
  const priority: TerrainType[] = ['mountain', 'water', 'forest']

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c]
      const currentTerrain = cell.terrain

      if (currentTerrain === 'plain') {
        // Vérifier si un terrain dominant doit "naître" ici
        let born: TerrainType | null = null
        for (const candidateTerrain of priority) {
          const count = countNeighborsOfType(grid, r, c, candidateTerrain)
          if (count >= rules[candidateTerrain].birthThreshold) {
            born = candidateTerrain
            break // Priorité : le premier qui dépasse son seuil gagne
          }
        }
        if (born) next[r][c].terrain = born
      } else {
        // Ce terrain non-plaine survit-il ?
        const count = countNeighborsOfType(grid, r, c, currentTerrain)
        if (count < rules[currentTerrain].surviveThreshold) {
          next[r][c].terrain = 'plain' // Meurt → redevient plaine
        }
      }
    }
  }

  return next
}

/**
 * Lisse la grille en appliquant N itérations de l'automate cellulaire.
 * Le résultat est une grille avec des clusters naturels de montagnes, lacs et forêts.
 */
export const smoothTerrain = (
  grid: TerrainGrid,
  iterations = 5,
  rules: Record<TerrainType, CARules> = DEFAULT_CA_RULES,
): TerrainGrid => {
  let current = grid
  for (let i = 0; i < iterations; i++) {
    current = applyOneStep(current, rules)
  }
  return current
}

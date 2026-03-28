import { TERRAIN_CONFIG, type TerrainType } from './TerrainTypes'

export interface TerrainCell {
  terrain: TerrainType
  row: number
  col: number
}

export type TerrainGrid = TerrainCell[][]

/**
 * Génère une grille de terrain brute en attribuant un biome à chaque cellule
 * selon les densités initiales définies dans TERRAIN_CONFIG.
 */
export const createRawGrid = (rows: number, cols: number): TerrainGrid => {
  // Construire une table de seuils cumulatifs pour la sélection pondérée
  const terrains = Object.keys(TERRAIN_CONFIG) as TerrainType[]
  const thresholds: { terrain: TerrainType; threshold: number }[] = []
  let cumulative = 0
  for (const t of terrains) {
    cumulative += TERRAIN_CONFIG[t].initialDensity
    thresholds.push({ terrain: t, threshold: cumulative })
  }

  const grid: TerrainGrid = []
  for (let r = 0; r < rows; r++) {
    const row: TerrainCell[] = []
    for (let c = 0; c < cols; c++) {
      const rand = Math.random()
      const selected = thresholds.find((th) => rand <= th.threshold)
      row.push({ terrain: selected?.terrain ?? 'plain', row: r, col: c })
    }
    grid.push(row)
  }
  return grid
}

/** Récupère les voisins Moore (8 directions) d'une cellule */
export const getMooreNeighbors = (grid: TerrainGrid, row: number, col: number): TerrainCell[] => {
  const neighbors: TerrainCell[] = []
  const rows = grid.length
  const cols = grid[0].length

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        neighbors.push(grid[nr][nc])
      }
    }
  }
  return neighbors
}

/** Compte les voisins d'un terrain donné */
export const countNeighborsOfType = (
  grid: TerrainGrid,
  row: number,
  col: number,
  type: TerrainType,
): number => getMooreNeighbors(grid, row, col).filter((n) => n.terrain === type).length

/** Copie profonde d'une grille */
export const cloneGrid = (grid: TerrainGrid): TerrainGrid =>
  grid.map((row) => row.map((cell) => ({ ...cell })))

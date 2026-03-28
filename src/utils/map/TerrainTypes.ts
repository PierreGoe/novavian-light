// Types de terrain de base
export type TerrainType = 'plain' | 'mountain' | 'water' | 'forest'

// Configuration visuelle et de gameplay par biome
export interface TerrainConfig {
  icon: string
  color: string
  label: string
  /** Si false, aucun node de jeu ne peut être placé ici */
  passable: boolean
  /** Probabilité initiale d'apparition avant lissage CA */
  initialDensity: number
}

export const TERRAIN_CONFIG: Record<TerrainType, TerrainConfig> = {
  plain: {
    icon: '',
    color: '#4a7c3f',
    label: 'Plaine',
    passable: true,
    initialDensity: 0.55,
  },
  mountain: {
    icon: '⛰️',
    color: '#8b7355',
    label: 'Montagne',
    passable: false,
    initialDensity: 0.2,
  },
  water: {
    icon: '🌊',
    color: '#1e6091',
    label: 'Lac',
    passable: false,
    initialDensity: 0.12,
  },
  forest: {
    icon: '🌲',
    color: '#2d5a1b',
    label: 'Forêt',
    passable: true,
    initialDensity: 0.13,
  },
}

// Renvoie les terrains accessibles (où peuvent apparaître des événements de jeu)
export const passableTerrains = (): TerrainType[] =>
  (Object.keys(TERRAIN_CONFIG) as TerrainType[]).filter((t) => TERRAIN_CONFIG[t].passable)

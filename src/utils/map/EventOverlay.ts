import { TERRAIN_CONFIG, type TerrainType } from './TerrainTypes'
import { type TerrainGrid } from './TerrainGrid'
import { pickEventForBiome, type GameNodeType } from './BiomeEventTable'

// ===== Données de contenu des nodes =====

export interface NodeContent {
  type: GameNodeType
  terrain: TerrainType
  title: string
  description: string
  icon: string
  reward?: { type: 'gold' | 'relic' | 'leadership' | 'card'; amount?: number; name?: string }
}

const NODE_DEFINITIONS: Record<
  Exclude<GameNodeType, 'empty'>,
  {
    icon: string
    titles: string[]
    descriptions: string[]
  }
> = {
  combat: {
    icon: '⚔️',
    titles: ['Patrouille ennemie', 'Embuscade', 'Garde frontière', 'Scouts hostiles'],
    descriptions: [
      "Un groupe d'ennemis bloque votre chemin",
      'Des adversaires surgissent des buissons',
      'Les gardes vous défient',
      'Des éclaireurs tentent de vous arrêter',
    ],
  },
  elite: {
    icon: '👑',
    titles: ['Champion ennemi', 'Général adverse', 'Héros légendaire', 'Commandant élite'],
    descriptions: [
      'Un adversaire redoutable vous attend',
      'Un chef de guerre expérimenté',
      'Une légende vivante se dresse devant vous',
      'Un stratège de renom',
    ],
  },
  shop: {
    icon: '🏪',
    titles: ['Marchand', 'Caravane', 'Artisan ambulant'],
    descriptions: [
      'Un commerçant propose ses services',
      'Une caravane fait halte ici',
      'Des objets rares sont disponibles',
    ],
  },
  event: {
    icon: '❓',
    titles: ['Rencontre mystérieuse', 'Découverte ancienne', 'Choix difficile'],
    descriptions: [
      "Quelque chose d'étrange se produit",
      'Vous découvrez des ruines anciennes',
      "Le destin vous met à l'épreuve",
    ],
  },
  rest: {
    icon: '🏕️',
    titles: ['Campement sûr', 'Source sacrée', 'Refuge naturel'],
    descriptions: [
      'Un lieu pour récupérer vos forces',
      'Une source aux propriétés curatives',
      'Un abri protégé des dangers',
    ],
  },
}

const generateRewardForType = (type: GameNodeType): NodeContent['reward'] => {
  switch (type) {
    case 'combat':
      return { type: 'gold', amount: Math.floor(Math.random() * 50) + 25 }
    case 'elite':
      return { type: 'relic', name: 'Relique ancienne' }
    case 'event':
      return Math.random() > 0.5
        ? { type: 'card', name: 'Carte mystique' }
        : { type: 'gold', amount: Math.floor(Math.random() * 100) + 50 }
    case 'rest':
      return { type: 'leadership', amount: 15 }
    default:
      return undefined
  }
}

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

/**
 * Génère le contenu d'une cellule (empty, combat, shop…) en fonction de son terrain.
 * Les cellules non-passables (montagne, eau) retournent toujours `empty`.
 */
export const resolveNodeContent = (terrain: TerrainType): NodeContent => {
  // Terrain non-passable → case vide infranchissable
  if (!TERRAIN_CONFIG[terrain].passable) {
    return {
      type: 'empty',
      terrain,
      title: TERRAIN_CONFIG[terrain].label,
      description: '',
      icon: TERRAIN_CONFIG[terrain].icon,
    }
  }

  const eventType = pickEventForBiome(terrain)

  if (eventType === 'empty') {
    return {
      type: 'empty',
      terrain,
      title: '',
      description: '',
      icon: '',
    }
  }

  const def = NODE_DEFINITIONS[eventType]
  return {
    type: eventType,
    terrain,
    title: pick(def.titles),
    description: pick(def.descriptions),
    icon: def.icon,
    reward: generateRewardForType(eventType),
  }
}

/**
 * Applique la couche d'événements sur toute la grille terrain.
 * Retourne un tableau 2D de NodeContent prêt à être consommé par generateMap().
 */
export const buildEventOverlay = (terrainGrid: TerrainGrid): NodeContent[][] =>
  terrainGrid.map((row) => row.map((cell) => resolveNodeContent(cell.terrain)))

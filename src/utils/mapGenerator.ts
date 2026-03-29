// Types pour la génération de map
export interface MapNode {
  id: string
  type: 'combat' | 'elite' | 'shop' | 'event' | 'rest' | 'boss'
  title: string
  description: string
  icon: string
  row: number
  col: number
  connections: string[] // IDs des nodes suivants connectés
  completed: boolean
  accessible: boolean
  inProgress?: boolean // Mission en cours (pas encore terminée)
  reward?: {
    type: 'gold' | 'card' | 'relic' | 'leadership'
    amount?: number
    name?: string
  }
}

export interface MapLayer {
  row: number
  nodes: MapNode[]
}

// Configuration de génération
const MAP_ROWS = 12 // Nombre de lignes (niveaux)

// Types de nodes avec leurs probabilités et propriétés
const nodeTypeConfig = {
  combat: {
    icon: '⚔️',
    color: '#dc143c',
    probability: 0.5,
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
    color: '#ffd700',
    probability: 0.15,
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
    color: '#32cd32',
    probability: 0.15,
    titles: ['Marchand'],
    descriptions: [
      'Un commerçant propose ses services',
      'Un artisan offre ses créations',
      'Des marchands font une halte',
      'Des objets rares sont disponibles',
    ],
  },
  event: {
    icon: '❓',
    color: '#9932cc',
    probability: 0.1,
    titles: [
      'Rencontre mystérieuse',
      'Découverte ancienne',
      'Choix difficile',
      'Événement inattendu',
    ],
    descriptions: [
      "Quelque chose d'étrange se produit",
      'Vous découvrez des ruines anciennes',
      "Une décision s'impose à vous",
      "Le destin vous met à l'épreuve",
    ],
  },
  rest: {
    icon: '🏕️',
    color: '#4169e1',
    probability: 0.1,
    titles: ['Campement sûr', 'Source sacrée', 'Refuge naturel', 'Oasis de paix'],
    descriptions: [
      'Un lieu pour récupérer vos forces',
      'Une source aux propriétés curatives',
      'Un abri protégé des dangers',
      'Un endroit paisible pour se reposer',
    ],
  },
  boss: {
    icon: '💀',
    color: '#8b0000',
    probability: 0,
    titles: ['Seigneur de guerre', 'Dragon ancien', 'Nécromancien suprême', 'Empereur déchu'],
    descriptions: [
      "L'ennemi final vous attend",
      'Une créature légendaire garde le trésor',
      'Le maître des ténèbres',
      'Le dernier obstacle vers la victoire',
    ],
  },
}

// Sélection du type de node selon la voie
const selectNodeTypeByPath = (col: number): keyof typeof nodeTypeConfig => {
  const pathType = getPathType(col)
  const rand = Math.random()

  switch (pathType) {
    case 'military': // Voie gauche (col 0)
      if (rand < 0.6) return 'combat'
      if (rand < 0.85) return 'elite'
      return 'rest'

    case 'economic': // Voie droite (col 4)
      if (rand < 0.4) return 'shop'
      if (rand < 0.7) return 'event'
      if (rand < 0.9) return 'combat'
      return 'rest'

    case 'balanced': // Voie centre (col 2) et convergence (col 1,3)
    default:
      if (rand < 0.35) return 'combat'
      if (rand < 0.55) return 'shop'
      if (rand < 0.75) return 'event'
      if (rand < 0.9) return 'elite'
      return 'rest'
  }
}

// Déterminer le type de voie selon la position
const getPathType = (col: number): 'military' | 'economic' | 'balanced' => {
  if (col === 0) return 'military' // Gauche = Militaire
  if (col === 4) return 'economic' // Droite = Économique
  return 'balanced' // Centre/Convergence = Équilibré
}

// Vérifier si une connexion entre deux colonnes est interdite
const isForbiddenConnection = (sourceCol: number, targetCol: number): boolean => {
  // Interdire les connexions directes entre extrême gauche (col 0) et extrême droite (col 4)
  return (sourceCol === 0 && targetCol === 4) || (sourceCol === 4 && targetCol === 0)
}

// Génération des récompenses selon le type de node
const generateReward = (nodeType: keyof typeof nodeTypeConfig) => {
  switch (nodeType) {
    case 'combat':
      return { type: 'gold' as const, amount: Math.floor(Math.random() * 50) + 25 }
    case 'elite':
      return { type: 'relic' as const, name: 'Relique ancienne' }
    case 'event':
      return Math.random() > 0.5
        ? { type: 'card' as const, name: 'Carte mystique' }
        : { type: 'gold' as const, amount: Math.floor(Math.random() * 100) + 50 }
    case 'rest':
      return { type: 'leadership' as const, amount: 15 }
    default:
      return undefined
  }
}

// Génération structurée de la map avec 3 voies
export const generateMap = (): MapLayer[] => {
  const layers: MapLayer[] = []
  let nodeIdCounter = 1

  for (let row = 0; row < MAP_ROWS; row++) {
    const isFirstRow = row === 0
    const isLastRow = row === MAP_ROWS - 1
    const isConvergenceRow = row % 4 === 3 // Convergence tous les 4 niveaux

    let nodesCount: number
    let nodePositions: number[]

    if (isFirstRow) {
      nodesCount = 1
      nodePositions = [2] // Centre
    } else if (isLastRow) {
      nodesCount = 1
      nodePositions = [2] // Boss au centre
    } else if (isConvergenceRow) {
      // Point de convergence : 1-2 nodes centraux
      nodesCount = Math.random() > 0.5 ? 1 : 2
      nodePositions = nodesCount === 1 ? [2] : [1, 3]
    } else {
      // Voies normales : 3 nodes (gauche, centre, droite)
      nodesCount = 3
      nodePositions = [0, 2, 4] // Gauche, Centre, Droite
    }

    const layer: MapLayer = {
      row,
      nodes: [],
    }

    // Génération des nodes pour cette ligne
    for (let i = 0; i < nodesCount; i++) {
      const col = nodePositions[i]
      let nodeType: keyof typeof nodeTypeConfig

      if (isLastRow) {
        nodeType = 'boss'
      } else if (isFirstRow) {
        nodeType = 'combat' // Node de départ = combat
      } else {
        // Sélection basée sur la voie (position)
        nodeType = selectNodeTypeByPath(col)
      }

      const config = nodeTypeConfig[nodeType]
      const titleIndex = Math.floor(Math.random() * config.titles.length)
      const descIndex = Math.floor(Math.random() * config.descriptions.length)

      const node: MapNode = {
        id: `node_${nodeIdCounter++}`,
        type: nodeType,
        title: config.titles[titleIndex],
        description: config.descriptions[descIndex],
        icon: config.icon,
        row,
        col,
        connections: [],
        completed: false,
        accessible: false,
        reward: generateReward(nodeType),
      }

      layer.nodes.push(node)
    }

    layers.push(layer)
  }

  // Générer les connexions entre les nodes
  generateConnections(layers)

  return layers
}

// Génération des connexions structurées entre nodes
const generateConnections = (layers: MapLayer[]) => {
  for (let rowIndex = 0; rowIndex < layers.length - 1; rowIndex++) {
    const currentLayer = layers[rowIndex]
    const nextLayer = layers[rowIndex + 1]
    const isFirstRow = rowIndex === 0
    const isNextConvergence = (rowIndex + 1) % 4 === 3
    const isCurrentConvergence = rowIndex % 4 === 3

    currentLayer.nodes.forEach((node) => {
      if (isFirstRow) {
        // Premier node se connecte aux 3 voies principales
        nextLayer.nodes.forEach((nextNode) => {
          node.connections.push(nextNode.id)
        })
      } else if (isCurrentConvergence) {
        // Points de convergence se reconnectent aux 3 voies
        nextLayer.nodes.forEach((nextNode) => {
          node.connections.push(nextNode.id)
        })
      } else if (isNextConvergence) {
        // Voies normales convergent vers les points de convergence
        const targetNode = nextLayer.nodes.find((n) => n.col === 2) || nextLayer.nodes[0]
        node.connections.push(targetNode.id)

        // Parfois connexion croisée (20% de chance) - mais pas entre extrêmes
        if (Math.random() < 0.2 && nextLayer.nodes.length > 1) {
          const crossNode = nextLayer.nodes.find(
            (n) => n.col !== 2 && n.id !== targetNode.id && !isForbiddenConnection(node.col, n.col), // Vérifier les connexions interdites
          )
          if (crossNode) {
            node.connections.push(crossNode.id)
          }
        }
      } else {
        // Connexions normales dans les voies
        connectToSamePath(node, nextLayer)
      }
    })

    // Garantir l'accessibilité de tous les nodes
    ensureAllNodesAccessible(currentLayer, nextLayer)
  }
}

// Connecter un node à sa voie naturelle + parfois croisement
const connectToSamePath = (sourceNode: MapNode, nextLayer: MapLayer) => {
  const sourcePath = getPathType(sourceNode.col)

  // Connexion principale dans la même voie
  const samePathNodes = nextLayer.nodes.filter((n) => getPathType(n.col) === sourcePath)
  if (samePathNodes.length > 0) {
    const mainTarget = samePathNodes[Math.floor(Math.random() * samePathNodes.length)]
    sourceNode.connections.push(mainTarget.id)
  }

  // Connexion croisée occasionnelle (30% de chance) - mais pas entre extrêmes
  if (Math.random() < 0.3) {
    const otherPathNodes = nextLayer.nodes.filter(
      (n) =>
        getPathType(n.col) !== sourcePath &&
        !sourceNode.connections.includes(n.id) &&
        !isForbiddenConnection(sourceNode.col, n.col), // Vérifier les connexions interdites
    )
    if (otherPathNodes.length > 0) {
      const crossTarget = otherPathNodes[Math.floor(Math.random() * otherPathNodes.length)]
      sourceNode.connections.push(crossTarget.id)
    }
  }
}

// Garantir que tous les nodes sont accessibles
const ensureAllNodesAccessible = (currentLayer: MapLayer, nextLayer: MapLayer) => {
  nextLayer.nodes.forEach((nextNode) => {
    const hasConnection = currentLayer.nodes.some((node) => node.connections.includes(nextNode.id))

    if (!hasConnection && currentLayer.nodes.length > 0) {
      // Trouver les nodes qui peuvent se connecter (en respectant la règle des extrêmes)
      const validSources = currentLayer.nodes.filter(
        (node) => !isForbiddenConnection(node.col, nextNode.col),
      )

      if (validSources.length > 0) {
        // Connecter le node valide le plus proche
        const nearestNode = validSources.reduce((nearest, current) =>
          Math.abs(current.col - nextNode.col) < Math.abs(nearest.col - nextNode.col)
            ? current
            : nearest,
        )
        nearestNode.connections.push(nextNode.id)
      } else {
        // Si aucune connexion valide n'est possible, forcer une connexion via le centre
        const centerNode = currentLayer.nodes.find((n) => n.col === 2)
        if (centerNode) {
          centerNode.connections.push(nextNode.id)
        } else {
          // En dernier recours, connecter au premier node disponible
          currentLayer.nodes[0].connections.push(nextNode.id)
        }
      }
    }
  })
}

// Valider qu'une map respecte la règle des connexions interdites
export const validateMapConnections = (layers: MapLayer[]): boolean => {
  for (const layer of layers) {
    for (const node of layer.nodes) {
      for (const connectionId of node.connections) {
        // Trouver le node connecté
        const targetNode = layers.flatMap((l) => l.nodes).find((n) => n.id === connectionId)

        if (targetNode && isForbiddenConnection(node.col, targetNode.col)) {
          console.warn(
            `Connexion interdite détectée: node ${node.id} (col ${node.col}) -> node ${targetNode.id} (col ${targetNode.col})`,
          )
          return false
        }
      }
    }
  }
  return true
}

/* 
  Exemple d'utilisation pour tester :
  
  const map = generateMap()
  const isValid = validateMapConnections(map)
  console.log('Map valide:', isValid)
  
  // Afficher toutes les connexions pour vérification
  map.forEach(layer => {
    layer.nodes.forEach(node => {
      console.log(`Node ${node.id} (col ${node.col}) -> [${node.connections.join(', ')}]`)
    })
  })
*/

// Export des configurations pour utilisation dans les composants
export { nodeTypeConfig, getPathType }

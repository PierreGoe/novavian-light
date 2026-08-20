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
  /** Décalage horizontal (fraction du slot, ± JITTER_RANGE) calculé une fois à la génération
   * pour casser l'alignement parfait en grille — ne doit jamais être recalculé au rendu. */
  jitterX?: number
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

// Configuration de génération — grille façon Slay the Spire
export const GRID_COLUMNS = 7 // Colonnes possibles (0 à 6)
const GRID_ROWS = 15 // Rangées de jeu (0 = départ) ; le boss est ajouté au-dessus, en rangée GRID_ROWS
// Nombre de chemins générés par marche aléatoire. Chaque chemin occupe exactement une colonne
// par rangée, donc une rangée compte au plus NUM_PATHS nodes distincts — c'est ce qui borne la
// largeur de l'arbre à 4 branches maximum.
const NUM_PATHS = 4
const JITTER_RANGE = 0.15 // Décalage horizontal max, en fraction de la largeur d'un slot

// Types de nodes avec leurs propriétés d'affichage et de contenu
const nodeTypeConfig = {
  combat: {
    icon: '⚔️',
    color: '#dc143c',
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
    titles: ['Seigneur de guerre', 'Dragon ancien', 'Nécromancien suprême', 'Empereur déchu'],
    descriptions: [
      "L'ennemi final vous attend",
      'La forteresse du mal se dresse devant vous',
      'Le maître des ténèbres vous attend dans sa forteresse',
      'Le dernier obstacle vers la victoire',
    ],
  },
}

type NodeType = keyof typeof nodeTypeConfig

// Génération des récompenses selon le type de node
//
// Barème risque/récompense : un node qui coûte des Points de Victoire et expose à des pertes
// (combat, elite) doit payer clairement plus, en espérance, qu'un node gratuit et sans danger
// (event, rest) — sinon un joueur rationnel n'a aucune raison de se battre.
// Rappel du coût en PV à la victoire (voir missionStore.ts, vpByDifficulty) :
//   combat (difficulty 'medium') -> 4 PV     elite (difficulty 'elite') -> 12 PV (3x combat)
const generateReward = (nodeType: NodeType) => {
  switch (nodeType) {
    case 'combat':
      // Risque réel (4 PV + pertes de combat possibles) : prime nette par rapport aux nodes
      // gratuits. 60-129 or (moy. ~95), largement au-dessus du plafond des events.
      return { type: 'gold' as const, amount: Math.floor(Math.random() * 70) + 60 }
    case 'elite': {
      // Risque maximal (12 PV, soit 3x un combat classique, pertes potentiellement plus lourdes) :
      // soit une relique rare (valeur hors-or), soit un gros lot d'or dont la moyenne dépasse
      // nettement celle d'un combat, cohérent avec le coût en PV bien plus élevé.
      const isGoldJackpot = Math.random() > 0.6
      return isGoldJackpot
        ? { type: 'gold' as const, amount: Math.floor(Math.random() * 160) + 220 } // 220-379 (moy. ~300)
        : { type: 'relic' as const, name: 'Relique ancienne' }
    }
    case 'event': {
      // Gratuit, aucun risque, aucun coût en PV : reste un joli bonus occasionnel mais plafonné
      // bas, avec un gros lot rare (10%) pour garder un peu de surprise sans concurrencer le combat.
      const roll = Math.random()
      if (roll < 0.55) {
        return { type: 'card' as const, name: 'Carte mystique' }
      }
      if (roll < 0.9) {
        return { type: 'gold' as const, amount: Math.floor(Math.random() * 30) + 15 } // 15-44 (moy. ~30)
      }
      return { type: 'gold' as const, amount: Math.floor(Math.random() * 50) + 50 } // rare jackpot: 50-99
    }
    case 'rest':
      return { type: 'leadership' as const, amount: 15 }
    default:
      return undefined
  }
}

const clampCol = (col: number): number => Math.max(0, Math.min(GRID_COLUMNS - 1, col))

interface Edge {
  row: number
  from: number
  to: number
}

/** Deux arêtes d'une même transition rangée->rangée+1 se croisent si l'ordre gauche/droite
 * entre leurs points de départ et d'arrivée s'inverse. */
const edgesCross = (a: Edge, b: Edge): boolean => {
  const dFrom = a.from - b.from
  const dTo = a.to - b.to
  return (dFrom > 0 && dTo < 0) || (dFrom < 0 && dTo > 0)
}

const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Génère NUM_PATHS chemins par marche aléatoire (-1/0/+1 par rangée), en évitant les
 * croisements d'arêtes dans la mesure du possible. Retourne l'ensemble dédupliqué des arêtes,
 * groupées par rangée de départ. */
const generatePaths = (): Edge[][] => {
  const edgesByRow: Edge[][] = Array.from({ length: GRID_ROWS - 1 }, () => [])
  // Sorti de la boucle : tous les chemins partagent le même départ (point de départ unique en rangée 0)
  const startCol = Math.floor(GRID_COLUMNS / 2)

  for (let p = 0; p < NUM_PATHS; p++) {
    let col = startCol

    for (let row = 0; row < GRID_ROWS - 1; row++) {
      const candidates = shuffle([-1, 0, 1])
      let nextCol: number | null = null

      for (const dx of candidates) {
        const candidate = clampCol(col + dx)
        const candidateEdge: Edge = { row, from: col, to: candidate }
        const crosses = edgesByRow[row].some((existing) => edgesCross(candidateEdge, existing))
        if (!crosses) {
          nextCol = candidate
          break
        }
      }

      // Si toutes les directions croisent une arête existante, on continue tout droit
      const resolvedCol = nextCol ?? col
      const alreadyExists = edgesByRow[row].some((e) => e.from === col && e.to === resolvedCol)
      if (!alreadyExists) {
        edgesByRow[row].push({ row, from: col, to: resolvedCol })
      }
      col = resolvedCol
    }
  }

  return edgesByRow
}

/** Détermine les prédécesseurs (rangée row-1) d'un node (row, col) à partir des arêtes déjà posées. */
const parentColsOf = (edgesByRow: Edge[][], row: number, col: number): number[] => {
  if (row === 0) return []
  return edgesByRow[row - 1].filter((e) => e.to === col).map((e) => e.from)
}

const pickWeighted = (table: Array<[NodeType, number]>): NodeType => {
  const total = table.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = Math.random() * total
  for (const [type, weight] of table) {
    if (roll < weight) return type
    roll -= weight
  }
  return 'combat'
}

// Plafond du nombre de nodes d'un type donné par rangée, indépendant du nombre total de nodes
// sur cette rangée (une rangée large de 5-6 nodes ne doit pas pouvoir aligner 5 marchands).
// Pas de plafond pour 'combat' : c'est le type de repli dès qu'un autre type atteint son
// plafond, ce qui garantit que le combat classique reste majoritaire sur le chemin — un
// marchand/élite/repos ne doit jamais représenter la majorité des choix d'une même rangée.
const ROW_TYPE_CAPS: Partial<Record<NodeType, number>> = {
  shop: 2, // 1-2 marchands par rangée maximum, jamais plus
  elite: 1, // une seule élite par rangée : un choix rare, pas une option courante
  rest: 1, // un seul repos par rangée : sinon il devient trivial d'en profiter à chaque fois
  event: 2,
}

/** Choisit le type d'un node selon sa rangée, les types de ses prédécesseurs, et les nodes déjà
 * placés sur la même rangée, en respectant les règles de placement façon Slay the Spire (pas
 * d'élite/repos trop tôt, pas de repos juste avant le boss, pas deux élites/repos reliés sur un
 * même chemin, plafonds par rangée pour marchand/élite/repos/événement — voir ROW_TYPE_CAPS). */
const pickNodeType = (
  row: number,
  treasureRow: number,
  parentTypes: NodeType[],
  typeCountsThisRow: Partial<Record<NodeType, number>>,
): NodeType => {
  if (row === 0) return 'combat'

  const tooEarlyForEliteOrRest = row <= 2
  const tooCloseToBossForRest = row >= GRID_ROWS - 2
  const parentHasElite = parentTypes.includes('elite')
  const parentHasRest = parentTypes.includes('rest')

  const capReached = (type: NodeType): boolean => {
    const cap = ROW_TYPE_CAPS[type]
    return cap !== undefined && (typeCountsThisRow[type] ?? 0) >= cap
  }

  // Poids de base : le combat classique doit dominer nettement (>50%) avant même l'effet des
  // plafonds ci-dessus — la route est surtout semée de combats normaux, les autres types ne sont
  // que des variations occasionnelles sur ce fond.
  const table: Array<[NodeType, number]> = [
    ['combat', 0.55],
    ['event', capReached('event') ? 0 : 0.16],
    ['shop', capReached('shop') ? 0 : 0.12],
    ['elite', tooEarlyForEliteOrRest || parentHasElite || capReached('elite') ? 0 : 0.07],
    [
      'rest',
      tooEarlyForEliteOrRest || tooCloseToBossForRest || parentHasRest || capReached('rest')
        ? 0
        : 0.1,
    ],
  ]

  return pickWeighted(table)
}

// Génération structurée de la map façon Slay the Spire (grille à colonnes variables)
export const generateMap = (): MapLayer[] => {
  const edgesByRow = generatePaths()

  // Colonnes effectivement utilisées par rangée (déduites des arêtes)
  const colsByRow: Set<number>[] = Array.from({ length: GRID_ROWS }, () => new Set<number>())
  edgesByRow.forEach((edges, row) => {
    edges.forEach((edge) => {
      colsByRow[row].add(edge.from)
      colsByRow[row + 1].add(edge.to)
    })
  })

  const treasureRow = Math.floor(GRID_ROWS * 0.55)

  const layers: MapLayer[] = []
  const nodesById = new Map<string, MapNode>()
  const nodeIdByRowCol = new Map<string, string>()
  const typeByRowCol = new Map<string, NodeType>()
  let nodeIdCounter = 1

  for (let row = 0; row < GRID_ROWS; row++) {
    const cols = Array.from(colsByRow[row]).sort((a, b) => a - b)
    const layer: MapLayer = { row, nodes: [] }
    const typeCountsThisRow: Partial<Record<NodeType, number>> = {}
    // Rangée-trésor : garantit un marchand accessible à ce stade de la carte, mais un seul —
    // le reste de la rangée suit les règles normales (plafonnées, dominées par le combat).
    const guaranteedShopCol = row === treasureRow ? cols[Math.floor(cols.length / 2)] : undefined

    for (const col of cols) {
      const parentTypes = parentColsOf(edgesByRow, row, col).map(
        (parentCol) => typeByRowCol.get(`${row - 1}:${parentCol}`)!,
      )
      const nodeType: NodeType =
        col === guaranteedShopCol ? 'shop' : pickNodeType(row, treasureRow, parentTypes, typeCountsThisRow)
      typeCountsThisRow[nodeType] = (typeCountsThisRow[nodeType] ?? 0) + 1
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
        jitterX: (Math.random() * 2 - 1) * JITTER_RANGE,
        reward: generateReward(nodeType),
      }

      layer.nodes.push(node)
      nodesById.set(node.id, node)
      nodeIdByRowCol.set(`${row}:${col}`, node.id)
      typeByRowCol.set(`${row}:${col}`, nodeType)
    }

    layers.push(layer)
  }

  // Nœud boss unique, au-dessus de la dernière rangée de jeu
  const bossCol = Math.floor(GRID_COLUMNS / 2)
  const bossConfig = nodeTypeConfig.boss
  const bossNode: MapNode = {
    id: `node_${nodeIdCounter++}`,
    type: 'boss',
    title: bossConfig.titles[Math.floor(Math.random() * bossConfig.titles.length)],
    description:
      bossConfig.descriptions[Math.floor(Math.random() * bossConfig.descriptions.length)],
    icon: bossConfig.icon,
    row: GRID_ROWS,
    col: bossCol,
    connections: [],
    completed: false,
    accessible: false,
    jitterX: 0,
  }
  layers.push({ row: GRID_ROWS, nodes: [bossNode] })
  nodesById.set(bossNode.id, bossNode)

  // Connexions déduites des arêtes générées
  edgesByRow.forEach((edges, row) => {
    edges.forEach((edge) => {
      const sourceId = nodeIdByRowCol.get(`${row}:${edge.from}`)
      const targetId = nodeIdByRowCol.get(`${row + 1}:${edge.to}`)
      if (!sourceId || !targetId) return
      const sourceNode = nodesById.get(sourceId)
      if (sourceNode && !sourceNode.connections.includes(targetId)) {
        sourceNode.connections.push(targetId)
      }
    })
  })

  // Toute la dernière rangée de jeu converge vers le boss
  layers[GRID_ROWS - 1].nodes.forEach((node) => {
    if (!node.connections.includes(bossNode.id)) {
      node.connections.push(bossNode.id)
    }
  })

  // Garantir que tout node a au moins une connexion entrante (bords de grille)
  ensureAllNodesAccessible(layers)

  return layers
}

// Garantir que tous les nodes ont au moins une connexion entrante
const ensureAllNodesAccessible = (layers: MapLayer[]) => {
  for (let row = 0; row < layers.length - 1; row++) {
    const currentLayer = layers[row]
    const nextLayer = layers[row + 1]

    nextLayer.nodes.forEach((nextNode) => {
      const hasConnection = currentLayer.nodes.some((node) =>
        node.connections.includes(nextNode.id),
      )
      if (!hasConnection && currentLayer.nodes.length > 0) {
        const nearestNode = currentLayer.nodes.reduce((nearest, current) =>
          Math.abs(current.col - nextNode.col) < Math.abs(nearest.col - nextNode.col)
            ? current
            : nearest,
        )
        nearestNode.connections.push(nextNode.id)
      }
    })
  }
}

// Export des configurations pour utilisation dans les composants
export { nodeTypeConfig }

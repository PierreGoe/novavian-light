/**
 * Catalogue centralisé de tous les artefacts du jeu.
 * Modifier ce fichier pour ajouter, éditer ou supprimer des reliques.
 *
 * Structure :
 *  - SELL_PRICES / BAZAR_BUY_PRICES — prix par rareté
 *  - BAZAR_MAX_REROLLS / BAZAR_REROLL_COST — paramètres du Bazar
 *  - STARTING_ARTIFACTS — artefacts de départ par race (id fixe)
 *  - ARTIFACT_POOL — pool de drops aléatoires (forge, bazar, récompenses)
 *  - instantiateArtifact() — crée un exemplaire joueur depuis un template
 *  - getPoolByRarity() — filtre le pool par rareté
 */

// NOTE : `import type` est effacé à la compilation — aucune dépendance circulaire à l'exécution
import type { Artifact } from '@/stores/gameStore'

/** Template d'artefact avant instanciation (sans id ni obtainedFrom) */
export type ArtifactTemplate = Omit<Artifact, 'id' | 'obtainedFrom'>

// ─────────────────────────────────────────────────────────────────────────────
// Prix par rareté
// ─────────────────────────────────────────────────────────────────────────────

/** Prix de revente au Bazar par rareté */
export const SELL_PRICES: Record<Artifact['rarity'], number> = {
  common: 35,
  rare: 90,
  epic: 220,
  legendary: 450,
}

/** Prix d'achat au Bazar par rareté */
export const BAZAR_BUY_PRICES: Record<Artifact['rarity'], number> = {
  common: 100,
  rare: 300,
  epic: 700,
  legendary: 1200,
}

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres du Bazar Mystique
// ─────────────────────────────────────────────────────────────────────────────

/** Nombre maximum de retirages par visite */
export const BAZAR_MAX_REROLLS = 3

/** Coût en or d'un retirage */
export const BAZAR_REROLL_COST = 60

// ─────────────────────────────────────────────────────────────────────────────
// Artefacts de départ (par race — id fixe, non issus du pool aléatoire)
// ─────────────────────────────────────────────────────────────────────────────

export const STARTING_ARTIFACTS: Record<string, Artifact> = {
  romans: {
    id: 'roman-gladius',
    name: 'Glaive Romain',
    type: 'weapon',
    icon: '⚔️',
    description: 'Une épée courte efficace, symbole de la discipline romaine.',
    effects: { military: 5, economy: 2 },
    rarity: 'common',
    durability: 'permanent',
    destructible: false,
    obtainedFrom: 'Équipement de démarrage Romain',
  },
  gauls: {
    id: 'gallic-shield',
    name: 'Bouclier Gaulois',
    type: 'armor',
    icon: '🛡️',
    description: 'Un bouclier robuste, parfait pour la défense du territoire.',
    effects: { defense: 8, resourceBonus: { stone: 5 } },
    rarity: 'common',
    durability: 'permanent',
    destructible: false,
    obtainedFrom: 'Équipement de démarrage Gaulois',
  },
  germans: {
    id: 'german-axe',
    name: 'Hache Germaine',
    type: 'weapon',
    icon: '🪓',
    description: 'Une hache de guerre redoutable pour les raids rapides.',
    effects: { military: 7, resourceBonus: { wood: 3 } },
    rarity: 'common',
    durability: 'permanent',
    destructible: false,
    obtainedFrom: 'Équipement de démarrage Germain',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool d'artefacts aléatoires
// (forge, bazar, récompenses d'événements, drops d'élites…)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catalogue complet de tous les artefacts disponibles dans les tirages aléatoires.
 * Chaque entrée est un TEMPLATE : l'id et la source sont assignés à l'instanciation.
 */
export const ARTIFACT_POOL: ArtifactTemplate[] = [
  // ── Communes ─────────────────────────────────────────────────────────────

  {
    name: 'Épée de Milice',
    type: 'weapon',
    icon: '🗡️',
    description: 'Une épée de base qui améliore légèrement la puissance militaire.',
    effects: { military: 3 },
    rarity: 'common',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Bouclier de Bois',
    type: 'armor',
    icon: '🪵',
    description: 'Un bouclier rudimentaire mais efficace contre les coups ennemis.',
    effects: { defense: 4 },
    rarity: 'common',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Sacoche de Marchand',
    type: 'accessory',
    icon: '👝',
    description: 'Améliore la collecte de ressources de base grâce à de meilleurs échanges.',
    effects: { economy: 3 },
    rarity: 'common',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Torche de Sentinelle',
    type: 'accessory',
    icon: '🔦',
    description: 'Éclaire un peu plus loin dans le brouillard de guerre.',
    effects: {},
    specialPower: {
      type: 'scout_range_bonus',
      value: 1,
      description: "Révèle 1 case supplémentaire lors des missions d'éclaireur",
    },
    rarity: 'common',
    durability: 'uses-limited',
    maxUses: 5,
    usesRemaining: 5,
    destructible: false,
  },

  // ── Rares ────────────────────────────────────────────────────────────────

  {
    name: 'Amulette de Fortune',
    type: 'accessory',
    icon: '🧿',
    description: 'Une amulette qui améliore les gains économiques sur les marchés.',
    effects: { economy: 5 },
    rarity: 'rare',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Anneau de Commandement',
    type: 'accessory',
    icon: '💍',
    description: 'Un anneau qui renforce la discipline militaire et la cohésion défensive.',
    effects: { military: 4, defense: 2 },
    rarity: 'rare',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Œil de Faucon',
    type: 'relic',
    icon: '🦅',
    description:
      'Cette relique mystique aiguise la vision des éclaireurs, leur permettant de percevoir une case supplémentaire.',
    effects: {},
    specialPower: {
      type: 'scout_range_bonus',
      value: 1,
      description: "Les éclaireurs révèlent 1 case supplémentaire autour d'eux",
    },
    rarity: 'rare',
    durability: 'permanent',
    destructible: true,
  },
  {
    name: 'Botte de Mercure',
    type: 'accessory',
    icon: '👢',
    description:
      "Chaussures enchantées qui permettent aux éclaireurs d'explorer deux fois plus vite.",
    effects: {},
    specialPower: {
      type: 'double_scout_speed',
      value: 2,
      description: "Les missions d'éclaireur durent deux fois moins longtemps",
    },
    rarity: 'rare',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Heaume de Fer',
    type: 'armor',
    icon: '⛑️',
    description: 'Un casque solide qui absorbe les coups lors des assauts ennemis.',
    effects: { defense: 6, military: 1 },
    rarity: 'rare',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Sac de Pièces Volées',
    type: 'accessory',
    icon: '💰',
    description: "Chaque victoire au combat rapporte un peu d'or supplémentaire.",
    effects: {},
    specialPower: {
      type: 'gold_on_victory',
      value: 10,
      description: '+10 or par victoire en combat',
    },
    rarity: 'rare',
    durability: 'permanent',
    destructible: false,
  },

  // ── Épiques ───────────────────────────────────────────────────────────────

  {
    name: 'Relique Ancienne',
    type: 'relic',
    icon: '🏺',
    description: "Un artefact mystérieux aux pouvoirs équilibrés d'une civilisation oubliée.",
    effects: { economy: 2, military: 2, defense: 2 },
    rarity: 'epic',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Pierre de Sang',
    type: 'relic',
    icon: '💎',
    description:
      'Une pierre imbibée de magie de guerre. Active pour 3 combats seulement, mais ses effets sont redoutables.',
    effects: { military: 10 },
    rarity: 'epic',
    durability: 'uses-limited',
    maxUses: 3,
    usesRemaining: 3,
    destructible: true,
  },
  {
    name: 'Cœur de Dragon',
    type: 'relic',
    icon: '🐉',
    description: 'Une relique pulsante qui guérit une partie de vos troupes après chaque victoire.',
    effects: {},
    specialPower: {
      type: 'healing_after_combat',
      value: 10,
      description: 'Restaure 10% de vos unités après chaque victoire',
    },
    rarity: 'epic',
    durability: 'permanent',
    destructible: true,
  },
  {
    name: 'Frappe-Éclair',
    type: 'weapon',
    icon: '⚡',
    description:
      "Une lame enchantée qui frappe avant l'ennemi, réduisant drastiquement sa riposte.",
    effects: { military: 5 },
    specialPower: {
      type: 'first_strike',
      value: 1,
      description: 'Frappe en premier — riposte ennemie réduite de 50%',
    },
    rarity: 'epic',
    durability: 'permanent',
    destructible: true,
  },
  {
    name: 'Bannière du Conquérant',
    type: 'accessory',
    icon: '🚩',
    description:
      'Une bannière qui inspire les troupes et remplit les coffres après chaque victoire.',
    effects: {},
    specialPower: {
      type: 'gold_on_victory',
      value: 25,
      description: '+25 or par victoire en combat',
    },
    rarity: 'epic',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Grimoire de Siège',
    type: 'relic',
    icon: '📖',
    description:
      "Des tactiques de siège ancestrales qui renforcent l'efficacité des assauts sur forteresses.",
    effects: { military: 4 },
    specialPower: {
      type: 'siege_bonus',
      value: 15,
      description: '+15% de puissance lors des sièges de forteresses',
    },
    rarity: 'epic',
    durability: 'permanent',
    destructible: false,
  },
  {
    name: 'Talisman du Brouillard',
    type: 'relic',
    icon: '🌫️',
    description: 'Révèle les zones cachées autour du joueur après chaque victoire importante.',
    effects: {},
    specialPower: {
      type: 'fog_reveal_on_victory',
      value: 2,
      description: 'Révèle 2 cases autour de votre position après chaque victoire',
    },
    rarity: 'epic',
    durability: 'permanent',
    destructible: true,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Instancie un artefact joueur depuis un template.
 * Assigne un id unique, la source, et remet usesRemaining à maxUses.
 */
export const instantiateArtifact = (template: ArtifactTemplate, source: string): Artifact => ({
  ...(template as Artifact),
  id: crypto.randomUUID(),
  obtainedFrom: source,
  usesRemaining: template.durability === 'uses-limited' ? template.maxUses : undefined,
})

/** Retourne les templates du pool filtrés par rareté */
export const getPoolByRarity = (rarity: Artifact['rarity']): ArtifactTemplate[] =>
  ARTIFACT_POOL.filter((a) => a.rarity === rarity)

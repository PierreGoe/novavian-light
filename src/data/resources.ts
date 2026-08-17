/**
 * Définitions canoniques de toutes les ressources du jeu.
 *
 * Ce fichier est la source de vérité pour :
 * - les clés techniques (utilisées dans les interfaces TypeScript et le store)
 * - les labels affichés en français
 * - les emojis (UN seul par ressource — cohérence UI obligatoire)
 * - les couleurs associées
 *
 * Pour afficher une ressource, importer RESOURCES ou la fonction getResource().
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TravianResourceKey = 'wood' | 'clay' | 'iron' | 'crop'
export type PlayerResourceKey = 'gold' | 'leadership'
/** Clés utilisables dans resourceBonus des artefacts (inclut stone, absent de la prod ville) */
export type ArtifactBonusKey = TravianResourceKey | 'stone'
/** Stats globales des artefacts */
export type ArtifactStatKey = 'economy' | 'military' | 'defense'
export type ResourceKey = TravianResourceKey | PlayerResourceKey

export interface ResourceDef {
  key: ResourceKey
  label: string
  /** Emoji canonique — ne pas utiliser d'autres emojis pour cette ressource */
  emoji: string
  /** Couleur CSS associée (pour les badges, barres, etc.) */
  color: string
}

// ---------------------------------------------------------------------------
// Ressources de production (TravianResources — production en ville)
// ---------------------------------------------------------------------------

export const TRAVIAN_RESOURCES: Record<TravianResourceKey, ResourceDef> = {
  wood: {
    key: 'wood',
    label: 'Bois',
    emoji: '🪵',
    color: '#a16207',
  },
  clay: {
    key: 'clay',
    label: 'Argile',
    emoji: '🧱',
    color: '#b45309',
  },
  iron: {
    key: 'iron',
    label: 'Fer',
    emoji: '⚒️',
    color: '#64748b',
  },
  crop: {
    key: 'crop',
    label: 'Céréales',
    emoji: '🌾',
    color: '#ca8a04',
  },
}

// ---------------------------------------------------------------------------
// Ressources de l'inventaire joueur
// ---------------------------------------------------------------------------

export const PLAYER_RESOURCES: Record<PlayerResourceKey, ResourceDef> = {
  gold: {
    key: 'gold',
    label: 'Or',
    emoji: '🪙',
    color: '#eab308',
  },
  leadership: {
    key: 'leadership',
    label: 'Leadership',
    emoji: '👑',
    color: '#a855f7',
  },
}

// ---------------------------------------------------------------------------
// Ressources bonus artefacts (resourceBonus) — stone est distinct de clay :
// clay = matériau de construction, stone = résistance / bonus défensif
// ---------------------------------------------------------------------------

export const ARTIFACT_BONUS_RESOURCES: Record<ArtifactBonusKey, ResourceDef> = {
  wood: TRAVIAN_RESOURCES.wood,
  clay: TRAVIAN_RESOURCES.clay,
  iron: TRAVIAN_RESOURCES.iron,
  crop: TRAVIAN_RESOURCES.crop,
  stone: {
    key: 'stone' as ResourceKey,
    label: 'Pierre',
    emoji: '🪨',
    color: '#78716c',
  },
}

// ---------------------------------------------------------------------------
// Stats d'artefacts (economy / military / defense)
// ---------------------------------------------------------------------------

export interface StatDef {
  key: ArtifactStatKey
  label: string
  emoji: string
  color: string
}

export const ARTIFACT_STATS: Record<ArtifactStatKey, StatDef> = {
  economy: {
    key: 'economy',
    label: 'Économie',
    emoji: '📈',
    color: '#22c55e',
  },
  military: {
    key: 'military',
    label: 'Militaire',
    emoji: '⚔️',
    color: '#ef4444',
  },
  defense: {
    key: 'defense',
    label: 'Défense',
    emoji: '🛡️',
    color: '#3b82f6',
  },
}

// ---------------------------------------------------------------------------
// Bonus de terrain (affichage sur les tuiles)
// ---------------------------------------------------------------------------

export const TERRAIN_BONUS: Record<string, string> = {
  forest: '🪵 +50% Bois',
  mountain: '🪨 +50% Pierre',
  water: '🐟 +50% Poisson',
}

// ---------------------------------------------------------------------------
// Accès unifié
// ---------------------------------------------------------------------------

export const RESOURCES: Record<ResourceKey, ResourceDef> = {
  ...TRAVIAN_RESOURCES,
  ...PLAYER_RESOURCES,
}

/**
 * Retourne la définition d'une ressource par sa clé.
 * Lance une erreur en dev si la clé est inconnue.
 */
export function getResource(key: ResourceKey): ResourceDef {
  const def = RESOURCES[key]
  if (!def) throw new Error(`[resources] Clé de ressource inconnue : "${key}"`)
  return def
}

/**
 * Formate une valeur de ressource avec son emoji.
 * Ex : formatResource('gold', 150) → "🪙 150"
 */
export function formatResource(key: ResourceKey, value: number): string {
  const def = RESOURCES[key]
  if (!def) return `${value}`
  return `${def.emoji} ${value}`
}

// ---------------------------------------------------------------------------
// Ordre d'affichage canonique (pour les listes de ressources)
// ---------------------------------------------------------------------------

export const TRAVIAN_RESOURCE_ORDER: TravianResourceKey[] = ['wood', 'clay', 'iron', 'crop']
export const PLAYER_RESOURCE_ORDER: PlayerResourceKey[] = ['gold', 'leadership']

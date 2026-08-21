// ============================================================
// Combat System — Rôles & triangle des contres
// ============================================================
// Module pur, sans dépendance aux stores (même philosophie que
// combatResolver.ts). Sépare le "rôle" tactique (ce qui déclenche
// le triangle de contres) du "type" concret d'unité (spécifique à
// une race) — voir le plan de refonte du combat pour le contexte.
// ============================================================

export type Role = 'infantry' | 'archer' | 'cavalry' | 'siege'

/**
 * Correspondance type d'unité → rôle. Seedée avec les 4 ids génériques
 * (utilisés par les garnisons ennemies/PNJ, inchangés). Les unités
 * spécifiques à une race enregistrent leur propre rôle ici au moment
 * où elles sont définies dans UNIT_DEFINITIONS (missionStore.ts).
 */
export const ROLE_BY_UNIT_TYPE: Record<string, Role> = {
  infantry: 'infantry',
  archer: 'archer',
  cavalry: 'cavalry',
  siege: 'siege',
}

/** Enregistre le rôle d'un type d'unité (appelé lors de la définition des unités de race). */
export const registerUnitRole = (type: string, role: Role): void => {
  ROLE_BY_UNIT_TYPE[type] = role
}

/** Rôle d'un type d'unité, ou `null` si inconnu (aucun effet de contre appliqué). */
export const getUnitRole = (type: string): Role | null => ROLE_BY_UNIT_TYPE[type] ?? null

/**
 * Triangle des contres : cavalerie bat archer, archer bat infanterie,
 * infanterie bat cavalerie. Le siège reste hors-jeu (aucun rôle ne le
 * contre, il ne contre aucun rôle).
 */
export const ROLE_COUNTERS: Record<Role, Role | null> = {
  cavalry: 'archer',
  archer: 'infantry',
  infantry: 'cavalry',
  siege: null,
}

/**
 * Bonus de dégâts appliqué quand un rôle contre son cible (1.5 = +50%).
 * Valeur initiale à ajuster en playtest — voir le plan de refonte du combat.
 */
export const COUNTER_BONUS_MULTIPLIER = 1.5

/** Libellés lisibles d'un rôle (pour les résumés de rapport de combat) */
export const ROLE_LABELS: Record<Role, string> = {
  infantry: 'infanterie',
  archer: 'archers',
  cavalry: 'cavalerie',
  siege: 'machines de siège',
}

/**
 * Multiplicateur de dégâts d'un rôle attaquant face à la composition d'une
 * armée adverse, pondéré par la part (en nombre d'unités) de chaque rôle
 * présent en face. Ex : un rôle qui contre 60% de l'armée adverse et est
 * neutre sur les 40% restants obtient un multiplicateur de 0.6*BONUS + 0.4*1.
 * Retourne 1 (neutre) si le rôle est inconnu ou l'armée adverse est vide.
 */
export const computeCounterMultiplier = (
  attackerRole: Role | null,
  opposingUnits: readonly { type: string; count: number }[],
): number => {
  if (!attackerRole) return 1
  const total = opposingUnits.reduce((sum, u) => sum + u.count, 0)
  if (total <= 0) return 1

  let multiplier = 0
  for (const u of opposingUnits) {
    const opposingRole = getUnitRole(u.type)
    const share = u.count / total
    if (opposingRole && ROLE_COUNTERS[attackerRole] === opposingRole) {
      multiplier += share * COUNTER_BONUS_MULTIPLIER
    } else if (opposingRole && ROLE_COUNTERS[opposingRole] === attackerRole) {
      multiplier += share / COUNTER_BONUS_MULTIPLIER
    } else {
      multiplier += share
    }
  }
  return multiplier
}

/**
 * Puissance d'attaque totale d'un groupe d'unités face à une armée adverse,
 * en appliquant le multiplicateur de contre de chaque type d'unité attaquant
 * selon la composition adverse. Utilisé par combatResolver et raidResolver.
 */
export const computeWeightedAttackPower = (
  attackingUnits: readonly { type: string; count: number; attack: number }[],
  opposingUnits: readonly { type: string; count: number }[],
): number =>
  attackingUnits.reduce(
    (sum, u) => sum + u.attack * u.count * computeCounterMultiplier(getUnitRole(u.type), opposingUnits),
    0,
  )

/**
 * Rôle dominant d'une armée (celui qui totalise le plus d'unités). Utilisé
 * pour générer une phrase d'explication du contre dans le rapport de combat.
 * Retourne `null` si l'armée est vide ou ne contient que des types inconnus.
 */
export const getDominantRole = (units: readonly { type: string; count: number }[]): Role | null => {
  const counts: Partial<Record<Role, number>> = {}
  for (const u of units) {
    const role = getUnitRole(u.type)
    if (!role) continue
    counts[role] = (counts[role] ?? 0) + u.count
  }
  let best: Role | null = null
  let bestCount = 0
  for (const role of Object.keys(counts) as Role[]) {
    const count = counts[role] ?? 0
    if (count > bestCount) {
      bestCount = count
      best = role
    }
  }
  return best
}

/**
 * Phrase d'explication du contre dominant entre deux armées, ou chaîne vide
 * si aucun contre net ne joue entre leurs rôles dominants respectifs.
 */
export const describeCounterEffect = (
  attackerLabel: string,
  attackerUnits: readonly { type: string; count: number }[],
  defenderLabel: string,
  defenderUnits: readonly { type: string; count: number }[],
): string => {
  const attackerRole = getDominantRole(attackerUnits)
  const defenderRole = getDominantRole(defenderUnits)
  if (!attackerRole || !defenderRole) return ''

  if (ROLE_COUNTERS[attackerRole] === defenderRole) {
    return ` ${attackerLabel} (${ROLE_LABELS[attackerRole]}) a surclassé ${defenderLabel} (${ROLE_LABELS[defenderRole]}).`
  }
  if (ROLE_COUNTERS[defenderRole] === attackerRole) {
    return ` ${defenderLabel} (${ROLE_LABELS[defenderRole]}) a surclassé ${attackerLabel} (${ROLE_LABELS[attackerRole]}).`
  }
  return ''
}

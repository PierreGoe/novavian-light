// ============================================================
// Combat System — Types
// ============================================================
// Types purs sans dépendances aux stores.
// Utilisés par le resolver ET par les composants UI.
// ============================================================

/** Une unité dans une armée (escouade d'un type) */
export interface CombatUnit {
  type: string // 'infantry' | 'archer' | 'cavalry' | 'siege' | custom
  count: number
  attack: number // puissance d'attaque par unité
  defense: number // puissance de défense par unité
  health: number // PV par unité
}

/** Modificateur appliqué avant ou pendant le combat.
 *  C'est ici que les bonus de race / artefacts / terrain / etc.
 *  viendront se brancher à terme. */
export interface CombatModifier {
  id: string
  name: string
  source: 'race' | 'artifact' | 'terrain' | 'buff' | 'debuff' | 'other'
  /** Facteurs multiplicatifs (1.0 = neutre) */
  attackMultiplier?: number
  defenseMultiplier?: number
  /** Bonus additifs bruts */
  attackFlat?: number
  defenseFlat?: number
}

/** Une armée prête au combat */
export interface Army {
  label: string // ex: "Vos troupes", "Garnison de Village Ennemi"
  units: CombatUnit[]
  modifiers: CombatModifier[]
}

/** Pertes subies par une armée */
export interface ArmyLosses {
  /** Unités perdues par type (clé = type, valeur = nombre tués) */
  killed: Record<string, number>
  /** Unités survivantes */
  survivors: CombatUnit[]
}

/** Rapport final d'un combat */
export interface CombatReport {
  attackerVictory: boolean
  attacker: {
    army: Army
    losses: ArmyLosses
    totalPowerUsed: number
  }
  defender: {
    army: Army
    losses: ArmyLosses
    totalPowerUsed: number
  }
  /** Résumé textuel (pour afficher au joueur) */
  summary: string
  /** Données arbitraires que le resolver peut ajouter (butin, etc.) */
  extra?: Record<string, unknown>
}

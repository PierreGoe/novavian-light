# TODO — Système d'inventaire

## 🔴 Logique métier critique

- [ ] Appeler `consumeArtifactUse()` après chaque combat dans le résolveur de combat
- [ ] Appeler `destroyDestructiblesOnCampaignLoss()` lors d'une défaite de campagne (dans `gameStore` ou `CampaignView`)
- [ ] Les artefacts obtenus via `giveRandomArtifact()` ne sont jamais auto-activés — les ajouter dans un slot libre si disponible
- [ ] Brancher les `specialPower` dans la logique de jeu :
  - `scout_range_bonus` → affecter la portée de vision des éclaireurs dans `mapStore`
  - `first_strike` → modifier l'ordre d'attaque dans `combatResolver`
  - `healing_after_combat` → régénérer des unités après un combat gagné
  - `gold_on_victory` / `leadership_on_victory` → appliquer dans `completeCampaign()`
  - `fog_reveal_on_victory` → révéler des cases autour du joueur après victoire
  - `double_scout_speed` → réduire le coût en tours des éclaireurs

## 🟠 Contenu manquant

- [ ] **Forge d'artefacts** — bouton dans l'inventaire pour générer un artefact aléatoire en échange d'or (ex: 150 or → artefact commun, 400 or → rare, 900 or → épique). Destruction d'or irréversible.
- [ ] Ajouter des artefacts de rareté `legendary` dans le pool (aucun n'existe encore)
- [ ] Ajouter des artefacts `single-use` dans le pool de récompenses aléatoires
- [ ] Implémenter la boutique (`shop` node) : acheter des artefacts avec de l'or
- [ ] Créer des artefacts dédiés à chaque `SpecialPowerType` encore sans artefact concret (`first_strike`, `healing_after_combat`, `double_scout_speed`…)

## 🟡 UX / UI

- [ ] Indicateur visuel dans le header quand un artefact `uses-limited` est à 1 utilisation restante (badge rouge clignotant)
- [ ] Toast / animation quand une relique est détruite après une défaite de campagne
- [ ] Tri des artefacts dans la grille : actifs en premier, puis par rareté décroissante
- [ ] Bouton retour de `InventoryView` → cibler `/mission-tree` plutôt que `router.back()`
- [ ] Confirmation avant de désactiver une relique fragile encore active

## 🔵 Technique / qualité

- [ ] Remplacer `Date.now()` dans les IDs d'artefacts aléatoires par `crypto.randomUUID()` pour éviter les collisions
- [ ] Vérifier la cohérence `.value` sur `getEquippedArtifacts` et `getTotalArtifactEffects` dans le header (computed wrappé deux fois)
- [ ] Ajouter un test unitaire sur `destroyDestructiblesOnCampaignLoss()` pour valider les cas limites

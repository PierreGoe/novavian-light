# TODO — Système d'inventaire

## 🔴 Logique métier critique

Rien de critique en suspens : `consumeArtifactUse()` est appelé après chaque combat
(`LargeMapExplorationView.vue`), `destroyDestructiblesOnCampaignLoss()` est déclenché
dans `triggerGameOver()`, `giveRandomArtifact()` / `giveRandomArtifactOfRarity()`
auto-équipent dans un slot libre, et tous les `specialPower` déclarés
(`gold_on_victory`, `leadership_on_victory`, `first_strike`, `siege_bonus`,
`healing_after_combat`, `fog_reveal_on_victory`) sont branchés dans
`LargeMapExplorationView.vue`.

## 🟠 Contenu manquant

- [ ] Ajouter des artefacts de rareté `legendary` dans le pool (aucun n'existe encore)
- [ ] Ajouter des artefacts `single-use` dans le pool de récompenses aléatoires
- [ ] Créer des artefacts dédiés à chaque `SpecialPowerType` encore sans artefact concret (`first_strike`, `healing_after_combat`…)

## 🟡 UX / UI

- [ ] Indicateur visuel dans le header quand un artefact `uses-limited` est à 1 utilisation restante (badge rouge clignotant)
- [ ] Toast / animation quand une relique est détruite après une défaite de campagne
- [ ] Tri des artefacts dans la grille : actifs en premier, puis par rareté décroissante
- [ ] Bouton retour de `InventoryView` → cibler `/mission-tree` plutôt que `router.back()`
- [ ] Confirmation avant de désactiver une relique fragile encore active

## 🔵 Technique / qualité

- [ ] Vérifier la cohérence `.value` sur `getEquippedArtifacts` et `getTotalArtifactEffects` dans le header (computed wrappé deux fois)
- [ ] Ajouter un test unitaire sur `destroyDestructiblesOnCampaignLoss()` pour valider les cas limites

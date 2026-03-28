# Génération de carte — Architecture modulaire (Automate Cellulaire)

## Vue d'ensemble

La carte de mission est générée via un **pipeline en 5 étapes** qui produit des biomes naturels (massifs montagneux, lacs, forêts, plaines) avant de poser les événements de jeu par-dessus.

```
createRawGrid()
    ↓
smoothTerrain()       ← Automate Cellulaire
    ↓
buildEventOverlay()   ← Biome → événement
    ↓
generateMap()         ← MapLayer[] / MapNode[]
```

---

## Modules

### `TerrainTypes.ts`
Définit l'enum `TerrainType` (`plain | mountain | water | forest`) et la configuration par biome :
- Icône d'affichage (`⛰️`, `🌊`, `🌲`, rien pour la plaine)
- Couleur
- `passable` : si `false`, aucun node de jeu ne peut y être placé (montagne, eau)
- `initialDensity` : probabilité de départ avant lissage

**Pour ajouter un biome** : ajouter une entrée dans `TERRAIN_CONFIG`.

---

### `TerrainGrid.ts`
Crée la grille brute `TerrainCell[][]` en tirant un biome aléatoire par cellule selon les densités initiales. Fournit aussi les helpers :
- `getMooreNeighbors()` — 8 voisins d'une cellule
- `countNeighborsOfType()` — nombre de voisins d'un biome donné
- `cloneGrid()` — copie profonde

---

### `CellularAutomata.ts`
Lisse la grille brute en appliquant N itérations d'un automate cellulaire.

**Règles par biome (`DEFAULT_CA_RULES`)** :

| Biome    | `surviveThreshold` | `birthThreshold` |
|----------|--------------------|------------------|
| mountain | 3                  | 5                |
| water    | 3                  | 4                |
| forest   | 2                  | 3                |

- Une cellule **non-plaine** "meurt" (→ plaine) si elle a moins de `surviveThreshold` voisins identiques.
- Une cellule **plaine** "naît" en un biome si elle a au moins `birthThreshold` voisins de ce type.
- La priorité est `mountain > water > forest`.

Résultat : des massifs montagneux compacts, des lacs fermés, des forêts dispersées.

**Pour changer l'algorithme** (ex: remplacer par du bruit de Perlin) : remplacer uniquement ce fichier en conservant la signature `smoothTerrain(grid, iterations): TerrainGrid`.

---

### `BiomeEventTable.ts`
Définit les **probabilités d'événements** selon le biome (poids relatifs) :

| Événement | Plaine | Forêt |
|-----------|--------|-------|
| combat    | 25     | 35    |
| elite     | 5      | 10    |
| shop      | 15     | 5     |
| event     | 10     | 20    |
| rest      | 10     | 20    |
| **empty** | 35     | 10    |

Les biomes non-passables (montagne, eau) produisent toujours `empty`.

**`empty`** = case de plaine traversable visuellement mais sans interaction de jeu.

---

### `EventOverlay.ts`
Applique la table de biomes sur toute la grille terrain et produit un `NodeContent[][]`.
- Pour chaque cellule passable, tire un événement via `pickEventForBiome()`
- Associe titre, description, icône et récompense selon le type d'événement
- Les montagnes et lacs reçoivent `type: 'empty'` avec l'icône du terrain

---

### `mapGenerator.ts` (orchestrateur)
Point d'entrée conservé pour compatibilité avec le reste de l'app (`@/utils`). Exécute le pipeline complet et produit les `MapLayer[]` / `MapNode[]` attendus par les stores et composants.

Ajoute deux champs au `MapNode` :
- `terrainIcon` : icône du biome sous-jacent (`⛰️`, `🌊`, `🌲`, `""`)
- `terrainType` : le biome (`plain | mountain | water | forest`)

Ces champs permettent au composant de rendu d'afficher le fond de terrain même sur les cases vides.

---

## Modifier les paramètres

| Ce que tu veux changer | Fichier à modifier |
|---|---|
| Taille de la carte (lignes, colonnes) | `mapGenerator.ts` → `MAP_ROWS`, `MAP_COLS` |
| Taille des massifs / lacs | `CellularAutomata.ts` → `DEFAULT_CA_RULES` |
| Densité initiale des biomes | `TerrainTypes.ts` → `initialDensity` |
| Fréquence des événements par biome | `BiomeEventTable.ts` → `BIOME_EVENT_TABLE` |
| Titres / descriptions des events | `EventOverlay.ts` → `NODE_DEFINITIONS` |
| Récompenses des events | `EventOverlay.ts` → `generateRewardForType()` |
| Algo de génération terrain | Remplacer `CellularAutomata.ts` |



---

## Roadmap

### Phase 1 — Déplacement & temps de voyage

> ✅ Implémentée.

- [x] **1.1 Coût de déplacement par biome**
  - `moveCost` ajouté dans `TerrainTypes.ts` (plaine 1.0, forêt 1.5, montagne/eau 99)
  - `TERRAIN_MOVE_COST` dans `mapStore.ts` pour la carte d'exploration
  - Calcul : distance Chebyshev × coût terrain × `BASE_TILE_MOVE_DURATION_MS` / `GAME_SPEED_MULTIPLIER`
- [x] **1.2 Variable d'environnement `VITE_GAME_SPEED_MULTIPLIER`**
  - `VITE_BASE_TILE_MOVE_DURATION_MS=3000` (3s par case de plaine)
  - `VITE_GAME_SPEED_MULTIPLIER=10` en dev, `1` en prod
  - Exposé via `config.ts`
- [x] **1.3 Mouvements de troupes asynchrones**
  - `TroopMovement` + `MovementUnit` dans `mapStore.ts`
  - `dispatchTroops()` crée le mouvement, `resolveMovement()` le retire
  - Timer dans `LargeMapExplorationView` vérifie les arrivées toutes les secondes
  - `handleAttackTile` → dispatch uniquement ; `executeCombat()` → résolution à l'arrivée
  - Snapshot des unités au départ (modificateurs d'artefacts lus à la résolution)
- [x] **1.4 Adapter l'UI**
  - `LargeMapGrid` : icône 🪖 animée sur les tuiles cibles en transit
  - `TileDetails` : bandeau "Troupes en route — arrivée dans Xs" avec timer live
  - Toast à l'envoi et à la résolution du combat

---

### Phase 2 — Pillage & économie de guerre

> Donner un intérêt à attaquer les villages ennemis.

- [ ] **2.1 Système de pillage**
  - Chaque village ennemi possède un stock de ressources (or, bois, fer, crop)
  - Après victoire au combat, le joueur récupère une fraction du stock
  - Le stock se régénère lentement (timer `VITE_ENEMY_REGEN_INTERVAL_MS`)
  - Le pillage rend le village plus agressif (voir Phase 3)
  - les ville ne sont plus destructible si il n'y a pas d'arme de siège dans l'armée du joueur
- [ ] **2.2 Garnison régénérable**
  - La garnison vaincue se reconstruit progressivement
  - Un village pillé récemment est plus faible mais donne moins de butin

---

### Phase 3 — Agressivité des villages ennemis

> Les ennemis ne sont plus passifs — le joueur doit gérer la menace.

- [ ] **3.1 Score d'agressivité par village**
  - Nouveau champ `aggressivity: number` sur les tuiles `village_enemy`
  - L'agressivité monte quand le joueur attaque un village dans un rayon de N cases
  - Seuil configurable (`VITE_AGGRO_THRESHOLD`) → passe en mode agressif
- [ ] **3.2 Attaques automatiques (mode agressif)**
  - Un village agressif envoie des raids sur le village du joueur toutes les X secondes
  - Fréquence et puissance escaladent avec le temps (timer + multiplicateur)
  - Le joueur voit les raids en approche sur la carte (Phase 1.3 requise)
  - Si le joueur n'a pas de garnison chez lui → perte de ressources
- [ ] **3.3 Diplomatie : trêve**
  - Le joueur peut négocier une trêve avec un village agressif
  - Coût : or ou ressources (plus cher si l'agressivité est haute)
  - Durée limitée, configurable (`VITE_TRUCE_DURATION_MS`)
- [ ] **3.4 Neutralisation temporaire**
  - Attaque réussie → village inactif pendant X temps
  - Effet secondaire : +agressivité sur tous les villages voisins (rayon configurable)
  - Choix stratégique : neutraliser un village rend les autres plus dangereux

---

### Phase 4 — Boss & objectif final de campagne

> Objectif de fin de campagne : localiser et vaincre un boss.

- [ ] **4.1 Forteresse-boss**
  - Générée à la création de la carte, cachée dans une zone reculée (montagne ou forêt profonde)
  - Type de tuile spécial `boss_fortress` (non visible tant que non découvert)
  - Garnison très puissante, récompense massive (artefact légendaire + or)
- [ ] **4.2 Système d'indices**
  - Les combats contre les villages ennemis débloquent des indices
  - Les ruines explorées peuvent contenir des fragments de carte
  - Les événements aléatoires peuvent donner des rumeurs
  - UI : journal d'indices avec progression (0/5 → localisation révélée)
- [ ] **4.3 Course contre la montre**
  - La forteresse-boss lance des raids croissants dès le début de la campagne
  - `raidPower = basePower + (elapsed / VITE_BOSS_ESCALATION_MS) * scaleFactor`
  - Plus le joueur tarde, plus c'est difficile → incitation à progresser
  - Timer visuel dans le HUD de campagne
- [ ] **4.4 Récompense de victoire**
  - Vaincre le boss termine la campagne avec bonus
  - Artefact légendaire garanti (pool dédié dans `artifacts.ts`)
  - Bonus d'or massif + déblocage de la prochaine carte

---

### Dépendances entre phases

```
Phase 1 (déplacement)
   ↓
Phase 2 (pillage) ──→ Phase 3 (agressivité) ──→ Phase 4 (boss)
                              ↓
                       Phase 3.3 (trêve)
```

Phase 1 est le socle obligatoire. Phase 2 et 3 peuvent être développées en parallèle une fois Phase 1 terminée. Phase 4 nécessite Phase 3 (le boss utilise le système de raids).

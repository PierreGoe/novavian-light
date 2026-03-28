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

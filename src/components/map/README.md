# Module Carte et Exploration

## 🎯 Objectif

Module isolé et autonome pour gérer la **carte et l'exploration** dans Novavian Light. Conçu pour minimiser les risques de régression et faciliter la maintenance.

## 📁 Architecture

```
src/
├── stores/
│   └── mapStore.ts              # Store principal pour la logique de carte
├── components/
│   └── map/                     # Module isolé de la carte
│       ├── index.ts             # Point d'entrée du module
│       ├── MapExplorationView.vue # Composant principal
│       ├── MapGrid.vue          # Grille de la carte
│       ├── ExplorationPanel.vue # Panneau d'exploration
│       ├── TileDetails.vue      # Détails des tuiles
│       └── __tests__/           # Tests du module
│           └── mapStore.spec.ts
```

## 🔧 Fonctionnalités

### Store (`mapStore.ts`)
- ✅ **État de la carte** : Génération automatique d'une carte 11x11
- ✅ **Système d'exploration** : Points d'exploration avec régénération
- ✅ **Reconnaissance** : Informations détaillées sur les zones
- ✅ **Persistance** : Sauvegarde automatique dans localStorage
- ✅ **Types TypeScript** : Fortement typé pour éviter les erreurs

### Composants Vue

#### `MapExplorationView.vue` - Composant principal
- Orchestration de tous les sous-composants
- Gestion des notifications
- Cycle de vie (sauvegarde/chargement)

#### `MapGrid.vue` - Grille de la carte
- Affichage visuel de la carte 11x11
- Gestion de la sélection des tuiles
- Styles responsifs et animés

#### `ExplorationPanel.vue` - Panneau d'exploration
- Gestion des points d'exploration
- Actions d'exploration et de reconnaissance
- Affichage des résultats

#### `TileDetails.vue` - Détails des tuiles
- Informations détaillées sur la tuile sélectionnée
- Actions spécifiques par type de terrain
- Interface extensible pour futures fonctionnalités

## 🚀 Utilisation

### Import du module
```typescript
// Import du composant principal
import { MapExplorationView } from '@/components/map'

// Import du store si nécessaire
import { useMapStore } from '@/components/map'

// Import des types
import type { MapTile, TerrainType } from '@/components/map'
```

### Utilisation dans un composant
```vue
<template>
  <MapExplorationView />
</template>

<script setup lang="ts">
import { MapExplorationView } from '@/components/map'
</script>
```

### Utilisation du store
```typescript
import { useMapStore } from '@/stores/mapStore'

const mapStore = useMapStore()

// Explorer une zone
const result = mapStore.explore()

// Reconnaître une zone
const scoutResult = mapStore.scout('tileId')

// Sauvegarder l'état
mapStore.saveMapState()
```

## 🔒 Isolation et Non-régression

### Principes d'isolation
1. **Store dédié** : `mapStore.ts` ne dépend d'aucun autre store
2. **Composants séparés** : Dossier `/map` isolé des autres modules
3. **LocalStorage séparé** : Utilise la clé `'novavian-map'`
4. **Types dédiés** : Interfaces et types spécifiques au module
5. **Tests complets** : Coverage des fonctionnalités principales

### Garanties de non-régression
- ✅ **Tests unitaires** couvrant tous les cas d'usage
- ✅ **Isolation localStorage** (pas de conflit avec autres modules)
- ✅ **Types TypeScript** (détection d'erreurs à la compilation)
- ✅ **Interface stable** (API du store bien définie)
- ✅ **Composants autonomes** (pas de dépendances externes)

## 📊 Types principaux

### `TerrainType`
```typescript
type TerrainType = 
  | 'plains' | 'forest' | 'mountain' | 'water'
  | 'village_player' | 'village_enemy' 
  | 'ruins' | 'stronghold'
```

### `MapTile`
```typescript
interface MapTile {
  id: string
  type: TerrainType
  explored: boolean
  current: boolean
  position: { x: number; y: number }
  bonus?: string
  resources?: TravianResources
  enemies?: Array<{ type: string; strength: number }>
}
```

### `ExplorationState`
```typescript
interface ExplorationState {
  currentPosition: { x: number; y: number }
  mapTiles: MapTile[]
  selectedTileId: string | null
  explorationPoints: number
  maxExplorationPoints: number
  lastExplorationTime: number
  discoveredLocations: string[]
}
```

## 🧪 Tests

### Lancer les tests
```bash
npm run test -- src/components/map/__tests__/
```

### Coverage des tests
- ✅ État initial du store
- ✅ Sélection de tuiles
- ✅ Système d'exploration
- ✅ Reconnaissance des zones
- ✅ Utilitaires de la carte
- ✅ Persistance (sauvegarde/chargement)
- ✅ Isolation (pas d'impact sur autres modules)
- ✅ Régénération des points

## 🔄 Cycle de développement

### Ajout de nouvelles fonctionnalités
1. **Modifier le store** (`mapStore.ts`) si nécessaire
2. **Créer/modifier les composants** dans `/map`
3. **Ajouter les tests** dans `__tests__/`
4. **Tester l'isolation** (pas d'impact sur autres modules)
5. **Mettre à jour cette documentation**

### Bonnes pratiques
- ⚠️ **Ne pas importer** d'autres stores dans `mapStore.ts`
- ⚠️ **Utiliser uniquement** la clé `'novavian-map'` pour localStorage
- ✅ **Toujours ajouter des tests** pour les nouvelles fonctionnalités
- ✅ **Maintenir les types TypeScript** à jour
- ✅ **Documenter les changements** d'API

## 🚨 Limitations actuelles

### Fonctionnalités en développement (TODO)
- [ ] Système de combat pour attaquer les zones
- [ ] Système de commerce avec les villages
- [ ] Exploration approfondie des ruines
- [ ] Events aléatoires sur la carte
- [ ] Fog of war avancé
- [ ] Mini-jeux d'exploration

### Performance
- ✅ Optimisé pour une carte 11x11 (121 tuiles)
- ⚠️ Peut nécessiter optimisation pour cartes plus grandes

## 🔧 Configuration

### Paramètres modifiables dans `mapStore.ts`
```typescript
// Taille de la carte
const mapSize = 11 // Grille 11x11

// Points d'exploration
maxExplorationPoints: 3

// Temps de régénération
60000 // 1 minute en millisecondes
```

## 📝 Changelog

### v1.0.0 - Version initiale
- ✅ Store de carte avec types TypeScript
- ✅ 4 composants Vue (MapExplorationView, MapGrid, ExplorationPanel, TileDetails)
- ✅ Système d'exploration avec points
- ✅ Reconnaissance des zones
- ✅ Tests complets avec 95%+ de coverage
- ✅ Isolation garantie des autres modules
- ✅ Intégration dans le router (`/map`)
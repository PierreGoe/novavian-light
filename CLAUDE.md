# Novavian Light — instructions Claude Code

Jeu de stratégie type Travian, 100 % front-end (aucun backend). Vue 3 Composition API + TypeScript + Vite. Projet perso time-boxé : **privilégier la solution simple qui marche, pas de refacto ni de sur-ingénierie non demandés.** Code, commentaires et réponses en français. Les commentaires du code expliquent le *pourquoi* (équilibrage, bugs corrigés) : les lire avant de modifier.

⚠️ Pierre édite parfois le repo dans une autre session en parallèle — toujours relire un fichier avant de l'éditer.

## Commandes & vérifications

- `npm run test:unit -- --run` — vitest (sans `--run` : mode watch, bloque)
- `npm run type-check` — `vue-tsc --build`
- `npm run lint` — eslint `--fix` (3 erreurs préexistantes connues : combatResolver, raidResolver, missionStore)
- `npm run build` = type-check + build (ne pas relancer si on vient de type-checker)
- `npm run dev` (Vite), `npm run storybook` (port 6006)

**Politique de vérification** :
- Logique de jeu (`src/combat`, `src/game`, `src/stores`, `src/data`) → tests unitaires + type-check.
- Modif purement visuelle (templates, styles) → type-check seul.
- E2E Playwright : quasi vide (scaffold), ne lancer que sur demande.
- **Chrome DevTools MCP : dernier recours uniquement** (lent). Ne jamais ouvrir le navigateur « pour vérifier » — proposer à Pierre si une vérification visuelle semble nécessaire.

## Architecture

- `src/combat/` — moteur de combat **pur, sans stores** : roles.ts (triangle infantry/archer/cavalry), combatResolver.ts, raidResolver.ts, loot.ts, attackPlanner.ts
- `src/game/` — timePressure.ts : croissance des villages IA sur temps de jeu **actif** (G(t) global + rythme par village via hash de tile.id)
- `src/data/` — catalogues statiques, sources uniques de vérité (buildings.ts, artifacts.ts, villageLayout.ts…)
- `src/stores/` — état global (voir pattern ci-dessous) : gameStore, mapStore, missionStore, gameSettingsStore, toastStore
- `src/composables/` — useExplorationTicker (boucle de jeu), useMapViewport, useUnitTraining…
- `src/components/ui/` — ~30 primitives design-system, chacune avec son `.stories.ts` colocalisé ; noms d'un seul mot autorisés
- `src/components/` — métier par domaine : home/, mission/, campaign/(+village/), map/, inventory/, reports/, settings/, globals/ (SideNavBar, ToastContainer)
- `src/utils/` — formatters, debounce (avec `.flush()`), génération de carte (`utils/map/`)
- `src/router/index.ts` — routes statiques, aucun guard. **`/campaign` (CampaignLayout) est la route structurante** : elle reste montée entre Carte (`campaign-map`) et Village (`campaign-village`) et héberge tous les services de fond (`onMounted` → loadMissionState, startAllServices, loadMapState, startTicker). Ne jamais démarrer ces services ailleurs (double intervalle).

## Stores : PAS de Pinia

Singleton `reactive()` au niveau module + factory d'accès :

```ts
const gameState = reactive<GameState>(createInitialState()) // singleton module
export const useGameStore = () => ({ gameState, startNewGame, saveGame, ... })
```

- `useXStore()` ne crée rien : simple accès, appelable partout (y compris hors setup).
- L'état survit entre les tests → reset manuel dans chaque spec.
- `toastStore` utilise des `ref` retournés bruts → `.value` visible dans les templates.
- `gameSettingsStore` exporte directement `gameSettings` (reactive), sans factory.
- Les stores importent `@/router` (navigation + onClick de toasts) : couplage assumé.

## Temps de jeu & persistance

- Modèle hybride : `setInterval` 1 Hz (`missionStore.startDisplayUpdates` = unique appel à `updateResourceProduction`) + rattrapage par timestamps au chargement, plafonné par `MAX_OFFLINE_MS`.
- **Deux horloges** dans missionState : `gameElapsedMs` (temps in-game, crédite l'offline) et `pressureElapsedMs` (temps de jeu **actif** seulement — la pression du temps ne monte jamais hors-ligne).
- localStorage, clés `novavian-save` / `novavian-missions` / `novavian-map` / `novavian-game-settings`. Écritures **debouncées 400 ms** (`saveGame()`…) + `flushXxx()` immédiats sur `beforeunload`/`visibilitychange`. Ne jamais sauvegarder dans le tick de production (1 write/s).
- `loadMissionState()` commence par `flushMissionState()` — sinon relecture d'un save périmé qui ressuscite des troupes parties en mouvement. Ne pas casser ce garde-fou ni la migration des vieux saves (garnison vide ≠ garnison absente).

## Conventions UI

- **Tokens** : `src/styles/tokens.css` (couleurs uniquement, thème clair unique, importé dans App.vue + Storybook). Jamais de couleurs en dur. Chaque couleur a un doublon `--x-rgb` pour `rgba(var(--x-rgb), 0.4)`. Respecter les ratios WCAG documentés en commentaire.
- **Toasts** : `useToastStore()` → `showSuccess/showError/showWarning/showInfo(msg, { duration, persistent, onClick })`. Convention forte : les toasts d'événement portent un `onClick` de navigation. Messages en français préfixés d'un emoji (⚔️ 💀 🏠).
- **Navigation vers une tuile** : `mapStore.selectTile(id)` + `router.push({ name: 'campaign-map' })` (watcher de sync dans LargeMapExplorationView).
- Collapse sidebar/timers : `CustomEvent` window (`sidebar-toggle`, `timers-panel-toggle`), pas de store.
- Accessibilité clic : directive `v-clickable` sur les `<div @click>`.
- Composants ui/ : `withDefaults(defineProps<{...}>())`, variants en unions de littéraux (`'primary' | 'secondary' | ...`).

## Tests

- Deux conventions volontaires : `.test.ts` colocalisé pour la logique pure (combat/, game/), `__tests__/*.spec.ts` pour stores/data/app.
- Pas de `globals: true` ni de setupFiles → importer `describe/it/expect/vi` depuis `'vitest'`.
- jsdom, alias `@` dispo (vitest.config merge vite.config), `e2e/**` exclu.

## Pièges connus

- Alias `@/` déclaré **3 fois** : vite.config.ts, tsconfig.app.json, .storybook/main.ts — modifier les trois ensemble.
- `base: '/novavian-light/'` dans vite.config.ts (GitHub Pages) : le build ne se sert pas à la racine.
- **`config.ts` vs `gameSettingsStore`** : `config.ts` est le point de passage unique des `import.meta.env.VITE_*` (jamais d'import direct ailleurs), mais pour le gameplay c'est `gameSettings` qui gagne (ex. `gameSpeedMultiplier` ; `config.GAME_SPEED_MULTIPLIER` n'est jamais lu). Règle : gameplay → `gameSettings`, déploiement/infra → `config.ts`.
- `MAX_OFFLINE_MS` vaut 0 par défaut ; c'est `.env.development` (commité) qui le met à 2 h et active les cheats — comportement dev ≠ prod voulu.
- Cycles d'imports cassés par injection manuelle : `registerPressureClock()` (timePressure ← missionStore) et `registerUnitRole()` (roles.ts ← missionStore, side-effect au niveau module). Ne pas toucher à l'ordre de ces enregistrements.
- `scripts/balance.mjs` **duplique à la main** les données de buildings.ts : à resynchroniser si on modifie les coûts.
- Stores monolithiques (mapStore 65 Ko…) : ne pas entreprendre de découpage sans demande explicite.

<template>
  <div class="game-screen main-content">
    <div class="game-header">
      <h1>MiniTravian - En Jeu</h1>
      <p>Votre partie avec les {{ gameStore.gameState.race?.name || 'Inconnu' }}</p>
    </div>

    <div class="game-content">
      <!-- Afficher l'arbre de missions si aucune section de jeu n'est sélectionnée -->
      <MissionTree v-if="!currentSection" />

      <!-- Section de jeu sélectionnée (à implémenter plus tard) -->
      <div v-else class="game-section">
        <h2>{{ getSectionTitle(currentSection) }}</h2>
        <div class="coming-soon">
          <h3>🚧 Section en développement 🚧</h3>
          <p>La section "{{ currentSection }}" sera implémentée prochainement.</p>

          <button @click="resetToMissionTree" class="reset-button">
            ← Retour à l'arbre de décisions
          </button>

          <button @click="goHome" class="home-button">🏠 Retour à l'accueil</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import MissionTree from '@/components/MissionTree.vue'

// Props depuis la route
interface Props {
  section?: string
}

const props = defineProps<Props>()
const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()

// Détermine quelle section afficher
const currentSection = computed(() => {
  // Priority: URL param > game state > none
  const routeSection = Array.isArray(route.params.section)
    ? route.params.section[0]
    : route.params.section
  return props.section || routeSection || gameStore.gameState.currentGameSection
})

onMounted(() => {
  // Charger la partie si elle existe
  if (!gameStore.gameState.isGameStarted) {
    gameStore.loadGame()
  }

  // Si on a une section dans l'URL, l'enregistrer dans le store
  if (props.section && props.section !== gameStore.gameState.currentGameSection) {
    gameStore.gameState.currentGameSection = props.section
    gameStore.saveGame()
  }

  // Démarrer l'auto-save
  gameStore.startAutoSave()
})

const getSectionTitle = (section: string | undefined): string => {
  const sectionTitles: { [key: string]: string } = {
    'fortress-battle': 'La Bataille de la Forteresse',
    'fertile-conquest': 'Conquête des Terres Fertiles',
    'mountain-control': 'Contrôle du Passage Montagnard',
    'trade-network': 'Empire Commercial',
    'mining-operation': 'Exploitation Minière',
    'agricultural-boom': 'Révolution Agricole',
    'tribal-pact': 'Alliance Tribale',
    'city-confederation': 'Confédération des Cités',
    'naval-alliance': 'Alliance Maritime',
  }
  return sectionTitles[section || ''] || 'Section Inconnue'
}

const resetToMissionTree = () => {
  gameStore.gameState.currentGameSection = undefined
  gameStore.saveGame()
  router.push('/mission-tree')
}

const goHome = () => {
  router.push('/')
}
</script>
<style scoped>
.game-screen {
  min-height: 100vh;
  background: linear-gradient(135deg, #2c1810 0%, #1a0f08 100%);
  color: #f4e4bc;
  padding: 2rem;
}

.game-header {
  text-align: center;
  margin-bottom: 2rem;
}

.game-header h1 {
  margin: 0;
  color: #daa520;
  font-size: 2rem;
}

.game-header p {
  margin: 0.5rem 0 0;
  opacity: 0.8;
}

.game-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  gap: 2rem;
}

.coming-soon {
  background: rgba(218, 165, 32, 0.1);
  border: 2px solid #daa520;
  border-radius: 15px;
  padding: 2rem;
  text-align: center;
}

.coming-soon h2,
.coming-soon h3 {
  margin: 0 0 1rem;
  color: #daa520;
}

.coming-soon p {
  margin: 0.5rem 0;
  opacity: 0.9;
}

.game-section {
  text-align: center;
  padding: 2rem;
}

.game-section h2 {
  font-size: 2rem;
  color: #daa520;
  margin-bottom: 2rem;
}

.reset-button,
.home-button {
  background: linear-gradient(45deg, #8b4513, #daa520);
  border: none;
  color: #f4e4bc;
  padding: 0.8rem 1.5rem;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  margin: 0.5rem;
  transition: all 0.3s ease;
}

.reset-button:hover,
.home-button:hover {
  background: linear-gradient(45deg, #daa520, #ffd700);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(218, 165, 32, 0.4);
}

.reset-button {
  background: rgba(139, 69, 19, 0.6);
}

.reset-button:hover {
  background: rgba(218, 165, 32, 0.4);
}

@media (max-width: 768px) {
  .game-screen {
    padding: 1rem;
  }

  .resources-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

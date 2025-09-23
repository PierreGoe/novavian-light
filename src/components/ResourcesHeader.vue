<template>
  <header class="resources-header" v-if="shouldShowResources">
    <div class="header-content">
      <!-- Logo/Titre du jeu -->
      <div class="game-logo">
        <h1>MiniTravian - Ressources</h1>
      </div>

      <!-- Ressources -->
      <div class="resources-display">
        <div class="resource-item">
          <span class="resource-icon">🪵</span>
          <span class="resource-amount">{{
            formatNumber(gameStore.gameState.resources.wood)
          }}</span>
          <span class="resource-label">Bois</span>
        </div>

        <div class="resource-item">
          <span class="resource-icon">🪨</span>
          <span class="resource-amount">{{
            formatNumber(gameStore.gameState.resources.stone)
          }}</span>
          <span class="resource-label">Pierre</span>
        </div>

        <div class="resource-item">
          <span class="resource-icon">⚙️</span>
          <span class="resource-amount">{{
            formatNumber(gameStore.gameState.resources.iron)
          }}</span>
          <span class="resource-label">Fer</span>
        </div>

        <div class="resource-item">
          <span class="resource-icon">🌾</span>
          <span class="resource-amount">{{
            formatNumber(gameStore.gameState.resources.food)
          }}</span>
          <span class="resource-label">Nourriture</span>
        </div>

        <div class="separator"></div>

        <!-- Population -->
        <div class="resource-item population">
          <span class="resource-icon">👥</span>
          <span class="resource-amount">{{ gameStore.gameState.population }}</span>
          <span class="resource-label">Population</span>
        </div>
      </div>

      <!-- Race et actions -->
      <div class="header-actions">
        <div class="race-badge">
          <span class="race-icon">{{ gameStore.gameState.race?.icon }}</span>
          <span class="race-name">{{ gameStore.gameState.race?.name }}</span>
        </div>

        <button class="save-button" @click="saveGame" title="Sauvegarder">💾</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

const route = useRoute()
const gameStore = useGameStore()

// Définir quand afficher les ressources de base (bois, pierre, fer, nourriture)
const shouldShowResources = computed(() => {
  if (!gameStore.gameState.isGameStarted) return false

  // Afficher les ressources seulement dans certaines sections de jeu
  const gameplayRoutes = ['/game', '/mission-tree']
  const currentPath = route.path

  // Vérifier si on est dans une route de gameplay actif
  const isInGameplayRoute = gameplayRoutes.some((path) => currentPath.startsWith(path))

  // Ou si on a une section de jeu active qui nécessite des ressources
  const gameplaySections = [
    'fortress-battle',
    'fertile-conquest',
    'mountain-control',
    'trade-network',
    'mining-operation',
    'agricultural-boom',
  ]
  const hasActiveGameplaySection = gameplaySections.includes(
    gameStore.gameState.currentGameSection || '',
  )

  return isInGameplayRoute || hasActiveGameplaySection
})

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

const saveGame = () => {
  gameStore.saveGame()
  // Petit effet visuel pour confirmer la sauvegarde
  const button = document.querySelector('.save-button') as HTMLElement
  if (button) {
    button.style.transform = 'scale(0.9)'
    setTimeout(() => {
      button.style.transform = 'scale(1)'
    }, 150)
  }
}
</script>

<style scoped>
.resources-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: linear-gradient(135deg, #2c1810 0%, #1a0f08 100%);
  border-bottom: 2px solid #8b4513;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.8rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.game-logo h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #daa520;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
  font-weight: bold;
  white-space: nowrap;
}

.resources-display {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 1;
  justify-content: center;
  max-width: 800px;
}

.resource-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.8rem;
  background: rgba(139, 69, 19, 0.3);
  border: 1px solid rgba(218, 165, 32, 0.4);
  border-radius: 8px;
  min-width: 70px;
  transition: all 0.3s ease;
}

.resource-item:hover {
  background: rgba(218, 165, 32, 0.2);
  border-color: #daa520;
  transform: translateY(-1px);
}

.resource-item.population {
  border-color: rgba(100, 149, 237, 0.4);
}

.resource-item.population:hover {
  background: rgba(100, 149, 237, 0.2);
  border-color: #6495ed;
}

.resource-icon {
  font-size: 1.2rem;
  margin-bottom: 0.2rem;
}

.resource-amount {
  font-size: 1rem;
  font-weight: bold;
  color: #daa520;
  line-height: 1;
}

.resource-label {
  font-size: 0.7rem;
  opacity: 0.8;
  margin-top: 0.1rem;
  line-height: 1;
}

.separator {
  width: 1px;
  height: 40px;
  background: rgba(218, 165, 32, 0.3);
  margin: 0 0.5rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.race-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.8rem;
  background: rgba(218, 165, 32, 0.2);
  border: 1px solid #daa520;
  border-radius: 8px;
  white-space: nowrap;
}

.race-icon {
  font-size: 1.2rem;
}

.race-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #daa520;
}

.save-button {
  background: rgba(139, 69, 19, 0.4);
  border: 1px solid #8b4513;
  color: #f4e4bc;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.3s ease;
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.save-button:hover {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
  transform: scale(1.05);
}

.save-button:active {
  transform: scale(0.95);
}

/* Responsive */
@media (max-width: 1024px) {
  .header-content {
    gap: 1rem;
    padding: 0.6rem 1rem;
  }

  .resources-display {
    gap: 1rem;
  }

  .resource-item {
    min-width: 60px;
    padding: 0.3rem 0.6rem;
  }

  .resource-icon {
    font-size: 1rem;
  }

  .resource-amount {
    font-size: 0.9rem;
  }

  .resource-label {
    font-size: 0.65rem;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 0.8rem;
    padding: 0.8rem 1rem;
  }

  .game-logo h1 {
    font-size: 1.3rem;
  }

  .resources-display {
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.8rem;
  }

  .separator {
    display: none;
  }

  .header-actions {
    gap: 0.8rem;
  }
}

@media (max-width: 480px) {
  .resources-display {
    grid-template-columns: repeat(2, 1fr);
    display: grid;
    width: 100%;
    max-width: 300px;
  }

  .resource-item {
    min-width: auto;
  }

  .race-name {
    display: none;
  }
}
</style>

<template>
  <div class="home-screen main-content">
    <div class="background-overlay"></div>

    <header class="game-header">
      <h1 class="game-title">MiniTravian</h1>
      <p class="game-subtitle">Votre aventure commence ici</p>
    </header>

    <main class="content-section">
      <div class="game-options">
        <div class="option-card new-game" @click="startNewGame">
          <div class="card-icon">⚔️</div>
          <h3>Nouvelle Partie</h3>
          <p>Commencez votre conquête</p>
        </div>

        <div
          class="option-card load-game"
          :class="{ disabled: !gameStore.hasSavedGame.value }"
          @click="loadGame"
        >
          <div class="card-icon">📜</div>
          <h3>Continuer</h3>
          <p>{{ gameStore.hasSavedGame.value ? 'Reprenez votre partie' : 'Aucune sauvegarde' }}</p>
        </div>

        <div class="option-card settings" @click="showSettings">
          <div class="card-icon">⚙️</div>
          <h3>Paramètres</h3>
          <p>Configuration du jeu</p>
        </div>
      </div>

      <div class="game-info">
        <p>Version prototype - Front-end uniquement</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

const router = useRouter()
const gameStore = useGameStore()

onMounted(() => {
  // Vérifier s'il existe une sauvegarde au montage
  // (Le computed hasSavedGame du store gère cela automatiquement)
})

const startNewGame = () => {
  // Naviguer vers la sélection de race
  router.push('/race-selection')
}

const loadGame = () => {
  if (!gameStore.hasSavedGame.value) return

  // Charger la partie sauvegardée
  const success = gameStore.loadGame()
  if (success) {
    console.log('Partie chargée avec succès')

    // Naviguer vers la bonne route selon l'état du jeu
    if (gameStore.gameState.currentGameSection) {
      router.push(`/game/${gameStore.gameState.currentGameSection}`)
    } else {
      router.push('/mission-tree')
    }
  } else {
    console.error('Erreur lors du chargement de la partie')
  }
}

const showSettings = () => {
  // TODO: Implémenter les paramètres
  console.log('Paramètres (à implémenter)')
}
</script>

<style scoped>
.home-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #2c1810 0%, #1a0f08 100%);
  color: #f4e4bc;
  position: relative;
  overflow: hidden;
}

.background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(218, 165, 32, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(139, 69, 19, 0.1) 0%, transparent 50%);
  pointer-events: none;
}

.game-header {
  text-align: center;
  margin-bottom: 3rem;
  z-index: 1;
}

.game-title {
  font-size: 4rem;
  font-weight: bold;
  margin: 0;
  background: linear-gradient(45deg, #daa520, #ffd700, #daa520);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  animation: titleGlow 3s ease-in-out infinite alternate;
}

@keyframes titleGlow {
  0% {
    filter: drop-shadow(0 0 10px rgba(218, 165, 32, 0.3));
  }
  100% {
    filter: drop-shadow(0 0 20px rgba(218, 165, 32, 0.6));
  }
}

.game-subtitle {
  font-size: 1.2rem;
  margin: 1rem 0 0;
  opacity: 0.8;
  font-style: italic;
}

.main-content {
  z-index: 1;
  max-width: 900px;
  width: 100%;
  padding: 0 2rem;
}

.game-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.option-card {
  background: rgba(139, 69, 19, 0.3);
  border: 2px solid #8b4513;
  border-radius: 15px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.option-card:hover:not(.disabled) {
  background: rgba(218, 165, 32, 0.2);
  border-color: #daa520;
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(218, 165, 32, 0.3);
}

.option-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.option-card h3 {
  margin: 0.5rem 0;
  font-size: 1.5rem;
  color: #daa520;
}

.option-card p {
  margin: 0;
  opacity: 0.8;
  font-size: 0.95rem;
}

.game-info {
  text-align: center;
  opacity: 0.6;
  font-size: 0.9rem;
}

/* Responsive */
@media (max-width: 768px) {
  .game-title {
    font-size: 2.5rem;
  }

  .game-options {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .option-card {
    padding: 1.5rem;
  }
}
</style>

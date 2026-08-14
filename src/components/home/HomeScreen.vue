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
          <span class="new-game-badge">Commencer</span>
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
import { useMissionStore } from '@/stores/missionStore'
import { useMapStore } from '@/stores/mapStore'
import { useToastStore } from '@/stores/toastStore'

const router = useRouter()
const gameStore = useGameStore()
const missionStore = useMissionStore()
const mapStore = useMapStore()
const toastStore = useToastStore()

onMounted(() => {
  // Vérifier s'il existe une sauvegarde au montage
  // (Le computed hasSavedGame du store gère cela automatiquement)
})

const startNewGame = () => {
  if (
    gameStore.hasSavedGame.value &&
    !window.confirm('Une partie sauvegardée existe déjà. La commencer écrasera définitivement cette sauvegarde. Continuer ?')
  ) {
    return
  }

  // Réinitialiser tous les stores avant de démarrer une nouvelle partie
  gameStore.resetGameCompletely()
  missionStore.resetMissionState()
  mapStore.resetMapState()

  // Naviguer vers la sélection de race
  router.push('/race-selection')
}

const loadGame = () => {
  if (!gameStore.hasSavedGame.value) return

  // Charger la partie sauvegardée
  const success = gameStore.loadGame()
  if (success) {
    toastStore.showSuccess('Partie chargée avec succès', { duration: 2000 })

    // Naviguer vers la carte des missions
    router.push('/mission-tree')
  } else {
    toastStore.showError('Erreur lors du chargement de la partie', { duration: 3000 })
  }
}

const showSettings = () => {
  router.push('/settings')
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
  margin: auto;
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
  position: relative;
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

.option-card.new-game {
  background: rgba(218, 165, 32, 0.18);
  border-color: #ffd700;
  box-shadow: 0 0 24px rgba(218, 165, 32, 0.25);
}

.option-card.new-game:hover {
  box-shadow: 0 12px 34px rgba(218, 165, 32, 0.45);
}

.new-game-badge {
  position: absolute;
  top: -0.75rem;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(45deg, #daa520, #ffd700);
  color: #1a0f08;
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 0.04em;
  padding: 0.25rem 0.8rem;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
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

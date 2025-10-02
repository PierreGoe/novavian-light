<template>
  <div class="game-over-screen">
    <div class="game-over-overlay">
      <div class="game-over-content">
        <!-- Animation Game Over -->
        <div class="game-over-animation">
          <div class="skull-icon">💀</div>
          <div class="game-over-title">GAME OVER</div>
        </div>

        <!-- Raison du Game Over -->
        <div class="game-over-reason">
          <h2>{{ gameOverReason || 'Votre leadership a été épuisé' }}</h2>
          <p class="reason-description">
            Votre autorité s'est effondrée et vos troupes ont perdu confiance en votre leadership.
            L'empire s'écroule sous le poids de vos décisions...
          </p>
        </div>

        <!-- Statistiques de la partie -->
        <div class="game-stats" v-if="gameState.race">
          <h3>📊 Statistiques de votre règne</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Race choisie:</span>
              <span class="stat-value">{{ gameState.race.name }} {{ gameState.race.icon }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Or restant:</span>
              <span class="stat-value">💰 {{ gameState.inventory.gold }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Artefacts collectés:</span>
              <span class="stat-value">🎁 {{ gameState.inventory.artifacts.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Temps de jeu:</span>
              <span class="stat-value">⏱️ {{ formatPlayTime() }}</span>
            </div>
          </div>
        </div>

        <!-- Options disponibles -->
        <div class="game-over-actions">
          <h3>🎮 Que voulez-vous faire maintenant ?</h3>

          <div class="action-buttons">
            <!-- Recommencer avec la même race -->
            <button
              class="action-btn restart-same-race"
              @click="restartWithSameRace"
              v-if="gameState.race"
            >
              <span class="btn-icon">🔄</span>
              <div class="btn-content">
                <span class="btn-title">Recommencer</span>
                <span class="btn-subtitle">Avec {{ gameState.race.name }}</span>
              </div>
            </button>

            <!-- Changer de race -->
            <button class="action-btn change-race" @click="changeRace">
              <span class="btn-icon">🎭</span>
              <div class="btn-content">
                <span class="btn-title">Changer de Race</span>
                <span class="btn-subtitle">Nouveau début, nouvelle stratégie</span>
              </div>
            </button>

            <!-- Retour à l'accueil -->
            <button class="action-btn go-home" @click="goHome">
              <span class="btn-icon">🏠</span>
              <div class="btn-content">
                <span class="btn-title">Menu Principal</span>
                <span class="btn-subtitle">Retour à l'accueil</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Conseils pour améliorer -->
        <div class="tips-section">
          <h4>💡 Conseils pour votre prochaine partie</h4>
          <ul class="tips-list">
            <li>🛡️ Priorisez les nœuds de repos pour récupérer du leadership</li>
            <li>⚔️ Évitez les combats d'élite si votre leadership est faible</li>
            <li>🎁 Collectez des artefacts pour améliorer vos capacités</li>
            <li>💰 Gérez votre or pour acheter des améliorations dans les magasins</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
<!--
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'

const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()

const gameState = computed(() => gameStore.gameState)
const gameOverReason = computed(() => gameStore.gameState.gameOverReason)

onMounted(() => {
  console.log('🎮 GameOverScreen component mounted!')
  console.log('📊 Game Over state:', {
    isGameOver: gameState.value.isGameOver,
    reason: gameOverReason.value,
    leadership: gameState.value.inventory.leadership
  })
})

const formatPlayTime = () => {
  if (!gameState.value.createdAt) return 'Inconnu'
  
  const startTime = new Date(gameState.value.createdAt)
  const now = new Date()
  const diffMs = now.getTime() - startTime.getTime()
  
  const minutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}min`
  }
  return `${minutes}min`
}

const restartWithSameRace = () => {
  console.log('🔄 Restarting with same race...')
  
  if (!gameState.value.race) {
    toastStore.showError('Aucune race sélectionnée', { duration: 2000 })
    return
  }
  
  // Sauvegarder la race actuelle
  const currentRace = { ...gameState.value.race }
  
  // Reset seulement la progression, pas la race
  gameStore.resetMapOnly()
  
  // Réinitialiser l'état Game Over
  gameStore.gameState.isGameOver = false
  gameStore.gameState.gameOverReason = undefined
  gameStore.gameState.currentGameSection = undefined
  
  gameStore.saveGame()
  
  toastStore.showSuccess(`Nouvelle partie commencée avec ${currentRace.name}!`, { duration: 3000 })
  
  // Naviguer vers la carte des missions
  router.push('/mission-tree')
}

const changeRace = () => {
  console.log('🎭 Changing race...')
  
  // Reset complet
  gameStore.resetGameCompletely()
  
  toastStore.showInfo('Choisissez votre nouvelle race', { duration: 2000 })
  
  // Naviguer vers la sélection de race
  router.push('/race-selection')
}

const goHome = () => {
  console.log('🏠 Going to home...')
  
  // On garde l'état Game Over pour permettre de revenir
  toastStore.showInfo('Retour au menu principal', { duration: 2000 })
  
  // Naviguer vers l'accueil
  router.push('/')
}
</script>-->

<style scoped>
.game-over-screen {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a0000 0%, #4a0000 50%, #1a0000 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  overflow: hidden;
}

.game-over-screen::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(220, 20, 60, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(139, 0, 0, 0.1) 0%, transparent 50%);
  animation: pulseBackground 4s ease-in-out infinite;
}

@keyframes pulseBackground {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.6;
  }
}

.game-over-overlay {
  background: rgba(0, 0, 0, 0.9);
  border-radius: 20px;
  backdrop-filter: blur(10px);
  border: 2px solid rgba(220, 20, 60, 0.3);
  position: relative;
  z-index: 1;
  max-width: 800px;
  width: 100%;
}

.game-over-content {
  padding: 3rem;
  text-align: center;
  color: #f4e4bc;
}

.game-over-animation {
  margin-bottom: 2rem;
}

.skull-icon {
  font-size: 6rem;
  margin-bottom: 1rem;
  animation: shake 2s ease-in-out infinite;
}

@keyframes shake {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-5deg);
  }
  75% {
    transform: rotate(5deg);
  }
}

.game-over-title {
  font-size: 4rem;
  font-weight: bold;
  color: #dc143c;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8);
  margin-bottom: 1rem;
  animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
  from {
    text-shadow:
      3px 3px 6px rgba(0, 0, 0, 0.8),
      0 0 20px rgba(220, 20, 60, 0.5);
  }
  to {
    text-shadow:
      3px 3px 6px rgba(0, 0, 0, 0.8),
      0 0 30px rgba(220, 20, 60, 0.8);
  }
}

.game-over-reason {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(139, 0, 0, 0.2);
  border-radius: 10px;
  border: 1px solid rgba(220, 20, 60, 0.3);
}

.game-over-reason h2 {
  font-size: 1.5rem;
  color: #ff6b6b;
  margin-bottom: 1rem;
}

.reason-description {
  font-size: 1rem;
  opacity: 0.9;
  line-height: 1.6;
}

.game-stats {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(218, 165, 32, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.game-stats h3 {
  color: #daa520;
  margin-bottom: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 5px;
}

.stat-label {
  font-size: 0.9rem;
  opacity: 0.8;
}

.stat-value {
  font-weight: bold;
  color: #daa520;
}

.game-over-actions {
  margin-bottom: 2rem;
}

.game-over-actions h3 {
  color: #daa520;
  margin-bottom: 1.5rem;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: rgba(139, 69, 19, 0.4);
  border: 2px solid transparent;
  border-radius: 10px;
  color: #f4e4bc;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.restart-same-race {
  border-color: #22c55e;
}

.restart-same-race:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: #16a34a;
}

.change-race {
  border-color: #3b82f6;
}

.change-race:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: #2563eb;
}

.go-home {
  border-color: #6b7280;
}

.go-home:hover {
  background: rgba(107, 114, 128, 0.2);
  border-color: #4b5563;
}

.btn-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.btn-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.btn-title {
  font-size: 1.1rem;
  font-weight: bold;
}

.btn-subtitle {
  font-size: 0.9rem;
  opacity: 0.8;
}

.tips-section {
  padding: 1.5rem;
  background: rgba(139, 69, 19, 0.2);
  border-radius: 10px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  text-align: left;
}

.tips-section h4 {
  color: #daa520;
  margin-bottom: 1rem;
  text-align: center;
}

.tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tips-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(218, 165, 32, 0.1);
  font-size: 0.9rem;
  line-height: 1.4;
}

.tips-list li:last-child {
  border-bottom: none;
}

/* Responsive */
@media (max-width: 768px) {
  .game-over-content {
    padding: 2rem 1.5rem;
  }

  .game-over-title {
    font-size: 2.5rem;
  }

  .skull-icon {
    font-size: 4rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .action-btn {
    padding: 1rem;
  }

  .btn-icon {
    font-size: 1.5rem;
  }
}
</style>

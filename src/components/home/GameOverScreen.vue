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
            <IconRow label="Race choisie"
              >{{ gameState.race.name }} {{ gameState.race.icon }}</IconRow
            >
            <IconRow label="Or restant"
              ><CurrencyBadge :amount="gameState.inventory.gold" icon="💰"
            /></IconRow>
            <IconRow label="Artefacts collectés"
              >🎁 {{ gameState.inventory.artifacts.length }}</IconRow
            >
            <IconRow label="Temps de jeu">⏱️ {{ formatPlayTime() }}</IconRow>
          </div>
        </div>

        <!-- Options disponibles -->
        <div class="game-over-actions">
          <h3>🎮 Que voulez-vous faire maintenant ?</h3>

          <div class="action-buttons">
            <!-- Recommencer avec la même race -->
            <IconActionButton
              v-if="gameState.race"
              icon="🔄"
              title="Recommencer"
              :subtitle="`Avec ${gameState.race.name}`"
              @click="restartWithSameRace"
            />

            <!-- Changer de race -->
            <IconActionButton
              icon="🎭"
              title="Changer de Race"
              subtitle="Nouveau début, nouvelle stratégie"
              @click="changeRace"
            />

            <!-- Retour à l'accueil -->
            <IconActionButton
              icon="🏠"
              title="Menu Principal"
              subtitle="Retour à l'accueil"
              @click="goHome"
            />
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

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'
import CurrencyBadge from '@/components/ui/CurrencyBadge.vue'
import IconActionButton from '@/components/ui/IconActionButton.vue'
import IconRow from '@/components/ui/IconRow.vue'

const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()

const gameState = computed(() => gameStore.gameState)
const gameOverReason = computed(() => gameStore.gameState.gameOverReason)

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
</script>

<style scoped>
.game-over-screen {
  min-height: 100vh;
  background: linear-gradient(135deg, #fdf4f4 0%, #faf8f5 100%);
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
    radial-gradient(circle at 20% 30%, rgba(220, 20, 60, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(139, 0, 0, 0.05) 0%, transparent 50%);
  animation: pulseBackground 4s ease-in-out infinite;
}

@keyframes pulseBackground {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

.game-over-overlay {
  background: var(--color-bg-surface);
  border-radius: 20px;
  border: 1px solid rgba(var(--color-danger-rgb), 0.2);
  box-shadow: 0 16px 50px rgba(var(--color-black-rgb), 0.12);
  position: relative;
  z-index: 1;
  max-width: 800px;
  width: 100%;
}

.game-over-content {
  padding: 3rem;
  text-align: center;
  color: var(--color-text);
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
  color: var(--color-danger);
  text-shadow: 0 2px 8px rgba(var(--color-danger-rgb), 0.25);
  margin-bottom: 1rem;
  animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
  from {
    text-shadow: 0 2px 8px rgba(var(--color-danger-rgb), 0.25);
  }
  to {
    text-shadow: 0 2px 16px rgba(var(--color-danger-rgb), 0.45);
  }
}

.game-over-reason {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(var(--color-danger-rgb), 0.06);
  border-radius: 10px;
  border: 1px solid rgba(var(--color-danger-rgb), 0.25);
}

.game-over-reason h2 {
  font-size: 1.5rem;
  color: var(--color-danger);
  margin-bottom: 1rem;
}

.reason-description {
  font-size: 1rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.game-stats {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(var(--color-accent-rgb), 0.06);
  border-radius: 10px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.25);
}

.game-stats h3 {
  color: var(--color-accent-ink);
  margin-bottom: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stats-grid :deep(.icon-row) {
  padding: 0.5rem 0.75rem;
  background: rgba(var(--overlay-rgb), 0.04);
  border-radius: 5px;
}

.game-over-actions {
  margin-bottom: 2rem;
}

.game-over-actions h3 {
  color: var(--color-accent-ink);
  margin-bottom: 1.5rem;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.tips-section {
  padding: 1.5rem;
  background: rgba(var(--overlay-rgb), 0.03);
  border-radius: 10px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.2);
  text-align: left;
}

.tips-section h4 {
  color: var(--color-accent-ink);
  margin-bottom: 1rem;
  text-align: center;
}

.tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
  color: var(--color-text-muted);
}

.tips-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.1);
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
}
</style>

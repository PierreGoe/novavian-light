<template>
  <div class="home-screen main-content">
    <div class="background-overlay"></div>

    <header class="game-header">
      <h1 class="game-title">Novavian</h1>
      <p class="game-subtitle">Votre aventure commence ici</p>
    </header>

    <main class="content-section">
      <div class="game-options">
        <SelectableCard selected v-clickable @click="startNewGame">
          <template #badge>
            <Badge tone="accent">Commencer</Badge>
          </template>
          <template #icon>⚔️</template>
          <h3>Nouvelle Partie</h3>
          <p>Commencez votre conquête</p>
        </SelectableCard>

        <SelectableCard
          :disabled="!gameStore.hasSavedGame.value"
          v-clickable="gameStore.hasSavedGame.value"
          @click="loadGame"
        >
          <template #icon>📜</template>
          <h3>Continuer</h3>
          <p>{{ gameStore.hasSavedGame.value ? 'Reprenez votre partie' : 'Aucune sauvegarde' }}</p>
        </SelectableCard>

        <SelectableCard v-clickable @click="showSettings">
          <template #icon>⚙️</template>
          <h3>Paramètres</h3>
          <p>Configuration du jeu</p>
        </SelectableCard>
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
import SelectableCard from '@/components/ui/SelectableCard.vue'
import Badge from '@/components/ui/Badge.vue'

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
    !window.confirm(
      'Une partie sauvegardée existe déjà. La commencer écrasera définitivement cette sauvegarde. Continuer ?',
    )
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
  background: var(--gradient-canvas);
  color: var(--color-text);
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
    radial-gradient(circle at 20% 30%, rgba(var(--color-accent-rgb), 0.06) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(var(--color-accent-rgb), 0.04) 0%, transparent 50%);
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
  text-shadow: 1px 1px 3px rgba(var(--color-black-rgb), 0.12);
  animation: titleGlow 3s ease-in-out infinite alternate;
}

@keyframes titleGlow {
  0% {
    filter: drop-shadow(0 0 8px rgba(218, 165, 32, 0.25));
  }
  100% {
    filter: drop-shadow(0 0 16px rgba(218, 165, 32, 0.45));
  }
}

.game-subtitle {
  font-size: 1.2rem;
  margin: 1rem 0 0;
  color: var(--color-text-muted);
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

.game-options h3 {
  margin: 0.5rem 0;
  font-size: 1.5rem;
  color: var(--color-accent-ink);
}

.game-options p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

.game-info {
  text-align: center;
  color: var(--color-text-faint);
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
}
</style>

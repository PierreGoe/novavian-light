<template>
  <div class="home-screen">
    <HomeHeroBackdrop />

    <div class="home-content">
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

    <ConfirmDialog
      v-model:open="showOverwriteConfirm"
      title="Écraser la sauvegarde ?"
      message="Une partie sauvegardée existe déjà. La commencer écrasera définitivement cette sauvegarde."
      confirm-label="Écraser et commencer"
      danger
      @confirm="confirmStartNewGame"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useMissionStore } from '@/stores/missionStore'
import { useMapStore } from '@/stores/mapStore'
import { useToastStore } from '@/stores/toastStore'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import Badge from '@/components/ui/Badge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import HomeHeroBackdrop from '@/components/home/HomeHeroBackdrop.vue'

const router = useRouter()
const gameStore = useGameStore()
const missionStore = useMissionStore()
const mapStore = useMapStore()
const toastStore = useToastStore()

onMounted(() => {
  // Vérifier s'il existe une sauvegarde au montage
  // (Le computed hasSavedGame du store gère cela automatiquement)
})

const showOverwriteConfirm = ref(false)

const startNewGame = () => {
  if (gameStore.hasSavedGame.value) {
    showOverwriteConfirm.value = true
    return
  }
  confirmStartNewGame()
}

const confirmStartNewGame = () => {
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

.game-header {
  text-align: center;
  margin-bottom: 3rem;
  z-index: 1;
}

.game-title {
  font-size: 4rem;
  font-weight: bold;
  margin: 0;
  color: var(--color-accent-ink);
  text-shadow: 0 2px 8px rgba(var(--color-accent-rgb), 0.25);
  animation: titleGlow 3s ease-in-out infinite alternate;
}

@keyframes titleGlow {
  from {
    text-shadow: 0 2px 8px rgba(var(--color-accent-rgb), 0.25);
  }
  to {
    text-shadow: 0 2px 16px rgba(var(--color-accent-rgb), 0.45);
  }
}

.game-subtitle {
  font-size: 1.2rem;
  margin: 1rem 0 0;
  color: var(--color-text-muted);
  font-style: italic;
}

.home-content {
  z-index: 1;
  max-width: 900px;
  width: 100%;
  padding: 0 2rem;
}

.content-section {
  width: 100%;
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

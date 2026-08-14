<template>
  <div class="race-selector main-content">
    <div class="background-overlay"></div>

    <header class="selector-header">
      <button class="back-button" @click="goBack">← Retour</button>
      <h1>Choisissez votre Race</h1>
      <p>Chaque race possède ses propres avantages et style de jeu</p>
    </header>

    <main class="race-grid">
      <div
        v-for="race in races"
        :key="race.id"
        class="race-card"
        :class="{ selected: selectedRace?.id === race.id }"
        @click="selectRace(race)"
      >
        <div class="race-banner">
          <div class="race-icon">{{ race.icon }}</div>
          <h3>{{ race.name }}</h3>
        </div>

        <div class="race-description">
          <p>{{ race.description }}</p>
        </div>

        <div class="race-bonuses">
          <h4>Équipement de départ :</h4>
          <div class="starting-artifact">
            <span class="artifact-icon">{{ startingArtifact(race).icon }}</span>
            <div class="artifact-details">
              <span class="artifact-name">{{ startingArtifact(race).name }}</span>
              <span class="artifact-desc">{{ startingArtifact(race).description }}</span>
              <div class="artifact-effects">
                <span v-if="startingArtifact(race).effects.economy" class="fx-badge economy">
                  📈 +{{ startingArtifact(race).effects.economy }}% Éco
                </span>
                <span v-if="startingArtifact(race).effects.military" class="fx-badge military">
                  ⚔️ +{{ startingArtifact(race).effects.military }}% Mil
                </span>
                <span v-if="startingArtifact(race).effects.defense" class="fx-badge defense">
                  🛡️ +{{ startingArtifact(race).effects.defense }}% Déf
                </span>
                <span v-if="startingArtifact(race).effects.resourceBonus?.wood" class="fx-badge resource">
                  🪵 +{{ startingArtifact(race).effects.resourceBonus?.wood }}% Bois
                </span>
                <span v-if="startingArtifact(race).effects.resourceBonus?.stone" class="fx-badge resource">
                  🪨 +{{ startingArtifact(race).effects.resourceBonus?.stone }}% Pierre
                </span>
                <span v-if="startingArtifact(race).effects.resourceBonus?.iron" class="fx-badge resource">
                  ⚒️ +{{ startingArtifact(race).effects.resourceBonus?.iron }}% Fer
                </span>
                <span v-if="startingArtifact(race).effects.resourceBonus?.crop" class="fx-badge resource">
                  🌾 +{{ startingArtifact(race).effects.resourceBonus?.crop }}% Céréales
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="selector-footer">
      <button class="confirm-button" :disabled="!selectedRace" @click="confirmSelection">
        {{ selectedRace ? `Commencer avec les ${selectedRace.name}` : 'Sélectionnez une race' }}
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore, type Race } from '@/stores/gameStore'
import { STARTING_ARTIFACTS } from '@/data/artifacts'

const router = useRouter()
const gameStore = useGameStore()
const selectedRace = ref<Race | null>(null)

const races: Race[] = [
  {
    id: 'romans',
    name: 'Romains',
    icon: '🏛️',
    description:
      'Empire discipliné et organisé. Les Romains excellent dans la construction et la stratégie militaire. Leurs légions sont redoutables et leur économie bien structurée.',
  },
  {
    id: 'gauls',
    name: 'Gaulois',
    icon: '🛡️',
    description:
      'Peuple fier et défensif, maître de la résistance. Les Gaulois sont experts en défense et bénéficient de bonus pour protéger leurs terres.',
  },
  {
    id: 'germans',
    name: 'Germains',
    icon: '⚔️',
    description:
      "Guerriers sauvages et impitoyables. Les Germains privilégient l'attaque rapide et la pillage. Leurs raids sont dévastateurs.",
  },
]

/** Artefact de départ réel de la race — seule source de vérité pour ses bonus */
const startingArtifact = (race: Race) => STARTING_ARTIFACTS[race.id]

const selectRace = (race: Race) => {
  selectedRace.value = race
}

const goBack = () => {
  router.push('/')
}

const confirmSelection = () => {
  if (!selectedRace.value) return

  // Reset complètement l'état du jeu avant de commencer une nouvelle partie
  gameStore.resetGameCompletely()

  // Démarrer une nouvelle partie avec la race sélectionnée
  gameStore.startNewGame(selectedRace.value)

  console.log('Partie créée avec la race:', selectedRace.value.name)
  router.push('/mission-tree')
}
</script>

<style scoped>
.race-selector {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a0f08 0%, #2c1810 100%);
  color: #f4e4bc;
  padding: 2rem;
  position: relative;
  overflow-x: hidden;
}

.background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 30% 20%, rgba(218, 165, 32, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 70% 80%, rgba(139, 69, 19, 0.05) 0%, transparent 50%);
  pointer-events: none;
}

.selector-header {
  text-align: center;
  margin-bottom: 3rem;
  position: relative;
  z-index: 1;
}

.back-button {
  position: absolute;
  left: 0;
  top: 0;
  background: rgba(139, 69, 19, 0.3);
  border: 1px solid #8b4513;
  color: #f4e4bc;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.back-button:hover {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
}

.selector-header h1 {
  font-size: 2.5rem;
  margin: 0;
  color: #daa520;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.selector-header p {
  margin: 1rem 0 0;
  opacity: 0.8;
  font-size: 1.1rem;
}

.race-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto 3rem;
  z-index: 1;
  position: relative;
}

.race-card {
  background: rgba(139, 69, 19, 0.2);
  border: 2px solid #8b4513;
  border-radius: 15px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.race-card:hover {
  transform: translateY(-5px);
  border-color: #daa520;
  box-shadow: 0 10px 30px rgba(218, 165, 32, 0.2);
}

.race-card.selected {
  border-color: #daa520;
  background: rgba(218, 165, 32, 0.15);
  box-shadow: 0 0 20px rgba(218, 165, 32, 0.4);
}

.race-banner {
  text-align: center;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
  padding-bottom: 1rem;
}

.race-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.race-banner h3 {
  margin: 0;
  font-size: 1.5rem;
  color: #daa520;
}

.race-description {
  margin-bottom: 1.5rem;
}

.race-description p {
  margin: 0;
  line-height: 1.5;
  opacity: 0.9;
}

.race-bonuses {
  margin-bottom: 1.5rem;
}

.race-bonuses h4 {
  margin: 0 0 0.5rem;
  color: #daa520;
  font-size: 1rem;
}

.starting-artifact {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-top: 1px solid rgba(218, 165, 32, 0.3);
  padding-top: 1rem;
}

.starting-artifact .artifact-icon {
  font-size: 1.8rem;
  flex-shrink: 0;
}

.artifact-details {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.artifact-name {
  font-weight: 700;
  color: #daa520;
  font-size: 0.95rem;
}

.artifact-desc {
  font-size: 0.82rem;
  opacity: 0.8;
  line-height: 1.4;
}

.artifact-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.2rem;
}

.fx-badge {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
}

.fx-badge.economy {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
}
.fx-badge.military {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}
.fx-badge.defense {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}
.fx-badge.resource {
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
}

.selector-footer {
  text-align: center;
  z-index: 1;
  position: relative;
}

.confirm-button {
  background: linear-gradient(45deg, #8b4513, #daa520);
  border: none;
  color: #f4e4bc;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 250px;
}

.confirm-button:hover:not(:disabled) {
  background: linear-gradient(45deg, #daa520, #ffd700);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(218, 165, 32, 0.4);
}

.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(139, 69, 19, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .race-selector {
    padding: 1rem;
  }

  .selector-header h1 {
    font-size: 2rem;
  }

  .race-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .back-button {
    position: relative;
    margin-bottom: 1rem;
  }
}
</style>

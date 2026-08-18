<template>
  <div class="race-selector main-content">
    <div class="background-overlay"></div>

    <header class="selector-header">
      <Button variant="secondary" size="sm" class="back-button" @click="goBack">← Retour</Button>
      <h1>Choisissez votre Race</h1>
      <p>Chaque race possède ses propres avantages et style de jeu</p>
    </header>

    <main class="race-grid">
      <SelectableCard
        v-for="race in races"
        :key="race.id"
        :selected="selectedRace?.id === race.id"
        v-clickable
        @click="selectRace(race)"
      >
        <template #icon>
          <span class="race-icon">{{ race.icon }}</span>
        </template>

        <div class="race-banner">
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
                <FxBadge
                  v-if="startingArtifact(race).effects.economy"
                  kind="economy"
                  title="Bonus économique : production de ressources"
                >
                  +{{ startingArtifact(race).effects.economy }}% Éco
                </FxBadge>
                <FxBadge
                  v-if="startingArtifact(race).effects.military"
                  kind="military"
                  title="Bonus militaire : force d'attaque des troupes"
                >
                  +{{ startingArtifact(race).effects.military }}% Mil
                </FxBadge>
                <FxBadge
                  v-if="startingArtifact(race).effects.defense"
                  kind="defense"
                  title="Bonus défensif : résistance des troupes"
                >
                  +{{ startingArtifact(race).effects.defense }}% Déf
                </FxBadge>
                <!-- Pas de FxBadge ici : kind="resource" n'a qu'une icône fixe (🌾),
                     ce qui ferait perdre la distinction bois/pierre/fer/céréales. -->
                <span
                  v-if="startingArtifact(race).effects.resourceBonus?.wood"
                  class="fx-badge resource"
                >
                  🪵 +{{ startingArtifact(race).effects.resourceBonus?.wood }}% Bois
                </span>
                <span
                  v-if="startingArtifact(race).effects.resourceBonus?.stone"
                  class="fx-badge resource"
                >
                  🪨 +{{ startingArtifact(race).effects.resourceBonus?.stone }}% Pierre
                </span>
                <span
                  v-if="startingArtifact(race).effects.resourceBonus?.iron"
                  class="fx-badge resource"
                >
                  ⚒️ +{{ startingArtifact(race).effects.resourceBonus?.iron }}% Fer
                </span>
                <span
                  v-if="startingArtifact(race).effects.resourceBonus?.crop"
                  class="fx-badge resource"
                >
                  🌾 +{{ startingArtifact(race).effects.resourceBonus?.crop }}% Céréales
                </span>
              </div>
            </div>
          </div>
        </div>
      </SelectableCard>
    </main>

    <footer class="selector-footer">
      <Button size="md" :disabled="!selectedRace" @click="confirmSelection">
        {{ selectedRace ? `Commencer avec les ${selectedRace.name}` : 'Sélectionnez une race' }}
      </Button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore, type Race } from '@/stores/gameStore'
import { STARTING_ARTIFACTS } from '@/data/artifacts'
import { useToastStore } from '@/stores/toastStore'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import FxBadge from '@/components/ui/FxBadge.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()
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

  toastStore.showSuccess(`Partie créée avec les ${selectedRace.value.name} !`, { duration: 2500 })
  router.push('/mission-tree')
}
</script>

<style scoped>
.race-selector {
  min-height: 100vh;
  background: var(--gradient-canvas);
  color: var(--color-text);
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
    radial-gradient(circle at 30% 20%, rgba(var(--color-accent-rgb), 0.05) 0%, transparent 50%),
    radial-gradient(circle at 70% 80%, rgba(var(--color-accent-rgb), 0.03) 0%, transparent 50%);
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
}

.selector-header h1 {
  font-size: 2.5rem;
  margin: 0;
  color: var(--color-accent-ink);
}

.selector-header p {
  margin: 1rem 0 0;
  color: var(--color-text-muted);
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

.race-banner {
  text-align: center;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(var(--color-accent-rgb), 0.3);
  padding-bottom: 1rem;
}

.race-icon {
  font-size: 3rem;
}

.race-banner h3 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--color-accent-ink);
}

.race-description {
  margin-bottom: 1.5rem;
}

.race-description p {
  margin: 0;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.race-bonuses {
  margin-bottom: 1.5rem;
}

.race-bonuses h4 {
  margin: 0 0 0.5rem;
  color: var(--color-accent-ink);
  font-size: 1rem;
}

.starting-artifact {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-top: 1px solid rgba(var(--color-accent-rgb), 0.3);
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
  color: var(--color-accent-ink);
  font-size: 0.95rem;
}

.artifact-desc {
  font-size: 0.82rem;
  color: var(--color-text-muted);
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

.fx-badge.resource {
  background: rgba(var(--fx-resource-rgb), 0.2);
  color: var(--fx-resource);
}

.selector-footer {
  text-align: center;
  z-index: 1;
  position: relative;
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

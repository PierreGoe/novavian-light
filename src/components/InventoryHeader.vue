<template>
  <header class="inventory-header">
    <div class="header-content">
      <!-- Logo/Titre du jeu pour contexte non-jeu -->
      <div class="game-logo" v-if="!gameStore.gameState.isGameStarted">
        <h1>MiniTravian</h1>
      </div>

      <!-- Inventaire du joueur -->
      <div class="inventory-display">
        <!-- Or du joueur -->
        <div class="inventory-item gold">
          <span class="inventory-icon">💰</span>
          <span class="inventory-amount">{{
            formatNumber(gameStore.gameState.inventory.gold)
          }}</span>
          <span class="inventory-label">Or</span>
        </div>

        <!-- Leadership du joueur -->
        <div
          class="inventory-item leadership"
          :class="`leadership-${gameStore.leadershipStatus.value.level}`"
          :title="getLeadershipTooltip()"
        >
          <span class="inventory-icon">👑</span>
          <span class="inventory-amount">{{ gameStore.gameState.inventory.leadership }}</span>
          <span class="inventory-label">Leadership</span>
        </div>

        <div class="separator" v-if="gameStore.getEquippedArtifacts.value.length > 0"></div>

        <!-- Artefacts équipés -->
        <div
          v-for="artifact in gameStore.getEquippedArtifacts.value"
          :key="artifact.id"
          class="inventory-item artifact"
          :class="[`artifact-${artifact.rarity}`, `artifact-${artifact.type}`]"
          :title="getArtifactTooltip(artifact)"
        >
          <span class="inventory-icon">{{ artifact.icon }}</span>
          <span class="inventory-name">{{ artifact.name }}</span>
          <div class="artifact-effects" v-if="hasVisibleEffects(artifact)">
            <span v-if="artifact.effects.economy" class="effect-badge economy">
              +{{ artifact.effects.economy }} Éco
            </span>
            <span v-if="artifact.effects.military" class="effect-badge military">
              +{{ artifact.effects.military }} Mil
            </span>
            <span v-if="artifact.effects.defense" class="effect-badge defense">
              +{{ artifact.effects.defense }} Déf
            </span>
          </div>
        </div>

        <!-- Résumé des effets totaux si artefacts équipés -->
        <div class="total-effects" v-if="gameStore.getEquippedArtifacts.value.length > 0">
          <div class="effects-summary">
            <span class="effects-title">Bonus totaux:</span>
            <div class="effects-grid">
              <span v-if="totalEffects.economy > 0" class="total-effect economy">
                📈 +{{ totalEffects.economy }}%
              </span>
              <span v-if="totalEffects.military > 0" class="total-effect military">
                ⚔️ +{{ totalEffects.military }}%
              </span>
              <span v-if="totalEffects.defense > 0" class="total-effect defense">
                🛡️ +{{ totalEffects.defense }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions inventaire -->
      <div class="inventory-actions">
        <button
          class="inventory-button"
          @click="openInventoryModal"
          title="Ouvrir l'inventaire complet"
        >
          🎒 Inventaire
        </button>

        <!-- Race actuelle si en jeu -->
        <div
          class="race-badge"
          v-if="gameStore.gameState.isGameStarted && gameStore.gameState.race"
        >
          <span class="race-icon">{{ gameStore.gameState.race.icon }}</span>
          <span class="race-name">{{ gameStore.gameState.race.name }}</span>
        </div>
      </div>
    </div>

    <!-- Chiffres flottants pour les animations -->
    <div class="floating-numbers-container">
      <div
        v-for="floating in floatingNumbers"
        :key="floating.id"
        :data-floating-id="floating.id"
        class="floating-number"
        :class="[
          floating.isPositive ? 'positive' : 'negative',
          `floating-${floating.type}`
        ]"
        :style="{
          left: floating.x + 'px',
          top: floating.y + 'px'
        }"
      >
        {{ floating.isPositive ? '+' : '-' }}{{ floating.amount }}
        <span class="floating-icon">
          {{ floating.type === 'gold' ? '💰' : '👑' }}
        </span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useGameStore, type Artifact } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'

const gameStore = useGameStore()
const toastStore = useToastStore()

// Animation des chiffres flottants
interface FloatingNumber {
  id: string
  amount: number
  type: 'gold' | 'leadership'
  isPositive: boolean
  x: number
  y: number
}

const floatingNumbers = ref<FloatingNumber[]>([])
let animationId = 0

// Surveillez les changements d'or et de leadership  
const previousGold = ref(gameStore.gameState.inventory.gold)
const previousLeadership = ref(gameStore.gameState.inventory.leadership)

// Computed
const totalEffects = computed(() => gameStore.getTotalArtifactEffects.value)

// Méthodes
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

const getArtifactTooltip = (artifact: Artifact): string => {
  let tooltip = `${artifact.name} (${artifact.rarity})\n${artifact.description}`

  if (hasVisibleEffects(artifact)) {
    tooltip += '\n\nEffets:'
    if (artifact.effects.economy) tooltip += `\n• Économie: +${artifact.effects.economy}%`
    if (artifact.effects.military) tooltip += `\n• Militaire: +${artifact.effects.military}%`
    if (artifact.effects.defense) tooltip += `\n• Défense: +${artifact.effects.defense}%`

    if (artifact.effects.resourceBonus) {
      const resourceBonus = artifact.effects.resourceBonus
      if (resourceBonus.wood) tooltip += `\n• Bois: +${resourceBonus.wood}%`
      if (resourceBonus.stone) tooltip += `\n• Pierre: +${resourceBonus.stone}%`
      if (resourceBonus.iron) tooltip += `\n• Fer: +${resourceBonus.iron}%`
      if (resourceBonus.food) tooltip += `\n• Nourriture: +${resourceBonus.food}%`
    }
  }

  if (artifact.obtainedFrom) {
    tooltip += `\n\nObtenu: ${artifact.obtainedFrom}`
  }

  return tooltip
}

const hasVisibleEffects = (artifact: Artifact): boolean => {
  return !!(artifact.effects.economy || artifact.effects.military || artifact.effects.defense)
}

const getLeadershipTooltip = (): string => {
  const leadership = gameStore.gameState.inventory.leadership
  const status = gameStore.leadershipStatus.value

  let tooltip = `Leadership: ${leadership}/200\n`
  tooltip += `État: ${status.description}\n\n`

  tooltip +=
    "Le leadership représente votre autorité et l'influence que vous exercez sur votre peuple.\n\n"

  if (leadership >= 150) {
    tooltip += '• Votre peuple vous vénère\n• Bonus aux récompenses\n• Moral au maximum'
  } else if (leadership >= 100) {
    tooltip += '• Votre peuple vous respecte\n• Fonctionnement normal\n• Bon moral des troupes'
  } else if (leadership >= 50) {
    tooltip += '• Votre autorité est remise en question\n• Moral moyen\n• Risque de pénalités'
  } else if (leadership >= 25) {
    tooltip += '• Votre peuple doute de vous\n• Moral faible\n• Pénalités possibles'
  } else {
    tooltip +=
      "⚠️ CRITIQUE: Votre peuple se révolte!\n• Si le leadership atteint 0, c'est la fin de votre règne\n• Agissez rapidement pour remonter votre réputation!"
  }

  return tooltip
}

// Fonctions d'animation des chiffres flottants
const createFloatingNumber = (amount: number, type: 'gold' | 'leadership', element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  const isPositive = amount > 0
  
  const floating: FloatingNumber = {
    id: `floating-${++animationId}`,
    amount: Math.abs(amount),
    type,
    isPositive,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  }
  
  floatingNumbers.value.push(floating)
  
  // Ajouter une classe CSS pour les gros changements
  nextTick(() => {
    const floatingElement = document.querySelector(`[data-floating-id="${floating.id}"]`)
    if (floatingElement) {
      // Considérer comme "gros changement" : or >= 50, leadership >= 20
      const isBigChange = (type === 'gold' && Math.abs(amount) >= 50) || 
                          (type === 'leadership' && Math.abs(amount) >= 20)
      
      if (isBigChange) {
        floatingElement.classList.add('big-change')
      }
    }
  })
  
  // Supprimer l'animation après 2.5 secondes
  const timeout = Math.abs(amount) >= 50 ? 2500 : 2000
  setTimeout(() => {
    const index = floatingNumbers.value.findIndex(f => f.id === floating.id)
    if (index > -1) {
      floatingNumbers.value.splice(index, 1)
    }
  }, timeout)
}

// Watchers pour détecter les changements
watch(
  () => gameStore.gameState.inventory.gold,
  (newGold) => {
    const difference = newGold - previousGold.value
    if (difference !== 0) {
      nextTick(() => {
        const goldElement = document.querySelector('.inventory-item.gold')
        if (goldElement) {
          createFloatingNumber(difference, 'gold', goldElement as HTMLElement)
        }
      })
      previousGold.value = newGold
    }
  }
)

watch(
  () => gameStore.gameState.inventory.leadership,
  (newLeadership) => {
    const difference = newLeadership - previousLeadership.value
    if (difference !== 0) {
      nextTick(() => {
        const leadershipElement = document.querySelector('.inventory-item.leadership')
        if (leadershipElement) {
          createFloatingNumber(difference, 'leadership', leadershipElement as HTMLElement)
        }
      })
      previousLeadership.value = newLeadership
    }
  }
)

const openInventoryModal = () => {
  // TODO: Implémenter la modal d'inventaire complète
  toastStore.showInfo('Inventaire complet - À implémenter prochainement!', { duration: 3000 })
}

// Fonction de test pour les animations (à supprimer plus tard)
const testAnimations = () => {
  // Tester gain d'or
  gameStore.addGold(25)
  
  setTimeout(() => {
    // Tester perte de leadership
    gameStore.loseLeadership(10)
  }, 500)
  
  setTimeout(() => {
    // Tester gros gain
    gameStore.addGold(100)
  }, 1000)
}

// Temporaire : ajouter un écouteur pour tester avec Ctrl+T
if (typeof window !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault()
      testAnimations()
    }
  })
}
</script>

<style scoped>
.inventory-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: linear-gradient(135deg, #1a0f08 0%, #2c1810 100%);
  border-bottom: 2px solid #daa520;
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

.inventory-display {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 1;
  justify-content: center;
}

.inventory-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.8rem;
  background: rgba(218, 165, 32, 0.15);
  border: 1px solid rgba(218, 165, 32, 0.4);
  border-radius: 8px;
  min-width: 80px;
  transition: all 0.3s ease;
  position: relative;
}

.inventory-item:hover {
  background: rgba(218, 165, 32, 0.25);
  border-color: #daa520;
  transform: translateY(-1px);
}

.inventory-item.gold {
  border-color: rgba(255, 215, 0, 0.6);
  background: rgba(255, 215, 0, 0.1);
}

.inventory-item.gold:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: #ffd700;
}

/* Styles du leadership selon l'état */
.inventory-item.leadership {
  border-color: rgba(218, 165, 32, 0.6);
  background: rgba(218, 165, 32, 0.1);
}

.leadership-excellent {
  border-color: rgba(34, 197, 94, 0.8) !important;
  background: rgba(34, 197, 94, 0.15) !important;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
}

.leadership-good {
  border-color: rgba(59, 130, 246, 0.6) !important;
  background: rgba(59, 130, 246, 0.1) !important;
}

.leadership-average {
  border-color: rgba(245, 158, 11, 0.6) !important;
  background: rgba(245, 158, 11, 0.1) !important;
}

.leadership-low {
  border-color: rgba(239, 68, 68, 0.6) !important;
  background: rgba(239, 68, 68, 0.1) !important;
}

.leadership-critical {
  border-color: rgba(220, 38, 38, 0.8) !important;
  background: rgba(220, 38, 38, 0.15) !important;
  animation: leadershipAlert 2s infinite;
  box-shadow: 0 0 15px rgba(220, 38, 38, 0.4);
}

.inventory-item.leadership:hover {
  transform: translateY(-1px);
}

/* Animation d'alerte pour leadership critique */
@keyframes leadershipAlert {
  0%,
  100% {
    border-color: rgba(220, 38, 38, 0.8);
  }
  50% {
    border-color: rgba(255, 0, 0, 1);
  }
}

/* Styles des artefacts selon leur rareté */
.artifact-common {
  border-color: rgba(169, 169, 169, 0.6);
  background: rgba(169, 169, 169, 0.1);
}

.artifact-rare {
  border-color: rgba(30, 144, 255, 0.6);
  background: rgba(30, 144, 255, 0.1);
}

.artifact-epic {
  border-color: rgba(138, 43, 226, 0.6);
  background: rgba(138, 43, 226, 0.1);
}

.artifact-legendary {
  border-color: rgba(255, 165, 0, 0.8);
  background: rgba(255, 165, 0, 0.15);
  box-shadow: 0 0 10px rgba(255, 165, 0, 0.3);
}

.inventory-icon {
  font-size: 1.2rem;
  margin-bottom: 0.2rem;
}

.inventory-amount {
  font-size: 1rem;
  font-weight: bold;
  color: #daa520;
  line-height: 1;
}

.inventory-label {
  font-size: 0.7rem;
  opacity: 0.8;
  margin-top: 0.1rem;
  line-height: 1;
}

.inventory-name {
  font-size: 0.7rem;
  font-weight: bold;
  color: #daa520;
  margin-bottom: 0.2rem;
  text-align: center;
  line-height: 1;
}

.artifact-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  justify-content: center;
  margin-top: 0.2rem;
}

.effect-badge {
  font-size: 0.6rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  color: white;
  font-weight: bold;
  line-height: 1;
}

.effect-badge.economy {
  background: #22c55e;
}

.effect-badge.military {
  background: #ef4444;
}

.effect-badge.defense {
  background: #3b82f6;
}

.separator {
  width: 1px;
  height: 50px;
  background: rgba(218, 165, 32, 0.3);
  margin: 0 0.5rem;
}

.total-effects {
  background: rgba(218, 165, 32, 0.1);
  border: 1px solid rgba(218, 165, 32, 0.3);
  border-radius: 8px;
  padding: 0.5rem;
  min-width: 120px;
}

.effects-summary {
  text-align: center;
}

.effects-title {
  font-size: 0.7rem;
  color: #daa520;
  font-weight: bold;
  display: block;
  margin-bottom: 0.3rem;
}

.effects-grid {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.total-effect {
  font-size: 0.6rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  background: rgba(218, 165, 32, 0.2);
  color: #f4e4bc;
  line-height: 1.2;
}

.inventory-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.inventory-button {
  background: rgba(139, 69, 19, 0.4);
  border: 1px solid #8b4513;
  color: #f4e4bc;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.inventory-button:hover {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
  transform: scale(1.05);
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

/* Responsive */
@media (max-width: 1024px) {
  .header-content {
    gap: 1rem;
    padding: 0.6rem 1rem;
  }

  .inventory-display {
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .inventory-item {
    min-width: 70px;
    padding: 0.3rem 0.6rem;
  }

  .total-effects {
    min-width: 100px;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 0.8rem;
    padding: 0.8rem 1rem;
  }

  .inventory-display {
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.8rem;
    width: 100%;
  }

  .separator {
    display: none;
  }

  .inventory-actions {
    gap: 0.8rem;
    flex-wrap: wrap;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .inventory-display {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    display: grid;
    width: 100%;
    max-width: 400px;
  }

  .race-name {
    display: none;
  }

  .effects-grid {
    flex-direction: row;
    flex-wrap: wrap;
  }
}

/* Animations des chiffres flottants */
.floating-numbers-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
}

.floating-number {
  position: absolute;
  font-weight: bold;
  font-size: 1.2rem;
  animation: floatUp 2s ease-out forwards;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.6));
  transform: translateX(-50%) translateY(-50%);
}

.floating-number.positive {
  color: #22c55e;
}

.floating-number.negative {
  color: #ef4444;
}

.floating-number.floating-gold.positive {
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(255, 215, 0, 0.3);
}

.floating-number.floating-leadership.positive {
  color: #3b82f6;
  text-shadow: 2px 2px 4px rgba(59, 130, 246, 0.3);
}

.floating-number.floating-leadership.negative {
  color: #ef4444;
  text-shadow: 2px 2px 4px rgba(239, 68, 68, 0.3);
}

.floating-icon {
  font-size: 1rem;
  opacity: 0.9;
}

@keyframes floatUp {
  0% {
    transform: translateX(-50%) translateY(-50%) scale(0.8);
    opacity: 0;
  }
  10% {
    transform: translateX(-50%) translateY(-50%) scale(1.2);
    opacity: 1;
  }
  20% {
    transform: translateX(-50%) translateY(-50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateX(-50%) translateY(-150%) scale(0.6);
    opacity: 0;
  }
}

/* Animation plus spectaculaire pour les gros gains/pertes */
.floating-number.big-change {
  font-size: 1.4rem;
  animation: floatUpBig 2.5s ease-out forwards;
}

@keyframes floatUpBig {
  0% {
    transform: translateX(-50%) translateY(-50%) scale(0.5) rotate(-15deg);
    opacity: 0;
  }
  15% {
    transform: translateX(-50%) translateY(-50%) scale(1.4) rotate(5deg);
    opacity: 1;
  }
  30% {
    transform: translateX(-50%) translateY(-50%) scale(1.1) rotate(-2deg);
    opacity: 1;
  }
  100% {
    transform: translateX(-50%) translateY(-200%) scale(0.4) rotate(0deg);
    opacity: 0;
  }
}
</style>

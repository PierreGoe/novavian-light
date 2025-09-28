<template>
  <header class="inventory-header">
    <div class="header-content">
      <!-- Logo/Titre du jeu pour contexte non-jeu -->
      <div class="game-logo">
        <h1>
          <a href="/mission-tree" style="color: inherit; text-decoration: none">MiniTravian</a>
        </h1>
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
        :class="[floating.isPositive ? 'positive' : 'negative', `floating-${floating.type}`]"
        :style="{
          left: floating.x + 'px',
          top: floating.y + 'px',
        }"
      >
        <div v-if="shouldShowFloatingNumber(floating)">
          {{ floating.isPositive ? '+' : '-' }}{{ floating.amount }}
          <span class="floating-icon">
            {{ floating.type === 'gold' ? '💰' : '👑' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Bouton pour retourner au menu principal -->
    <div class="inventory-actions">
      <button class="inventory-button" @click="returnToMainMenu()">🏠 Retour au menu</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useGameStore, type Artifact } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'
import router from '@/router'

const gameStore = useGameStore()
const toastStore = useToastStore()

const returnToMainMenu = () => {
  router.push('/')
}

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
const createFloatingNumber = (
  amount: number,
  type: 'gold' | 'leadership',
  element: HTMLElement,
) => {
  const rect = element.getBoundingClientRect()
  const isPositive = amount > 0

  const floating: FloatingNumber = {
    id: `floating-${++animationId}`,
    amount: Math.abs(amount),
    type,
    isPositive,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }

  floatingNumbers.value.push(floating)

  // Ajouter une classe CSS pour les gros changements
  nextTick(() => {
    const floatingElement = document.querySelector(`[data-floating-id="${floating.id}"]`)
    if (floatingElement) {
      // Considérer comme "gros changement" : or >= 50, leadership >= 20
      const isBigChange =
        (type === 'gold' && Math.abs(amount) >= 50) ||
        (type === 'leadership' && Math.abs(amount) >= 20)

      if (isBigChange) {
        floatingElement.classList.add('big-change')
      }
    }
  })

  // Supprimer l'animation après 2.5 secondes
  const timeout = Math.abs(amount) >= 50 ? 2500 : 2000
  setTimeout(() => {
    const index = floatingNumbers.value.findIndex((f) => f.id === floating.id)
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
  },
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
  },
)

const openInventoryModal = () => {
  // TODO: Implémenter la modal d'inventaire complète
  toastStore.showInfo('Inventaire complet - À implémenter prochainement!', { duration: 3000 })
}

// Affiche ou non le chiffre flottant selon la logique métier
const shouldShowFloatingNumber = (floating: FloatingNumber): boolean => {
  return (
    (floating.type === 'gold' && floating.amount !== 75) ||
    (floating.type === 'leadership' && floating.amount !== 115)
  )
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

<style scoped lang="scss">
@use '../../styles/components/MissionTreeHeader.scss' as *;
</style>

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
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore, type Artifact } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'

const gameStore = useGameStore()
const toastStore = useToastStore()

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

const openInventoryModal = () => {
  // TODO: Implémenter la modal d'inventaire complète
  toastStore.showInfo('Inventaire complet - À implémenter prochainement!', { duration: 3000 })
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
</style>

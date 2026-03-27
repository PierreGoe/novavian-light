<template>
  <div class="bazar-page">
    <!-- En-tête -->
    <header class="bazar-header">
      <h1>🔮 Bazar Mystique</h1>
      <span class="gold-display">💰 {{ currentGold }} or</span>
    </header>

    <div class="bazar-body">
      <!-- ===== Section Offres ===== -->
      <section class="offer-section">
        <div class="section-header">
          <div class="section-title-block">
            <h2>Offres du jour</h2>
            <p class="section-subtitle">Achetez une relique parmi les 6 proposées.</p>
          </div>
          <div class="reroll-controls">
            <span class="reroll-info">
              🎲 Tirages restants :
              <strong :class="{ exhausted: rerollsLeft === 0 }"
                >{{ rerollsLeft }}/{{ BAZAR_MAX_REROLLS }}</strong
              >
            </span>
            <button
              class="reroll-btn"
              :disabled="rerollsLeft <= 0 || currentGold < BAZAR_REROLL_COST"
              @click="reroll"
              :title="rerollBtnTitle"
            >
              Renouveler — {{ BAZAR_REROLL_COST }} 💰
            </button>
          </div>
        </div>

        <div class="offer-grid">
          <div
            v-for="artifact in bazarOffer"
            :key="artifact.id"
            class="offer-card"
            :class="`rarity-${artifact.rarity}`"
          >
            <!-- En-tête de la carte -->
            <div class="card-top">
              <span class="card-icon">{{ artifact.icon }}</span>
              <span class="rarity-badge">{{ rarityLabel(artifact.rarity) }}</span>
            </div>

            <div class="card-name">{{ artifact.name }}</div>
            <p class="card-desc">{{ artifact.description }}</p>

            <!-- Effets statistiques -->
            <div class="card-effects" v-if="hasEffects(artifact)">
              <span v-if="artifact.effects.economy" class="fx economy"
                >+{{ artifact.effects.economy }}% Éco</span
              >
              <span v-if="artifact.effects.military" class="fx military"
                >+{{ artifact.effects.military }}% Mil</span
              >
              <span v-if="artifact.effects.defense" class="fx defense"
                >+{{ artifact.effects.defense }}% Déf</span
              >
              <span v-if="artifact.effects.resourceBonus?.wood" class="fx resource"
                >+{{ artifact.effects.resourceBonus.wood }}% Bois</span
              >
              <span v-if="artifact.effects.resourceBonus?.stone" class="fx resource"
                >+{{ artifact.effects.resourceBonus.stone }}% Pierre</span
              >
              <span v-if="artifact.effects.resourceBonus?.iron" class="fx resource"
                >+{{ artifact.effects.resourceBonus.iron }}% Fer</span
              >
              <span v-if="artifact.effects.resourceBonus?.food" class="fx resource"
                >+{{ artifact.effects.resourceBonus.food }}% Nourriture</span
              >
            </div>

            <!-- Pouvoir spécial -->
            <div v-if="artifact.specialPower" class="card-special">
              ✨ {{ artifact.specialPower.description }}
            </div>

            <!-- Durabilité -->
            <div class="card-durability">
              <template v-if="artifact.durability === 'single-use'">⚡ Usage unique</template>
              <template v-else-if="artifact.durability === 'uses-limited'"
                >🔢 {{ artifact.maxUses }} combats</template
              >
              <template v-else>♾️ Permanent</template>
              <span v-if="artifact.destructible" class="fragile-tag">⚠️ Fragile</span>
            </div>

            <button
              class="buy-btn"
              :disabled="currentGold < BAZAR_BUY_PRICES[artifact.rarity]"
              @click="buy(artifact)"
              :title="buyBtnTitle(artifact)"
            >
              Acheter — {{ BAZAR_BUY_PRICES[artifact.rarity] }} 💰
            </button>
          </div>
        </div>
      </section>

      <!-- ===== Section Revente ===== -->
      <section class="sell-section">
        <div class="section-title-block">
          <h2>Revendre vos reliques</h2>
          <p class="section-subtitle">
            Transformez vos reliques inutiles en or. Une relique active sera désactivée avant la
            vente.
          </p>
        </div>

        <div v-if="allArtifacts.length === 0" class="empty-state">
          Votre inventaire est vide — rien à vendre.
        </div>

        <div class="sell-grid" v-else>
          <div
            v-for="artifact in allArtifacts"
            :key="artifact.id"
            class="sell-card"
            :class="[`rarity-${artifact.rarity}`, { 'is-active': isActive(artifact.id) }]"
          >
            <div class="sell-info">
              <span class="sell-icon">{{ artifact.icon }}</span>
              <div class="sell-details">
                <span class="sell-name">{{ artifact.name }}</span>
                <span class="sell-rarity">{{ rarityLabel(artifact.rarity) }}</span>
                <span v-if="isActive(artifact.id)" class="active-tag">Actif</span>
              </div>
            </div>
            <button class="sell-btn" @click="sell(artifact)">
              +{{ SELL_PRICES[artifact.rarity] }} 💰
            </button>
          </div>
        </div>
      </section>

      <!-- ===== Quitter le Bazar ===== -->
      <div class="bazar-exit">
        <p class="exit-warning">⚠️ Une fois parti, vous ne pourrez plus revenir à ce Bazar.</p>
        <button class="exit-btn" @click="exitBazar">🚪 Quitter le Bazar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore, type Artifact } from '@/stores/gameStore'
import {
  SELL_PRICES,
  BAZAR_BUY_PRICES,
  BAZAR_MAX_REROLLS,
  BAZAR_REROLL_COST,
} from '@/data/artifacts'
import { useToastStore } from '@/stores/toastStore'

const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()

// ===== Navigation =====
// Quitter définitivement le Bazar — complète le node shop et retourne au mission-tree
const exitBazar = () => {
  const nodeId = gameStore.gameState.mapState.selectedNodeId
  if (nodeId) {
    gameStore.completeMapNode(nodeId)
  }
  router.push('/mission-tree')
}

// ===== Or courant =====
const currentGold = computed(() => gameStore.gameState.inventory.gold)

// ===== Offres du Bazar =====
const bazarOffer = ref<Artifact[]>([])
const rerollsLeft = ref(BAZAR_MAX_REROLLS)

// Génère les offres initiales à l'ouverture du Bazar
onMounted(() => {
  bazarOffer.value = gameStore.generateBazarOffer()
})

const rerollBtnTitle = computed(() => {
  if (rerollsLeft.value <= 0) return 'Vous avez épuisé tous vos tirages pour cette visite'
  if (currentGold.value < BAZAR_REROLL_COST)
    return `Il manque ${BAZAR_REROLL_COST - currentGold.value} or`
  return `Renouveler les 6 offres (${BAZAR_REROLL_COST} or)`
})

const reroll = () => {
  if (rerollsLeft.value <= 0) return
  if (!gameStore.spendGold(BAZAR_REROLL_COST)) {
    toastStore.showInfo(
      `Pas assez d'or pour renouveler les offres. (${BAZAR_REROLL_COST} or requis)`,
      { duration: 3000 },
    )
    return
  }
  rerollsLeft.value--
  bazarOffer.value = gameStore.generateBazarOffer()
  toastStore.showInfo(`🎲 Nouvelles offres ! Il vous reste ${rerollsLeft.value} tirage(s).`, {
    duration: 2500,
  })
}

// ===== Achat =====
const buyBtnTitle = (artifact: Artifact): string => {
  const price = BAZAR_BUY_PRICES[artifact.rarity]
  if (currentGold.value < price) return `Il manque ${price - currentGold.value} or`
  return `Acheter ${artifact.name}`
}

const buy = (artifact: Artifact) => {
  const price = BAZAR_BUY_PRICES[artifact.rarity]
  if (!gameStore.spendGold(price)) {
    toastStore.showInfo(`Pas assez d'or pour acheter ${artifact.name}.`, { duration: 3000 })
    return
  }

  // Ajouter à l'inventaire et auto-activer si slot libre
  gameStore.addArtifact(artifact)
  if (gameStore.gameState.inventory.activeArtifacts.length < 4) {
    gameStore.activateArtifact(artifact.id)
  }

  toastStore.showSuccess(`🔮 Acquis : ${artifact.name} !`, { duration: 4000 })

  // Remplacer la carte achetée par une nouvelle offre si des tirages restent
  bazarOffer.value = bazarOffer.value.filter((a) => a.id !== artifact.id)
}

// ===== Vente =====
const allArtifacts = computed(() => gameStore.gameState.inventory.artifacts)
const isActive = (id: string) => gameStore.gameState.inventory.activeArtifacts.includes(id)

const sell = (artifact: Artifact) => {
  const goldGained = gameStore.sellArtifact(artifact.id)
  toastStore.showSuccess(`💰 Vendu : ${artifact.name} pour ${goldGained} or.`, { duration: 3000 })
}

// ===== Helpers d'affichage =====
const hasEffects = (artifact: Artifact): boolean => {
  const e = artifact.effects
  return !!(
    e.economy ||
    e.military ||
    e.defense ||
    e.resourceBonus?.wood ||
    e.resourceBonus?.stone ||
    e.resourceBonus?.iron ||
    e.resourceBonus?.food
  )
}

const rarityLabel = (rarity: Artifact['rarity']): string => {
  const labels: Record<Artifact['rarity'], string> = {
    common: 'Commune',
    rare: 'Rare',
    epic: 'Épique',
    legendary: 'Légendaire',
  }
  return labels[rarity]
}
</script>

<style scoped lang="scss">
// ===== Couleurs par rareté =====
$rarity-common: #9ca3af;
$rarity-rare: #3b82f6;
$rarity-epic: #8b5cf6;
$rarity-legendary: #f59e0b;

.rarity-common {
  --rarity-color: #{$rarity-common};
}
.rarity-rare {
  --rarity-color: #{$rarity-rare};
}
.rarity-epic {
  --rarity-color: #{$rarity-epic};
}
.rarity-legendary {
  --rarity-color: #{$rarity-legendary};
}

// ===== Page =====
.bazar-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a0a2e 0%, #12102e 50%, #0a1a3a 100%);
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

// ===== Header =====
.bazar-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: rgba(80, 0, 120, 0.35);
  border-bottom: 1px solid rgba(160, 80, 255, 0.25);

  h1 {
    margin: 0;
    font-size: 1.5rem;
    text-align: center;
    text-shadow: 0 0 20px rgba(160, 80, 255, 0.6);
  }

  .gold-display {
    font-size: 1rem;
    font-weight: 700;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.12);
    padding: 0.3rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
}

.back-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
}

// ===== Corps =====
.bazar-body {
  flex: 1;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

// ===== En-tête de section =====
.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-title-block {
  h2 {
    margin: 0 0 0.25rem;
    font-size: 1.3rem;
    color: #c084fc;
  }
  .section-subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: #94a3b8;
  }
}

// ===== Contrôles de retirage =====
.reroll-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.reroll-info {
  font-size: 0.85rem;
  color: #94a3b8;

  strong {
    color: #e2e8f0;
    &.exhausted {
      color: #ef4444;
    }
  }
}

.reroll-btn {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: none;
  color: #fff;
  padding: 0.5rem 1.1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition:
    opacity 0.2s,
    transform 0.1s;

  &:hover:not(:disabled) {
    opacity: 0.88;
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

// ===== Grille des offres =====
.offer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.offer-card {
  background: rgba(255, 255, 255, 0.04);
  border: 2px solid var(--rarity-color, #9ca3af);
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition:
    transform 0.15s,
    box-shadow 0.2s;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-icon {
  font-size: 1.8rem;
  line-height: 1;
}

.rarity-badge {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rarity-color, #9ca3af);
  background: rgba(0, 0, 0, 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.card-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f1f5f9;
}

.card-desc {
  font-size: 0.78rem;
  color: #94a3b8;
  line-height: 1.4;
  margin: 0;
  flex: 1;
}

.card-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.fx {
  font-size: 0.72rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-weight: 600;

  &.economy {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }
  &.military {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  &.defense {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }
  &.resource {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }
}

.card-special {
  font-size: 0.78rem;
  color: #c084fc;
  background: rgba(192, 132, 252, 0.1);
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
}

.card-durability {
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.fragile-tag {
  font-size: 0.72rem;
  color: #f97316;
}

.buy-btn {
  margin-top: auto;
  background: linear-gradient(
    135deg,
    rgba(var(--rarity-rgb, 59, 130, 246), 0.25),
    rgba(0, 0, 0, 0.2)
  );
  border: 1px solid var(--rarity-color, #3b82f6);
  color: var(--rarity-color, #3b82f6);
  padding: 0.45rem 0.8rem;
  border-radius: 7px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

// ===== Section vente =====
.sell-section {
  .section-title-block h2 {
    color: #fbbf24;
  }
}

.empty-state {
  text-align: center;
  color: #64748b;
  padding: 2rem;
  font-size: 0.9rem;
}

.sell-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sell-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--rarity-color, #9ca3af);
  border-radius: 8px;
  transition: background 0.15s;

  &.is-active {
    background: rgba(255, 255, 255, 0.08);
  }

  &:hover {
    background: rgba(255, 255, 255, 0.07);
  }
}

.sell-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sell-icon {
  font-size: 1.4rem;
}

.sell-details {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.sell-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e2e8f0;
}

.sell-rarity {
  font-size: 0.75rem;
  color: var(--rarity-color, #9ca3af);
}

.active-tag {
  font-size: 0.7rem;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.15);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  border: 1px solid rgba(34, 197, 94, 0.3);
  width: fit-content;
}

.sell-btn {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #f59e0b;
  padding: 0.4rem 1rem;
  border-radius: 7px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.2s;

  &:hover {
    background: rgba(245, 158, 11, 0.3);
  }
}

// ===== Zone de sortie =====
.bazar-exit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 1rem;
}

.exit-warning {
  margin: 0;
  font-size: 0.85rem;
  color: #f97316;
  text-align: center;
}

.exit-btn {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.45);
  color: #ef4444;
  padding: 0.65rem 2rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition:
    background 0.2s,
    transform 0.1s;

  &:hover {
    background: rgba(239, 68, 68, 0.3);
    transform: translateY(-1px);
  }
}
</style>

<template>
  <div class="bazar-page">
    <!-- En-tête -->
    <header class="bazar-header">
      <Button
        variant="secondary"
        size="sm"
        @click="exitBazar"
        title="Quitter le Bazar — vous ne pourrez plus y revenir"
      >
        ← Retour
      </Button>
      <h1>🔮 Bazar Mystique</h1>
      <span class="gold-display">🪙 {{ currentGold }} or</span>
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
              Renouveler — {{ BAZAR_REROLL_COST }} 🪙
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
              <RarityBadge :rarity="artifact.rarity">{{
                rarityLabel(artifact.rarity)
              }}</RarityBadge>
            </div>

            <div class="card-name">{{ artifact.name }}</div>
            <p class="card-desc">{{ artifact.description }}</p>

            <!-- Effets statistiques -->
            <div class="card-effects" v-if="hasEffects(artifact)">
              <FxBadge v-if="artifact.effects.economy" kind="economy"
                >+{{ artifact.effects.economy }}% Éco</FxBadge
              >
              <FxBadge v-if="artifact.effects.military" kind="military"
                >+{{ artifact.effects.military }}% Mil</FxBadge
              >
              <FxBadge v-if="artifact.effects.defense" kind="defense"
                >+{{ artifact.effects.defense }}% Déf</FxBadge
              >
              <FxBadge v-if="artifact.effects.resourceBonus?.wood" kind="resource"
                >+{{ artifact.effects.resourceBonus.wood }}% Bois</FxBadge
              >
              <FxBadge v-if="artifact.effects.resourceBonus?.stone" kind="resource"
                >+{{ artifact.effects.resourceBonus.stone }}% Pierre</FxBadge
              >
              <FxBadge v-if="artifact.effects.resourceBonus?.iron" kind="resource"
                >+{{ artifact.effects.resourceBonus.iron }}% Fer</FxBadge
              >
              <FxBadge v-if="artifact.effects.resourceBonus?.crop" kind="resource">
                +{{ artifact.effects.resourceBonus.crop }}% Céréales</FxBadge
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
              Acheter — {{ BAZAR_BUY_PRICES[artifact.rarity] }} 🪙
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

        <EmptyState
          v-if="allArtifacts.length === 0"
          message="Votre inventaire est vide — rien à vendre."
        />

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
              +{{ SELL_PRICES[artifact.rarity] }} 🪙
            </button>
          </div>
        </div>
      </section>

      <!-- ===== Quitter le Bazar ===== -->
      <div class="bazar-exit">
        <p class="exit-warning">⚠️ Une fois parti, vous ne pourrez plus revenir à ce Bazar.</p>
        <Button variant="danger" @click="exitBazar">🚪 Quitter le Bazar</Button>
      </div>
    </div>

    <ConfirmDialog
      v-model:open="showSellConfirm"
      title="Vendre cette relique ?"
      :message="sellConfirmMessage"
      confirm-label="Vendre"
      danger
      @confirm="confirmSell"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import Button from '@/components/ui/Button.vue'
import RarityBadge from '@/components/ui/RarityBadge.vue'
import FxBadge from '@/components/ui/FxBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
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
const completeShopNode = () => {
  const nodeId = gameStore.gameState.mapState.selectedNodeId
  if (nodeId) {
    // S'assure que le node est bien complété même si on quitte sans cliquer sur le bouton
    const allNodes = gameStore.gameState.mapState.layers.flatMap((l) => l.nodes)
    const node = allNodes.find((n) => n.id === nodeId)
    if (node && node.type === 'shop' && !node.completed) {
      gameStore.completeMapNode(nodeId)
    }
  }
}

const exitBazar = () => {
  completeShopNode()
  router.push('/mission-tree')
}

// Filet de sécurité : compléter le node si on quitte le Bazar autrement (navigation arrière, etc.)
onBeforeUnmount(() => {
  completeShopNode()
})

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

  // Remplacer la carte achetée par une nouvelle offre de même rareté (garde les "6 offres" promises)
  const otherNames = bazarOffer.value.filter((a) => a.id !== artifact.id).map((a) => a.name)
  const rarity = artifact.rarity as 'common' | 'rare' | 'epic'
  const replacement = gameStore.generateBazarReplacement(rarity, [...otherNames, artifact.name])

  bazarOffer.value = replacement
    ? bazarOffer.value.map((a) => (a.id === artifact.id ? replacement : a))
    : bazarOffer.value.filter((a) => a.id !== artifact.id)
}

// ===== Vente =====
const allArtifacts = computed(() => gameStore.gameState.inventory.artifacts)
const isActive = (id: string) => gameStore.gameState.inventory.activeArtifacts.includes(id)

const showSellConfirm = ref(false)
const pendingSellArtifact = ref<Artifact | null>(null)

const sellConfirmMessage = computed(() => {
  const artifact = pendingSellArtifact.value
  if (!artifact) return ''
  const activeNote = isActive(artifact.id) ? ' (actuellement équipée)' : ''
  return `Vendre ${artifact.name}${activeNote} ? Cette relique ${rarityLabel(artifact.rarity).toLowerCase()} sera définitivement perdue.`
})

const doSell = (artifact: Artifact) => {
  const goldGained = gameStore.sellArtifact(artifact.id)
  toastStore.showSuccess(`🪙 Vendu : ${artifact.name} pour ${goldGained} or.`, { duration: 3000 })
}

const sell = (artifact: Artifact) => {
  const needsConfirm =
    isActive(artifact.id) || artifact.rarity === 'epic' || artifact.rarity === 'legendary'
  if (needsConfirm) {
    pendingSellArtifact.value = artifact
    showSellConfirm.value = true
    return
  }

  doSell(artifact)
}

const confirmSell = () => {
  if (pendingSellArtifact.value) doSell(pendingSellArtifact.value)
  pendingSellArtifact.value = null
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
    e.resourceBonus?.crop
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
// Tirées des tokens partagés --rarity-* (src/styles/tokens.css), mêmes que RarityBadge.
.rarity-common {
  --rarity-color: var(--rarity-common);
  --rarity-rgb: var(--rarity-common-rgb);
}
.rarity-rare {
  --rarity-color: var(--rarity-rare);
  --rarity-rgb: var(--rarity-rare-rgb);
}
.rarity-epic {
  --rarity-color: var(--rarity-epic);
  --rarity-rgb: var(--rarity-epic-rgb);
}
.rarity-legendary {
  --rarity-color: var(--rarity-legendary);
  --rarity-rgb: var(--rarity-legendary-rgb);
}

// ===== Page =====
.bazar-page {
  min-height: 100vh;
  background: var(--gradient-canvas);
  color: var(--color-text);
  display: flex;
  flex-direction: column;
}

// ===== Header =====
.bazar-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: rgba(var(--rarity-epic-rgb), 0.06);
  border-bottom: 1px solid rgba(var(--rarity-epic-rgb), 0.25);

  h1 {
    flex: 1;
    margin: 0;
    font-size: 1.5rem;
    text-align: center;
    text-shadow: 0 1px 2px rgba(var(--color-black-rgb), 0.1);
  }

  .gold-display {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-accent-ink);
    background: rgba(var(--color-accent-rgb), 0.12);
    padding: 0.3rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(var(--color-accent-rgb), 0.3);
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
    color: var(--rarity-epic);
  }
  .section-subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
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
  color: var(--color-text-muted);

  strong {
    color: var(--color-text);
    &.exhausted {
      color: var(--color-danger);
    }
  }
}

/* Bouton custom volontaire : dégradé indigo/violet propre à l'identité "arcane"
   du Bazar — aucun variant `Button` ne le couvre sans réintroduire le doré
   Travian ou aplatir cette identité. Texte blanc fixe : contraste garanti sur
   ce fond plein quel que soit le thème. */
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
  background: var(--color-bg-surface);
  border: 2px solid var(--rarity-color, var(--rarity-common));
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
    box-shadow: 0 6px 20px rgba(var(--color-black-rgb), 0.12);
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

.card-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text);
}

.card-desc {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0;
  flex: 1;
}

.card-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.card-special {
  font-size: 0.78rem;
  color: var(--rarity-epic);
  background: rgba(var(--rarity-epic-rgb), 0.1);
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
}

.card-durability {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.fragile-tag {
  font-size: 0.72rem;
  color: var(--color-warning);
}

/* Bouton custom volontaire : la teinte est dynamique par rareté de l'objet
   (variable CSS `--rarity-color` posée par le parent) — `Button` n'a pas de
   variant paramétrable par couleur arbitraire. */
.buy-btn {
  margin-top: auto;
  background: linear-gradient(
    135deg,
    rgba(var(--rarity-rgb, var(--rarity-rare-rgb)), 0.18),
    rgba(var(--rarity-rgb, var(--rarity-rare-rgb)), 0.06)
  );
  border: 1px solid var(--rarity-color, var(--rarity-rare));
  color: var(--rarity-color, var(--rarity-rare));
  padding: 0.45rem 0.8rem;
  border-radius: 7px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: rgba(var(--rarity-rgb, var(--rarity-rare-rgb)), 0.3);
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

// ===== Section vente =====
.sell-section {
  .section-title-block h2 {
    color: var(--color-accent-ink);
  }
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
  background: var(--color-bg-surface);
  border: 1px solid var(--rarity-color, var(--rarity-common));
  border-radius: 8px;
  transition: background 0.15s;

  &.is-active {
    background: rgba(var(--color-accent-rgb), 0.06);
  }

  &:hover {
    background: rgba(var(--overlay-rgb), 0.03);
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
  color: var(--color-text);
}

.sell-rarity {
  font-size: 0.75rem;
  color: var(--rarity-color, var(--rarity-common));
}

.active-tag {
  font-size: 0.7rem;
  color: var(--color-success);
  background: rgba(var(--color-success-strong-rgb), 0.15);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  border: 1px solid rgba(var(--color-success-strong-rgb), 0.3);
  width: fit-content;
}

/* Bouton custom volontaire : chip translucide teinté accent, distinct des
   variants pleins de `Button` (primary/secondary/ghost) — traitement propre
   à l'action "vendre" dans ce contexte de carte compacte. */
.sell-btn {
  background: rgba(var(--color-accent-rgb), 0.15);
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);
  color: var(--color-accent-ink);
  padding: 0.4rem 1rem;
  border-radius: 7px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.2s;

  &:hover {
    background: rgba(var(--color-accent-rgb), 0.3);
  }
}

// ===== Zone de sortie =====
.bazar-exit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  border-top: 1px solid rgba(var(--overlay-rgb), 0.1);
  margin-top: 1rem;
}

.exit-warning {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-warning);
  text-align: center;
}
</style>

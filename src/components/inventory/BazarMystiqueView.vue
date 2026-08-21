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

    <!--
      Corps en Bento — même vocabulaire que le village et la fiche territoire
      (BuildingCard.vue / TileDetails.vue) : hero compact, cartes claires à
      barre d'accent gauche, glyphe en filigrane. Ici la teinte d'accent est
      la rareté de chaque relique (--rarity-rgb → --tc).
    -->
    <div class="bazar-bento">
      <!-- ── Hero Offres du jour : identité + tirages + action de renouvellement ── -->
      <div class="bazar-hero">
        <div class="hero-art" aria-hidden="true"><span class="hero-glyph">🔮</span></div>
        <div class="hero-content">
          <div class="hero-icon">🎲</div>
          <div class="hero-info">
            <div class="hero-title-row">
              <h2 class="hero-title">Offres du jour</h2>
              <Badge :tone="rerollsLeft === 0 ? 'danger' : 'neutral'">
                🎲 {{ rerollsLeft }}/{{ BAZAR_MAX_REROLLS }} tirages
              </Badge>
            </div>
            <p class="hero-desc">Achetez une relique parmi les 6 proposées.</p>
          </div>
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

      <!-- ── Grille des 6 offres ── -->
      <div class="offer-grid">
        <div
          v-for="artifact in bazarOffer"
          :key="artifact.id"
          class="offer-card"
          :class="`rarity-${artifact.rarity}`"
        >
          <div class="card-art" aria-hidden="true">
            <span class="card-glyph">{{ artifact.icon }}</span>
          </div>

          <div class="card-body">
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
      </div>

      <!-- ── Section Revente : carte plate façon KPI (barre fine, pas de wash) ── -->
      <div class="sell-section">
        <div class="sell-head">
          <span class="sell-head-icon">🪙</span>
          <span class="sell-head-title">Revendre vos reliques</span>
        </div>
        <p class="sell-hint">
          Transformez vos reliques inutiles en or. Une relique active sera désactivée avant la
          vente.
        </p>

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
            :title="sellCardTitle(artifact)"
          >
            <div class="sell-info">
              <span class="sell-icon">{{ artifact.icon }}</span>
              <div class="sell-details">
                <span class="sell-name">{{ artifact.name }}</span>
                <span class="sell-rarity">{{ rarityLabel(artifact.rarity) }}</span>
              </div>
              <Badge v-if="isActive(artifact.id)" tone="success">Actif</Badge>
            </div>
            <button class="sell-btn" :title="sellBtnTitle(artifact)" @click="sell(artifact)">
              +{{ SELL_PRICES[artifact.rarity] }} 🪙
            </button>
          </div>
        </div>
      </div>

      <!-- ── Quitter le Bazar ── -->
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
import Badge from '@/components/ui/Badge.vue'
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

/** Résumé texte des effets d'une relique — les cartes de revente n'affichent
 * pas les FxBadge, ce tooltip permet de comparer sans repasser par l'achat. */
const effectsSummary = (artifact: Artifact): string => {
  const e = artifact.effects
  const parts: string[] = []
  if (e.economy) parts.push(`+${e.economy}% Éco`)
  if (e.military) parts.push(`+${e.military}% Mil`)
  if (e.defense) parts.push(`+${e.defense}% Déf`)
  if (e.resourceBonus?.wood) parts.push(`+${e.resourceBonus.wood}% Bois`)
  if (e.resourceBonus?.stone) parts.push(`+${e.resourceBonus.stone}% Pierre`)
  if (e.resourceBonus?.iron) parts.push(`+${e.resourceBonus.iron}% Fer`)
  if (e.resourceBonus?.crop) parts.push(`+${e.resourceBonus.crop}% Céréales`)
  if (artifact.specialPower) parts.push(`✨ ${artifact.specialPower.description}`)
  return parts.join(' · ')
}

const durabilityLabel = (artifact: Artifact): string => {
  if (artifact.durability === 'single-use') return 'Usage unique'
  if (artifact.durability === 'uses-limited')
    return `${artifact.usesRemaining ?? artifact.maxUses} combat(s) restant(s)`
  return 'Permanente'
}

/** Tooltip complet d'une carte de revente : description + effets + durabilité */
const sellCardTitle = (artifact: Artifact): string => {
  const lines = [artifact.description]
  const fx = effectsSummary(artifact)
  if (fx) lines.push(fx)
  lines.push(`Durabilité : ${durabilityLabel(artifact)}`)
  return lines.join('\n')
}

/** Tooltip du bouton de vente — avertit si la relique est actuellement équipée */
const sellBtnTitle = (artifact: Artifact): string =>
  isActive(artifact.id)
    ? 'Cette relique est équipée — la vendre la retire du slot'
    : `Vendre ${artifact.name} pour ${SELL_PRICES[artifact.rarity]} or`
</script>

<style scoped lang="scss">
// ===== Couleurs par rareté =====
// Tirées des tokens partagés --rarity-* (src/styles/tokens.css), mêmes que RarityBadge.
// --tc alimente le mécanisme d'accent des cartes bento (cf. BuildingCard.vue).
.rarity-common {
  --rarity-color: var(--rarity-common);
  --tc: var(--rarity-common-rgb);
}
.rarity-rare {
  --rarity-color: var(--rarity-rare);
  --tc: var(--rarity-rare-rgb);
}
.rarity-epic {
  --rarity-color: var(--rarity-epic);
  --tc: var(--rarity-epic-rgb);
}
.rarity-legendary {
  --rarity-color: var(--rarity-legendary);
  --tc: var(--rarity-legendary-rgb);
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

// ===== Corps Bento =====
// Largeur de confort d'une fiche (cf. TileDetails) : 1000px centrés, les
// cellules posent directement sur le canvas.
.bazar-bento {
  flex: 1;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// ===== Hero Offres du jour =====
// Bandeau compact façon tile-hero : wash + glyphe à droite, contenu à gauche,
// action de renouvellement intégrée (elle appartient à cette section).
.bazar-hero {
  --tc: var(--rarity-epic-rgb);
  position: relative;
  border-radius: 16px;
  padding: 14px 18px;
  overflow: hidden;
  background: var(--color-bg-surface);
  border: 1.5px solid rgba(var(--overlay-rgb), 0.12);
  box-shadow:
    0 1px 2px rgba(var(--overlay-rgb), 0.05),
    0 4px 12px -6px rgba(var(--overlay-rgb), 0.15);

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: rgba(var(--tc), 0.85);
    z-index: 2;
  }
}

.hero-art {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(130% 100% at 12% -10%, rgba(var(--tc), 0.22), transparent 62%),
    linear-gradient(165deg, rgba(var(--tc), 0.08), transparent 75%);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 35%, var(--color-bg-surface) 94%);
  }
}

.hero-glyph {
  position: absolute;
  right: -0.1em;
  bottom: -0.3em;
  font-size: 4rem;
  line-height: 1;
  opacity: 0.16;
  transform: rotate(-6deg);
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
}

.hero-icon {
  font-size: 36px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 3px rgba(var(--overlay-rgb), 0.25));
}

.hero-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hero-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-title {
  margin: 0;
  font-size: 1.25em;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.1;
}

.hero-desc {
  margin: 0;
  color: var(--color-text-faint);
  font-style: italic;
  font-size: 0.85em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Bouton custom volontaire : dégradé indigo/violet propre à l'identité "arcane"
   du Bazar — aucun variant `Button` ne le couvre sans réintroduire le doré
   Travian ou aplatir cette identité. Texte blanc fixe : contraste garanti sur
   ce fond plein quel que soit le thème. */
.reroll-btn {
  flex-shrink: 0;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: none;
  color: #fff;
  padding: 0.5rem 1.1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
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
// 3 colonnes à 1000px — pas de carte orpheline avec 6 offres.
.offer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

// Carte d'offre = cellule bento "chaude" : barre de rareté 4px, glyphe en
// filigrane, wash discret teinté rareté — même grammaire que BuildingCard.
.offer-card {
  position: relative;
  border-radius: 16px;
  border: 1.5px solid rgba(var(--overlay-rgb), 0.12);
  background: var(--color-bg-surface);
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(var(--overlay-rgb), 0.05),
    0 4px 12px -6px rgba(var(--overlay-rgb), 0.15);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    border-color 0.15s ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: rgba(var(--tc), 0.85);
    z-index: 2;
  }

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(var(--tc), 0.4);
    box-shadow:
      0 2px 4px rgba(var(--overlay-rgb), 0.08),
      0 10px 20px -10px rgba(var(--overlay-rgb), 0.25);
  }
}

.card-art {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(130% 100% at 12% -10%, rgba(var(--tc), 0.16), transparent 62%),
    linear-gradient(165deg, rgba(var(--tc), 0.06), transparent 75%);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 30%, var(--color-bg-surface) 92%);
  }
}

.card-glyph {
  position: absolute;
  right: -0.3em;
  bottom: -0.25em;
  font-size: 3.4rem;
  line-height: 1;
  opacity: 0.1;
  transform: rotate(-6deg);
}

.card-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  padding: 14px 16px;
  box-sizing: border-box;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-icon {
  font-size: 1.8rem;
  line-height: 1;
  filter: drop-shadow(0 1px 3px rgba(var(--overlay-rgb), 0.25));
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
    rgba(var(--tc, var(--rarity-rare-rgb)), 0.18),
    rgba(var(--tc, var(--rarity-rare-rgb)), 0.06)
  );
  border: 1px solid var(--rarity-color, var(--rarity-rare));
  color: var(--rarity-color, var(--rarity-rare));
  padding: 0.45rem 0.8rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: rgba(var(--tc, var(--rarity-rare-rgb)), 0.3);
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

// ===== Section vente =====
// Carte plate façon KPI : barre d'accent fine, pas de wash — la couleur reste
// un signal (rareté par ligne), pas une texture.
.sell-section {
  --tc: var(--color-accent-rgb);
  position: relative;
  border-radius: 16px;
  border: 1.5px solid rgba(var(--overlay-rgb), 0.12);
  background: var(--color-bg-surface);
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(var(--overlay-rgb), 0.05),
    0 4px 12px -6px rgba(var(--overlay-rgb), 0.15);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: rgba(var(--tc), 0.7);
  }
}

.sell-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sell-head-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.sell-head-title {
  flex: 1;
  font-size: 0.76em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.sell-hint {
  margin: 0;
  font-size: 0.78em;
  color: var(--color-text-faint);
  font-style: italic;
}

.sell-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// Ligne de revente : rangée claire avec barre de rareté à gauche — pas de
// bordure pleine par rareté (bruit), la couleur ne marque que le bord.
.sell-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0.6rem 1rem;
  background: rgba(var(--overlay-rgb), 0.03);
  border: 1px solid rgba(var(--overlay-rgb), 0.1);
  border-left: 3px solid var(--rarity-color, var(--rarity-common));
  border-radius: 10px;
  transition: background 0.15s;

  &.is-active {
    background: rgba(var(--color-accent-rgb), 0.06);
  }

  &:hover {
    background: rgba(var(--overlay-rgb), 0.06);
  }
}

.sell-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.sell-icon {
  font-size: 1.4rem;
}

.sell-details {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.sell-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sell-rarity {
  font-size: 0.75rem;
  color: var(--rarity-color, var(--rarity-common));
}

/* Bouton custom volontaire : chip translucide teinté accent, distinct des
   variants pleins de `Button` (primary/secondary/ghost) — traitement propre
   à l'action "vendre" dans ce contexte de carte compacte. */
.sell-btn {
  background: rgba(var(--color-accent-rgb), 0.15);
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);
  color: var(--color-accent-ink);
  padding: 0.4rem 1rem;
  border-radius: 8px;
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
  padding: 1.5rem 0 0.5rem;
  border-top: 1px solid rgba(var(--overlay-rgb), 0.1);
  margin-top: 4px;
}

.exit-warning {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-warning);
  text-align: center;
}

// ===== Responsive =====
@media (max-width: 640px) {
  .hero-content {
    flex-wrap: wrap;
  }

  .reroll-btn {
    width: 100%;
  }

  .offer-grid {
    grid-template-columns: 1fr;
  }
}
</style>

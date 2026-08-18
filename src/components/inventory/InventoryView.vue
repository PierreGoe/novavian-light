<template>
  <div class="inventory-page">
    <!-- En-tête de navigation -->
    <header class="inv-header">
      <Button variant="secondary" size="sm" @click="goBack">← Retour</Button>
      <h1>🎒 Inventaire</h1>
      <span class="artifact-count">{{ allArtifacts.length }} relique(s)</span>
    </header>

    <div class="inv-body">
      <!-- ===== Slots actifs ===== -->
      <section class="active-section">
        <div class="section-title">
          <h2>Reliques actives</h2>
          <span class="slots-info"
            >{{ activeArtifacts.length }}/{{ MAX_ACTIVE_ARTIFACTS }} slots</span
          >
        </div>

        <div class="active-slots">
          <div
            v-for="index in MAX_ACTIVE_ARTIFACTS"
            :key="index"
            class="slot"
            :class="{ filled: activeArtifacts[index - 1], empty: !activeArtifacts[index - 1] }"
            v-clickable="!!activeArtifacts[index - 1]"
            @click="activeArtifacts[index - 1] && openDetail(activeArtifacts[index - 1])"
          >
            <template v-if="activeArtifacts[index - 1]">
              <div class="slot-artifact" :class="`rarity-${activeArtifacts[index - 1].rarity}`">
                <span class="slot-icon">{{ activeArtifacts[index - 1].icon }}</span>
                <span class="slot-name">{{ activeArtifacts[index - 1].name }}</span>

                <!-- Badge de durabilité -->
                <div class="durability-badge" :class="activeArtifacts[index - 1].durability">
                  <template v-if="activeArtifacts[index - 1].durability === 'single-use'">
                    ⚡ Usage unique
                  </template>
                  <template v-else-if="activeArtifacts[index - 1].durability === 'uses-limited'">
                    🔢 {{ activeArtifacts[index - 1].usesRemaining }}/{{
                      activeArtifacts[index - 1].maxUses
                    }}
                    combats
                  </template>
                  <template v-else> ♾️ Permanent </template>
                </div>

                <!-- Indicateur destructible -->
                <Badge
                  v-if="activeArtifacts[index - 1].destructible"
                  tone="warning"
                  class="destructible-badge"
                  title="Peut être détruite en cas de défaite de campagne"
                >
                  ⚠️ Fragile
                </Badge>

                <!-- Custom volontaire : icône seule (×), sans padding/fond de bouton —
                     aucun variant `Button` ne couvre ce format bouton-icône minimal. -->
                <button
                  class="deactivate-btn"
                  @click.stop="deactivate(activeArtifacts[index - 1].id)"
                  title="Retirer du slot"
                  aria-label="Retirer la relique du slot"
                >
                  ×
                </button>
              </div>
            </template>
            <template v-else>
              <div class="slot-empty">
                <span class="slot-plus">+</span>
                <span class="slot-empty-text">Slot libre</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Résumé des effets totaux -->
        <div class="total-effects-summary" v-if="activeArtifacts.length > 0">
          <h3>Bonus totaux des reliques actives</h3>
          <div class="effects-grid">
            <FxBadge v-if="totalEffects.economy > 0" kind="economy" variant="pill">
              Économie +{{ totalEffects.economy }}%
            </FxBadge>
            <FxBadge v-if="totalEffects.military > 0" kind="military" variant="pill">
              Militaire +{{ totalEffects.military }}%
            </FxBadge>
            <FxBadge v-if="totalEffects.defense > 0" kind="defense" variant="pill">
              Défense +{{ totalEffects.defense }}%
            </FxBadge>
            <!-- Custom volontaire (×4) : FxBadge n'a qu'une seule icône fixe pour
                 kind="resource" (🌾), ce qui ferait perdre la distinction visuelle
                 entre bois/pierre/fer/céréales — chaque ressource a besoin de son
                 propre pictogramme. -->
            <div v-if="totalEffects.resourceBonus.wood > 0" class="effect-chip resource">
              🪵 Bois +{{ totalEffects.resourceBonus.wood }}%
            </div>
            <div v-if="totalEffects.resourceBonus.stone > 0" class="effect-chip resource">
              🪨 Pierre +{{ totalEffects.resourceBonus.stone }}%
            </div>
            <div v-if="totalEffects.resourceBonus.iron > 0" class="effect-chip resource">
              ⚒️ Fer +{{ totalEffects.resourceBonus.iron }}%
            </div>
            <div v-if="totalEffects.resourceBonus.crop > 0" class="effect-chip resource">
              🌾 Céréales +{{ totalEffects.resourceBonus.crop }}%
            </div>
            <Badge
              v-for="power in activeSpecialPowers"
              :key="power.type"
              tone="epic"
              :title="power.description"
            >
              ✨ {{ power.description }}
            </Badge>
          </div>
        </div>
      </section>

      <!-- ===== Filtres ===== -->
      <div class="filters">
        <div class="filter-group">
          <span class="filter-group-label">Type</span>
          <FilterTabs
            :items="typeFilters"
            :model-value="activeTypeFilter"
            @update:model-value="activeTypeFilter = $event as TypeFilter"
          />
        </div>

        <div class="filter-group">
          <span class="filter-group-label">Rareté</span>
          <!-- Custom volontaire : chaque bouton est teinté par sa propre couleur de
               rareté (classe `rarity-*`) — FilterTabs n'a qu'une seule teinte "active"
               globale, incompatible avec ce code couleur par item. -->
          <div class="filter-group-buttons">
            <button
              v-for="rarity in rarityFilters"
              :key="rarity.value"
              class="filter-btn rarity"
              :class="[{ active: activeRarityFilter === rarity.value }, `rarity-${rarity.value}`]"
              @click="activeRarityFilter = rarity.value"
            >
              {{ rarity.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- ===== Forge d'artefacts ===== -->
      <section class="forge-section">
        <div class="section-title">
          <h2>🔨 Forge</h2>
          <span class="gold-display">🪙 {{ currentGold }} or disponible</span>
        </div>
        <p class="forge-subtitle">Forger une relique détruit définitivement l'or dépensé.</p>

        <div class="forge-options">
          <div
            v-for="tier in forgeTiers"
            :key="tier.rarity"
            class="forge-card"
            :class="`rarity-${tier.rarity}`"
          >
            <div class="forge-icon">{{ tier.icon }}</div>
            <div class="forge-info">
              <span class="forge-rarity">Relique {{ tier.label }}</span>
              <span class="forge-cost">{{ tier.cost }} or</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              :disabled="currentGold < tier.cost"
              :title="
                currentGold < tier.cost
                  ? `Il vous manque ${tier.cost - currentGold} or`
                  : `Forger une relique ${tier.label}`
              "
              @click="forgeArtifact(tier)"
            >
              Forger
            </Button>
          </div>
        </div>
      </section>

      <!-- ===== Inventaire complet ===== -->
      <section class="inventory-section">
        <h2>Toutes mes reliques</h2>

        <EmptyState
          v-if="filteredArtifacts.length === 0"
          :message="
            allArtifacts.length === 0
              ? 'Aucune relique dans votre inventaire.'
              : 'Aucune relique ne correspond aux filtres sélectionnés.'
          "
        />

        <div class="artifacts-grid">
          <div
            v-for="artifact in filteredArtifacts"
            :key="artifact.id"
            class="artifact-card"
            :class="[`rarity-${artifact.rarity}`, { active: isActive(artifact.id) }]"
            v-clickable
            @click="openDetail(artifact)"
          >
            <!-- Icône et nom -->
            <div class="card-header">
              <span class="artifact-icon">{{ artifact.icon }}</span>
              <div class="artifact-info">
                <span class="artifact-name">{{ artifact.name }}</span>
                <span class="artifact-type">{{ typeLabel(artifact.type) }}</span>
              </div>
              <RarityBadge :rarity="artifact.rarity" />
            </div>

            <!-- Description -->
            <p class="artifact-desc">{{ artifact.description }}</p>

            <!-- Effets statistiques -->
            <div class="artifact-effects" v-if="hasEffects(artifact)">
              <FxBadge v-if="artifact.effects.economy" kind="economy"
                >+{{ artifact.effects.economy }}% Éco</FxBadge
              >
              <FxBadge v-if="artifact.effects.military" kind="military"
                >+{{ artifact.effects.military }}% Mil</FxBadge
              >
              <FxBadge v-if="artifact.effects.defense" kind="defense"
                >+{{ artifact.effects.defense }}% Déf</FxBadge
              >
              <span v-if="artifact.effects.resourceBonus?.wood" class="fx-badge resource"
                >+{{ artifact.effects.resourceBonus.wood }}% Bois</span
              >
              <span v-if="artifact.effects.resourceBonus?.stone" class="fx-badge resource"
                >+{{ artifact.effects.resourceBonus.stone }}% Pierre</span
              >
              <span v-if="artifact.effects.resourceBonus?.iron" class="fx-badge resource"
                >+{{ artifact.effects.resourceBonus.iron }}% Fer</span
              >
              <span v-if="artifact.effects.resourceBonus?.crop" class="fx-badge resource"
                >+{{ artifact.effects.resourceBonus.crop }}% Céréales</span
              >
            </div>

            <!-- Pouvoir spécial -->
            <div v-if="artifact.specialPower" class="special-power">
              <span class="special-icon">✨</span>
              <span class="special-text">{{ artifact.specialPower.description }}</span>
            </div>

            <!-- Durabilité + destructible -->
            <div class="card-meta">
              <span class="durability-tag" :class="artifact.durability">
                <template v-if="artifact.durability === 'single-use'">⚡ Usage unique</template>
                <template v-else-if="artifact.durability === 'uses-limited'">
                  🔢 {{ artifact.usesRemaining }}/{{ artifact.maxUses }} combats
                </template>
                <template v-else>♾️ Permanent</template>
              </span>
              <span v-if="artifact.destructible" class="destructible-tag">⚠️ Fragile</span>
            </div>

            <!-- Action activate/deactivate -->
            <div class="card-action">
              <Button
                v-if="isActive(artifact.id)"
                variant="danger"
                size="sm"
                class="card-action-btn"
                @click.stop="deactivate(artifact.id)"
              >
                Retirer
              </Button>
              <Button
                v-else
                size="sm"
                class="card-action-btn"
                :disabled="isSlotsMaxed"
                :title="isSlotsMaxed ? 'Tous les slots sont occupés' : 'Activer cette relique'"
                @click.stop="activate(artifact.id)"
              >
                Équiper
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ===== Modale de détail ===== -->
    <BaseDialog
      :open="!!selectedArtifact"
      size="lg"
      :labelledby="selectedArtifact ? `artifact-modal-title-${selectedArtifact.id}` : undefined"
      @update:open="(v) => !v && closeDetail()"
    >
      <template v-if="selectedArtifact" #header>
        <div class="modal-header-wrap">
          <button class="modal-close" @click="closeDetail" aria-label="Fermer">×</button>
          <div class="modal-header">
            <span class="modal-icon">{{ selectedArtifact.icon }}</span>
            <div>
              <h2 :id="`artifact-modal-title-${selectedArtifact.id}`">
                {{ selectedArtifact.name }}
              </h2>
              <span class="modal-rarity">
                <RarityBadge :rarity="selectedArtifact.rarity" /> ·
                {{ typeLabel(selectedArtifact.type) }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <template v-if="selectedArtifact" #default>
        <p class="modal-desc">{{ selectedArtifact.description }}</p>

        <div class="modal-section" v-if="hasEffects(selectedArtifact)">
          <h3>Effets statistiques</h3>
          <ul class="modal-effects-list">
            <li v-if="selectedArtifact.effects.economy">
              📈 Économie : +{{ selectedArtifact.effects.economy }}%
            </li>
            <li v-if="selectedArtifact.effects.military">
              ⚔️ Militaire : +{{ selectedArtifact.effects.military }}%
            </li>
            <li v-if="selectedArtifact.effects.defense">
              🛡️ Défense : +{{ selectedArtifact.effects.defense }}%
            </li>
            <li v-if="selectedArtifact.effects.resourceBonus?.wood">
              🪵 Bois : +{{ selectedArtifact.effects.resourceBonus.wood }}%
            </li>
            <li v-if="selectedArtifact.effects.resourceBonus?.stone">
              🪨 Pierre : +{{ selectedArtifact.effects.resourceBonus.stone }}%
            </li>
            <li v-if="selectedArtifact.effects.resourceBonus?.iron">
              ⚒️ Fer : +{{ selectedArtifact.effects.resourceBonus.iron }}%
            </li>
            <li v-if="selectedArtifact.effects.resourceBonus?.crop">
              🌾 Céréales : +{{ selectedArtifact.effects.resourceBonus.crop }}%
            </li>
          </ul>
        </div>

        <div class="modal-section" v-if="selectedArtifact.specialPower">
          <h3>✨ Pouvoir spécial</h3>
          <p class="modal-special">{{ selectedArtifact.specialPower.description }}</p>
        </div>

        <div class="modal-section">
          <h3>Durabilité</h3>
          <p>
            <template v-if="selectedArtifact.durability === 'single-use'">
              ⚡ Usage unique — disparaît après un combat
            </template>
            <template v-else-if="selectedArtifact.durability === 'uses-limited'">
              🔢 {{ selectedArtifact.usesRemaining }} combat(s) restant(s) sur
              {{ selectedArtifact.maxUses }}
            </template>
            <template v-else> ♾️ Permanente — ne s'use jamais </template>
          </p>
          <p v-if="selectedArtifact.destructible" class="modal-fragile">
            ⚠️ Cette relique peut être détruite en cas de défaite de campagne si elle est active.
          </p>
          <p v-else class="modal-safe">✅ Cette relique est indestructible.</p>
        </div>

        <div class="modal-section" v-if="selectedArtifact.obtainedFrom">
          <h3>Obtenue depuis</h3>
          <p>{{ selectedArtifact.obtainedFrom }}</p>
        </div>
      </template>

      <template v-if="selectedArtifact" #footer>
        <Button
          v-if="isActive(selectedArtifact.id)"
          variant="danger"
          @click="deactivateAndClose(selectedArtifact.id)"
        >
          Retirer du slot actif
        </Button>
        <Button
          v-else
          :disabled="isSlotsMaxed"
          :title="isSlotsMaxed ? `Tous les ${MAX_ACTIVE_ARTIFACTS} slots sont occupés` : ''"
          @click="activateAndClose(selectedArtifact.id)"
        >
          Activer (slot {{ activeArtifacts.length + 1 }}/{{ MAX_ACTIVE_ARTIFACTS }})
        </Button>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore, MAX_ACTIVE_ARTIFACTS, type Artifact } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'
import Button from '@/components/ui/Button.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import RarityBadge from '@/components/ui/RarityBadge.vue'
import FxBadge from '@/components/ui/FxBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import Badge from '@/components/ui/Badge.vue'

const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()

// ===== Navigation =====
const goBack = () => router.push('/mission-tree')

// ===== Données de l'inventaire =====
const allArtifacts = computed(() => gameStore.gameState.inventory.artifacts)

const activeArtifacts = computed(
  () =>
    gameStore.gameState.inventory.activeArtifacts
      .map((id) => allArtifacts.value.find((a) => a.id === id))
      .filter(Boolean) as Artifact[],
)

const isActive = (id: string) => gameStore.gameState.inventory.activeArtifacts.includes(id)

const isSlotsMaxed = computed(
  () => gameStore.gameState.inventory.activeArtifacts.length >= MAX_ACTIVE_ARTIFACTS,
)

const totalEffects = computed(() => gameStore.getTotalArtifactEffects.value)

/** Collecte tous les pouvoirs spéciaux des artefacts actifs */
const activeSpecialPowers = computed(() =>
  activeArtifacts.value.filter((a) => a.specialPower).map((a) => a.specialPower!),
)

// ===== Filtres =====
type TypeFilter = 'all' | 'weapon' | 'armor' | 'accessory' | 'relic'
type RarityFilter = 'all' | 'common' | 'rare' | 'epic' | 'legendary'

const activeTypeFilter = ref<TypeFilter>('all')
const activeRarityFilter = ref<RarityFilter>('all')

const typeFilters: { label: string; value: TypeFilter }[] = [
  { label: 'Tous', value: 'all' },
  { label: '⚔️ Arme', value: 'weapon' },
  { label: '🛡️ Armure', value: 'armor' },
  { label: '💍 Accessoire', value: 'accessory' },
  { label: '🏺 Relique', value: 'relic' },
]

const rarityFilters: { label: string; value: RarityFilter }[] = [
  { label: 'Toutes', value: 'all' },
  { label: 'Commune', value: 'common' },
  { label: 'Rare', value: 'rare' },
  { label: 'Épique', value: 'epic' },
  { label: 'Légendaire', value: 'legendary' },
]

const RARITY_ORDER: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 }

const filteredArtifacts = computed(() => {
  return allArtifacts.value
    .filter((a) => {
      const typeOk = activeTypeFilter.value === 'all' || a.type === activeTypeFilter.value
      const rarityOk = activeRarityFilter.value === 'all' || a.rarity === activeRarityFilter.value
      return typeOk && rarityOk
    })
    .sort((a, b) => {
      // Actifs en premier
      const aActive = isActive(a.id) ? 1 : 0
      const bActive = isActive(b.id) ? 1 : 0
      if (bActive !== aActive) return bActive - aActive
      // Puis par rareté décroissante
      return (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0)
    })
})

// ===== Modale de détail =====
const selectedArtifact = ref<Artifact | null>(null)

// Le focus clavier à l'ouverture est géré par BaseDialog
const openDetail = (artifact: Artifact) => {
  selectedArtifact.value = artifact
}

const closeDetail = () => {
  selectedArtifact.value = null
}

// ===== Actions =====
const activate = (id: string) => {
  if (isSlotsMaxed.value) {
    toastStore.showInfo(`Tous les ${MAX_ACTIVE_ARTIFACTS} slots actifs sont déjà occupés.`, {
      duration: 3000,
    })
    return
  }
  gameStore.activateArtifact(id)
  const artifact = allArtifacts.value.find((a) => a.id === id)
  if (artifact) toastStore.showSuccess(`${artifact.name} activée !`, { duration: 2000 })
}

const activateAndClose = (id: string) => {
  activate(id)
  closeDetail()
}

const deactivateAndClose = (id: string) => {
  deactivate(id)
  closeDetail()
}

const deactivate = (id: string) => {
  gameStore.deactivateArtifact(id)
  const artifact = allArtifacts.value.find((a) => a.id === id)
  if (artifact) toastStore.showInfo(`${artifact.name} retirée du slot.`, { duration: 2000 })
}

// ===== Forge =====
interface ForgeTier {
  rarity: 'common' | 'rare' | 'epic'
  label: string
  icon: string
  cost: number
}

const forgeTiers: ForgeTier[] = [
  { rarity: 'common', label: 'Commune', icon: '⚒️', cost: 150 },
  { rarity: 'rare', label: 'Rare', icon: '🔥', cost: 400 },
  { rarity: 'epic', label: 'Épique', icon: '✨', cost: 900 },
]

const currentGold = computed(() => gameStore.gameState.inventory.gold)

const forgeArtifact = (tier: ForgeTier) => {
  if (!gameStore.spendGold(tier.cost)) {
    toastStore.showInfo(`Pas assez d'or pour forger une relique ${tier.label}.`, { duration: 3000 })
    return
  }

  // Forger un artefact dont la rareté correspond au palier
  const artifact = gameStore.giveRandomArtifactOfRarity(tier.rarity)
  toastStore.showSuccess(`🔨 Forge réussie ! Vous avez obtenu : ${artifact.name} (${tier.label})`, {
    duration: 5000,
  })
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

const typeLabel = (type: Artifact['type']): string => {
  const labels: Record<Artifact['type'], string> = {
    weapon: 'Arme',
    armor: 'Armure',
    accessory: 'Accessoire',
    relic: 'Relique',
  }
  return labels[type]
}
</script>

<style scoped lang="scss">
// ===== Couleurs par rareté =====
// Bordures/glows des cartes — teinte tirée des tokens --rarity-* (src/styles/tokens.css),
// les mêmes que RarityBadge, pour rester visuellement cohérent avec le design system.

.rarity-common {
  --rarity-color: var(--rarity-common);
}
.rarity-rare {
  --rarity-color: var(--rarity-rare);
}
.rarity-epic {
  --rarity-color: var(--rarity-epic);
}
.rarity-legendary {
  --rarity-color: var(--rarity-legendary);
}

// ===== Page globale =====
.inventory-page {
  min-height: 100vh;
  background: var(--gradient-canvas);
  color: var(--color-text);
  display: flex;
  flex-direction: column;
}

// ===== Header =====
.inv-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: rgba(var(--overlay-rgb), 0.04);
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.1);

  h1 {
    flex: 1;
    margin: 0;
    font-size: 1.5rem;
    text-align: center;
  }

  .artifact-count {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
}

// ===== Body =====
.inv-body {
  flex: 1;
  padding: 1.5rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

// ===== Section slots actifs =====
.active-section {
  margin-bottom: 2rem;
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1rem;

  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-accent-ink);
  }

  .slots-info {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    background: rgba(var(--overlay-rgb), 0.05);
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
  }
}

.active-slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.slot {
  border-radius: 12px;
  border: 2px dashed rgba(var(--overlay-rgb), 0.2);
  min-height: 120px;
  transition: border-color 0.2s;
  position: relative;

  &.filled {
    border-style: solid;
    border-color: var(--rarity-color, var(--rarity-rare));
    cursor: pointer;

    &:hover {
      filter: brightness(1.1);
    }
  }

  &.empty {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.slot-artifact {
  padding: 0.75rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  .slot-icon {
    font-size: 1.8rem;
  }
  .slot-name {
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.2;
  }
}

.durability-badge {
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  width: fit-content;
  margin-top: auto;

  &.single-use {
    background: rgba(var(--color-danger-rgb), 0.15);
    color: var(--color-danger);
  }
  &.uses-limited {
    background: rgba(var(--color-warning-rgb), 0.15);
    color: var(--color-warning);
  }
  &.permanent {
    background: rgba(var(--color-success-strong-rgb), 0.15);
    color: var(--color-success);
  }
}

.destructible-badge {
  font-size: 0.6rem;
  color: var(--color-warning);
}

.deactivate-btn {
  position: absolute;
  top: 0.2rem;
  right: 0.2rem;
  background: rgba(var(--color-danger-rgb), 0.5);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(var(--color-danger-rgb), 0.9);
  }
}

.slot-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  color: rgba(var(--overlay-rgb), 0.3);

  .slot-plus {
    font-size: 1.5rem;
  }
  .slot-empty-text {
    font-size: 0.7rem;
  }
}

// ===== Résumé des effets totaux =====
.total-effects-summary {
  background: rgba(var(--overlay-rgb), 0.04);
  border: 1px solid rgba(var(--color-accent-rgb), 0.2);
  border-radius: 10px;
  padding: 1rem 1.25rem;

  h3 {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: var(--color-accent-ink);
  }

  .effects-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}

.effect-chip {
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;

  &.resource {
    background: rgba(var(--fx-resource-rgb), 0.15);
    color: var(--color-warning);
    border: 1px solid rgba(var(--fx-resource-rgb), 0.3);
  }
}

// ===== Filtres =====
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.filter-group-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-faint);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-group-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

// ===== Forge =====
.forge-section {
  margin-bottom: 2rem;
  padding: 1.25rem 1.5rem;
  background: rgba(var(--overlay-rgb), 0.04);
  border-radius: 12px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
}

.forge-subtitle {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0.25rem 0 1rem;
}

.gold-display {
  font-size: 0.9rem;
  color: var(--color-accent-ink);
  font-weight: 600;
}

.forge-options {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.forge-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(var(--overlay-rgb), 0.04);
  border-radius: 10px;
  border: 1px solid var(--rarity-color, var(--rarity-common));
  flex: 1;
  min-width: 170px;

  .forge-icon {
    font-size: 1.6rem;
  }

  .forge-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
  }

  .forge-rarity {
    font-size: 0.85rem;
    color: var(--rarity-color, var(--rarity-common));
    font-weight: 600;
  }

  .forge-cost {
    font-size: 0.8rem;
    color: var(--color-accent-ink);
  }
}

.filter-btn {
  background: rgba(var(--overlay-rgb), 0.07);
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  color: var(--color-text-muted);
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.2s;

  &:hover {
    background: rgba(var(--overlay-rgb), 0.15);
  }

  &.active {
    background: rgba(var(--color-accent-rgb), 0.15);
    border-color: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 600;
  }

  &.rarity.rarity-rare {
    border-color: rgba(var(--rarity-rare-rgb), 0.4);
    &.active {
      background: rgba(var(--rarity-rare-rgb), 0.15);
      border-color: var(--rarity-rare);
      color: var(--rarity-rare);
    }
  }
  &.rarity.rarity-epic {
    border-color: rgba(var(--rarity-epic-rgb), 0.4);
    &.active {
      background: rgba(var(--rarity-epic-rgb), 0.15);
      border-color: var(--rarity-epic);
      color: var(--rarity-epic);
    }
  }
  &.rarity.rarity-legendary {
    border-color: rgba(var(--rarity-legendary-rgb), 0.4);
    &.active {
      background: rgba(var(--rarity-legendary-rgb), 0.15);
      border-color: var(--rarity-legendary);
      color: var(--rarity-legendary);
    }
  }
}

// ===== Section inventaire =====
.inventory-section {
  h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: var(--color-accent-ink);
  }
}

.artifacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

// ===== Carte d'artefact =====
.artifact-card {
  background: var(--color-bg-surface);
  border: 1px solid rgba(var(--overlay-rgb), 0.1);
  border-left: 3px solid var(--rarity-color, var(--rarity-common));
  border-radius: 10px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  &:hover {
    background: rgba(var(--overlay-rgb), 0.03);
    transform: translateY(-1px);
  }

  &.active {
    background: rgba(var(--color-accent-rgb), 0.06);
    border-color: var(--rarity-color, var(--rarity-common));
    box-shadow: 0 0 12px rgba(var(--color-accent-rgb), 0.15);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;

  .artifact-icon {
    font-size: 1.6rem;
    flex-shrink: 0;
  }

  .artifact-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .artifact-name {
    font-size: 0.9rem;
    font-weight: 700;
  }
  .artifact-type {
    font-size: 0.7rem;
    color: var(--color-text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}

.artifact-desc {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0;
}

.artifact-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.fx-badge {
  font-size: 0.68rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-weight: 600;

  &.resource {
    background: rgba(var(--fx-resource-rgb), 0.15);
    color: var(--color-warning);
  }
}

.special-power {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.77rem;
  background: rgba(var(--rarity-epic-rgb), 0.15);
  border: 1px solid rgba(var(--rarity-epic-rgb), 0.3);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  color: var(--rarity-epic);

  .special-icon {
    flex-shrink: 0;
  }
}

.card-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: auto;
}

.durability-tag {
  font-size: 0.65rem;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;

  &.single-use {
    background: rgba(var(--color-danger-rgb), 0.15);
    color: var(--color-danger);
  }
  &.uses-limited {
    background: rgba(var(--color-warning-rgb), 0.15);
    color: var(--color-warning);
  }
  &.permanent {
    background: rgba(var(--color-success-strong-rgb), 0.15);
    color: var(--color-success);
  }
}

.destructible-tag {
  font-size: 0.65rem;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  background: rgba(var(--color-warning-rgb), 0.15);
  color: var(--color-warning);
}

.card-action {
  margin-top: 0.25rem;
}

.card-action-btn {
  width: 100%;
}

// ===== Modale de détail =====
// BaseDialog gère le backdrop/transition/fermeture — il ne reste ici que la
// mise en page propre au contenu de cette modale (le bouton fermer a besoin
// d'un ancêtre positionné, fourni par .modal-header-wrap).
.modal-header-wrap {
  position: relative;
}

.modal-close {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  background: rgba(var(--overlay-rgb), 0.1);
  border: none;
  color: var(--color-text-muted);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(var(--overlay-rgb), 0.2);
    color: var(--color-text);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-right: 2rem;

  .modal-icon {
    font-size: 2.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .modal-rarity {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--color-text-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
  }
}

.modal-desc {
  color: var(--color-text-muted);
  font-size: 0.88rem;
  line-height: 1.5;
  margin: 0 0 1rem;
}

.modal-section {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.08);

  &:last-of-type {
    border-bottom: none;
  }

  h3 {
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-accent-ink);
    margin: 0 0 0.5rem;
  }

  p {
    margin: 0.3rem 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
}

.modal-effects-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  li {
    font-size: 0.85rem;
    color: var(--color-text);
  }
}

.modal-special {
  color: var(--rarity-epic);
  font-size: 0.88rem;
}

.modal-fragile {
  color: var(--color-warning);
}
.modal-safe {
  color: var(--color-success);
}
</style>

<template>
  <div class="inventory-page">
    <!-- En-tête de navigation -->
    <header class="inv-header">
      <button class="back-btn" @click="goBack">← Retour</button>
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
                <div
                  v-if="activeArtifacts[index - 1].destructible"
                  class="destructible-badge"
                  title="Peut être détruite en cas de défaite de campagne"
                >
                  ⚠️ Fragile
                </div>

                <button
                  class="deactivate-btn"
                  @click.stop="deactivate(activeArtifacts[index - 1].id)"
                  title="Retirer du slot"
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
            <div v-if="totalEffects.economy > 0" class="effect-chip economy">
              📈 Économie +{{ totalEffects.economy }}%
            </div>
            <div v-if="totalEffects.military > 0" class="effect-chip military">
              ⚔️ Militaire +{{ totalEffects.military }}%
            </div>
            <div v-if="totalEffects.defense > 0" class="effect-chip defense">
              🛡️ Défense +{{ totalEffects.defense }}%
            </div>
            <div v-if="totalEffects.resourceBonus.wood > 0" class="effect-chip resource">
              🪵 Bois +{{ totalEffects.resourceBonus.wood }}%
            </div>
            <div v-if="totalEffects.resourceBonus.stone > 0" class="effect-chip resource">
              🪨 Pierre +{{ totalEffects.resourceBonus.stone }}%
            </div>
            <div v-if="totalEffects.resourceBonus.iron > 0" class="effect-chip resource">
              ⚙️ Fer +{{ totalEffects.resourceBonus.iron }}%
            </div>
            <div v-if="totalEffects.resourceBonus.food > 0" class="effect-chip resource">
              🌾 Nourriture +{{ totalEffects.resourceBonus.food }}%
            </div>
            <div
              v-for="power in activeSpecialPowers"
              :key="power.type"
              class="effect-chip special"
              :title="power.description"
            >
              ✨ {{ power.description }}
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Filtres ===== -->
      <div class="filters">
        <button
          v-for="filter in typeFilters"
          :key="filter.value"
          class="filter-btn"
          :class="{ active: activeTypeFilter === filter.value }"
          @click="activeTypeFilter = filter.value"
        >
          {{ filter.label }}
        </button>

        <div class="filter-separator"></div>

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

      <!-- ===== Forge d'artefacts ===== -->
      <section class="forge-section">
        <div class="section-title">
          <h2>🔨 Forge</h2>
          <span class="gold-display">💰 {{ currentGold }} or disponible</span>
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
            <button
              class="forge-btn"
              :disabled="currentGold < tier.cost"
              :title="
                currentGold < tier.cost
                  ? `Il vous manque ${tier.cost - currentGold} or`
                  : `Forger une relique ${tier.label}`
              "
              @click="forgeArtifact(tier)"
            >
              Forger
            </button>
          </div>
        </div>
      </section>

      <!-- ===== Inventaire complet ===== -->
      <section class="inventory-section">
        <h2>Toutes mes reliques</h2>

        <div v-if="filteredArtifacts.length === 0" class="empty-state">
          <span>{{
            allArtifacts.length === 0
              ? 'Aucune relique dans votre inventaire.'
              : 'Aucune relique ne correspond aux filtres sélectionnés.'
          }}</span>
        </div>

        <div class="artifacts-grid">
          <div
            v-for="artifact in filteredArtifacts"
            :key="artifact.id"
            class="artifact-card"
            :class="[`rarity-${artifact.rarity}`, { active: isActive(artifact.id) }]"
            @click="openDetail(artifact)"
          >
            <!-- Icône et nom -->
            <div class="card-header">
              <span class="artifact-icon">{{ artifact.icon }}</span>
              <div class="artifact-info">
                <span class="artifact-name">{{ artifact.name }}</span>
                <span class="artifact-type">{{ typeLabel(artifact.type) }}</span>
              </div>
              <span class="rarity-badge">{{ rarityLabel(artifact.rarity) }}</span>
            </div>

            <!-- Description -->
            <p class="artifact-desc">{{ artifact.description }}</p>

            <!-- Effets statistiques -->
            <div class="artifact-effects" v-if="hasEffects(artifact)">
              <span v-if="artifact.effects.economy" class="fx-badge economy"
                >+{{ artifact.effects.economy }}% Éco</span
              >
              <span v-if="artifact.effects.military" class="fx-badge military"
                >+{{ artifact.effects.military }}% Mil</span
              >
              <span v-if="artifact.effects.defense" class="fx-badge defense"
                >+{{ artifact.effects.defense }}% Déf</span
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
              <span v-if="artifact.effects.resourceBonus?.food" class="fx-badge resource"
                >+{{ artifact.effects.resourceBonus.food }}% Nourriture</span
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
              <button
                v-if="isActive(artifact.id)"
                class="action-btn deactivate"
                @click.stop="deactivate(artifact.id)"
              >
                Retirer
              </button>
              <button
                v-else
                class="action-btn activate"
                :disabled="isSlotsMaxed"
                :title="isSlotsMaxed ? 'Tous les slots sont occupés' : 'Activer cette relique'"
                @click.stop="activate(artifact.id)"
              >
                Équiper
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ===== Modale de détail ===== -->
    <Transition name="modal">
      <div v-if="selectedArtifact" class="modal-overlay" @click.self="closeDetail">
        <div class="modal-card" :class="`rarity-${selectedArtifact.rarity}`">
          <button class="modal-close" @click="closeDetail">×</button>

          <div class="modal-header">
            <span class="modal-icon">{{ selectedArtifact.icon }}</span>
            <div>
              <h2>{{ selectedArtifact.name }}</h2>
              <span class="modal-rarity"
                >{{ rarityLabel(selectedArtifact.rarity) }} ·
                {{ typeLabel(selectedArtifact.type) }}</span
              >
            </div>
          </div>

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
                ⚙️ Fer : +{{ selectedArtifact.effects.resourceBonus.iron }}%
              </li>
              <li v-if="selectedArtifact.effects.resourceBonus?.food">
                🌾 Nourriture : +{{ selectedArtifact.effects.resourceBonus.food }}%
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

          <div class="modal-actions">
            <button
              v-if="isActive(selectedArtifact.id)"
              class="action-btn deactivate large"
              @click="deactivateAndClose(selectedArtifact.id)"
            >
              Retirer du slot actif
            </button>
            <button
              v-else
              class="action-btn activate large"
              :disabled="isSlotsMaxed"
              :title="isSlotsMaxed ? `Tous les ${MAX_ACTIVE_ARTIFACTS} slots sont occupés` : ''"
              @click="activateAndClose(selectedArtifact.id)"
            >
              Activer (slot {{ activeArtifacts.length + 1 }}/{{ MAX_ACTIVE_ARTIFACTS }})
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore, MAX_ACTIVE_ARTIFACTS, type Artifact } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'

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
    e.resourceBonus?.food
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
@use 'sass:color';

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

// ===== Page globale =====
.inventory-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

// ===== Header =====
.inv-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  h1 {
    flex: 1;
    margin: 0;
    font-size: 1.5rem;
    text-align: center;
  }

  .artifact-count {
    font-size: 0.85rem;
    color: #94a3b8;
  }
}

.back-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
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
    color: #f1c40f;
  }

  .slots-info {
    font-size: 0.8rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
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
  border: 2px dashed rgba(255, 255, 255, 0.2);
  min-height: 120px;
  transition: border-color 0.2s;
  position: relative;

  &.filled {
    border-style: solid;
    border-color: var(--rarity-color, #3b82f6);
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
    background: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
  &.uses-limited {
    background: rgba(245, 158, 11, 0.3);
    color: #fcd34d;
  }
  &.permanent {
    background: rgba(34, 197, 94, 0.25);
    color: #86efac;
  }
}

.destructible-badge {
  font-size: 0.6rem;
  color: #fb923c;
}

.deactivate-btn {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  background: rgba(239, 68, 68, 0.5);
  border: none;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(239, 68, 68, 0.9);
  }
}

.slot-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  color: rgba(255, 255, 255, 0.3);

  .slot-plus {
    font-size: 1.5rem;
  }
  .slot-empty-text {
    font-size: 0.7rem;
  }
}

// ===== Résumé des effets totaux =====
.total-effects-summary {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 10px;
  padding: 1rem 1.25rem;

  h3 {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: #f1c40f;
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

  &.economy {
    background: rgba(34, 197, 94, 0.2);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  &.military {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  &.defense {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  &.resource {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  &.special {
    background: rgba(139, 92, 246, 0.2);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }
}

// ===== Filtres =====
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

// ===== Forge =====
.forge-section {
  margin-bottom: 2rem;
  padding: 1.25rem 1.5rem;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 12px;
  border: 1px solid rgba(180, 130, 50, 0.3);
}

.forge-subtitle {
  font-size: 0.82rem;
  color: #94a3b8;
  margin: 0.25rem 0 1rem;
}

.gold-display {
  font-size: 0.9rem;
  color: #fcd34d;
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
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  border: 1px solid var(--rarity-color, #9ca3af);
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
    color: var(--rarity-color, #9ca3af);
    font-weight: 600;
  }

  .forge-cost {
    font-size: 0.8rem;
    color: #fcd34d;
  }

  .forge-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #e2e8f0;
    padding: 0.4rem 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.82rem;
    transition: background 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

.filter-separator {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
}

.filter-btn {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  &.active {
    background: rgba(241, 196, 15, 0.25);
    border-color: #f1c40f;
    color: #fef08a;
    font-weight: 600;
  }

  &.rarity.rarity-rare {
    border-color: rgba($rarity-rare, 0.4);
    &.active {
      background: rgba($rarity-rare, 0.25);
      border-color: $rarity-rare;
      color: color.adjust($rarity-rare, $lightness: 30%);
    }
  }
  &.rarity.rarity-epic {
    border-color: rgba($rarity-epic, 0.4);
    &.active {
      background: rgba($rarity-epic, 0.25);
      border-color: $rarity-epic;
      color: color.adjust($rarity-epic, $lightness: 25%);
    }
  }
  &.rarity.rarity-legendary {
    border-color: rgba($rarity-legendary, 0.4);
    &.active {
      background: rgba($rarity-legendary, 0.25);
      border-color: $rarity-legendary;
      color: color.adjust($rarity-legendary, $lightness: 20%);
    }
  }
}

// ===== Section inventaire =====
.inventory-section {
  h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: #f1c40f;
  }
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
  font-style: italic;
}

.artifacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

// ===== Carte d'artefact =====
.artifact-card {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 3px solid var(--rarity-color, #9ca3af);
  border-radius: 10px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  &:hover {
    background: rgba(0, 0, 0, 0.5);
    transform: translateY(-1px);
  }

  &.active {
    background: rgba(241, 196, 15, 0.08);
    border-color: var(--rarity-color, #9ca3af);
    box-shadow: 0 0 12px rgba(241, 196, 15, 0.15);
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
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .rarity-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--rarity-color, #9ca3af);
    border: 1px solid var(--rarity-color, #9ca3af);
    white-space: nowrap;
  }
}

.artifact-desc {
  font-size: 0.78rem;
  color: #94a3b8;
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

  &.economy {
    background: rgba(34, 197, 94, 0.2);
    color: #86efac;
  }
  &.military {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }
  &.defense {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }
  &.resource {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }
}

.special-power {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.77rem;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  color: #c4b5fd;

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
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }
  &.uses-limited {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }
  &.permanent {
    background: rgba(34, 197, 94, 0.15);
    color: #86efac;
  }
}

.destructible-tag {
  font-size: 0.65rem;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  background: rgba(249, 115, 22, 0.2);
  color: #fdba74;
}

.card-action {
  margin-top: 0.25rem;
}

// ===== Boutons action =====
.action-btn {
  width: 100%;
  padding: 0.45rem;
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &.activate {
    background: linear-gradient(135deg, #f1c40f, #e67e22);
    color: #1a1a2e;

    &:hover:not(:disabled) {
      filter: brightness(1.15);
    }

    &:disabled {
      background: rgba(255, 255, 255, 0.1);
      color: #64748b;
      cursor: not-allowed;
    }
  }

  &.deactivate {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);

    &:hover {
      background: rgba(239, 68, 68, 0.35);
    }
  }

  &.large {
    padding: 0.7rem 1.5rem;
    font-size: 0.95rem;
  }
}

// ===== Modale de détail =====
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  background: #1e293b;
  border: 2px solid var(--rarity-color, #9ca3af);
  border-radius: 16px;
  padding: 1.75rem;
  max-width: 480px;
  width: 100%;
  position: relative;
  box-shadow:
    0 0 40px rgba(0, 0, 0, 0.6),
    0 0 20px rgba(var(--rarity-color, 156, 163, 175), 0.2);

  .modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #94a3b8;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #e2e8f0;
    }
  }
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;

  .modal-icon {
    font-size: 2.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .modal-rarity {
    font-size: 0.75rem;
    color: var(--rarity-color, #9ca3af);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
  }
}

.modal-desc {
  color: #94a3b8;
  font-size: 0.88rem;
  line-height: 1.5;
  margin: 0 0 1rem;
}

.modal-section {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  &:last-of-type {
    border-bottom: none;
  }

  h3 {
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #f1c40f;
    margin: 0 0 0.5rem;
  }

  p {
    margin: 0.3rem 0;
    font-size: 0.85rem;
    color: #cbd5e1;
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
    color: #e2e8f0;
  }
}

.modal-special {
  color: #c4b5fd;
  font-size: 0.88rem;
}

.modal-fragile {
  color: #fdba74;
}
.modal-safe {
  color: #86efac;
}

.modal-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
}

// ===== Transition modale =====
.modal-enter-active,
.modal-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>

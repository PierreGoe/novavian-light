<template>
  <BaseDialog :open="visible" size="md" @update:open="onUpdateOpen">
    <template #header>
      <div class="victory-banner">
        <div class="banner-particles">
          <span v-for="i in 10" :key="i" class="particle" :style="{ '--i': i }"></span>
        </div>
        <div class="banner-emblem">
          <span class="emblem-icon">🏆</span>
          <div class="emblem-ring"></div>
        </div>
        <div class="banner-text">
          <h2 class="banner-title">Campagne terminée !</h2>
          <p class="banner-subtitle">{{ nodeTitle }}</p>
        </div>
      </div>
    </template>

    <!-- Section gains -->
    <div class="gains-section">
      <SectionLabel>Récompenses obtenues</SectionLabel>

      <!--
        Volontairement custom, pas de Badge/ListRow : chaque type de gain (or, artefact,
        bonus actif) a sa propre teinte de fond/bordure ouverte (or/violet/rareté) et une
        mise en page à 3 zones (icône/nom/valeur) que ces composants ne paramètrent pas.
      -->
      <div class="gains-list">
        <!-- Or de base campagne -->
        <div class="gain-row gain-gold">
          <span class="gain-icon">🪙</span>
          <span class="gain-name">Bonus de campagne</span>
          <span class="gain-value">+{{ bonusGold }} or</span>
        </div>

        <!-- Or du nœud -->
        <div v-if="nodeRewardGold > 0" class="gain-row gain-gold">
          <span class="gain-icon">🪙</span>
          <span class="gain-name">Récompense du nœud</span>
          <span class="gain-value">+{{ nodeRewardGold }} or</span>
        </div>

        <!-- Artefact -->
        <div
          v-if="nodeRewardArtifact"
          class="gain-row gain-artifact"
          :class="`rarity-${nodeRewardArtifact.rarity}`"
        >
          <span class="gain-icon">{{ nodeRewardArtifact.icon }}</span>
          <div class="gain-artifact-info">
            <span class="gain-name">{{ nodeRewardArtifact.name }}</span>
            <RarityBadge :rarity="nodeRewardArtifact.rarity" />
          </div>
          <span class="gain-value gain-value--artifact">Relique</span>
        </div>

        <!-- Bonus artefacts actifs -->
        <template v-for="bonus in artifactBonuses" :key="bonus.id">
          <div v-if="bonus.goldBonus > 0" class="gain-row gain-artifact-bonus">
            <span class="gain-icon">{{ bonus.icon }}</span>
            <span class="gain-name">{{ bonus.name }}</span>
            <span class="gain-value">+{{ bonus.goldBonus }} or</span>
          </div>
          <div v-if="bonus.leadershipBonus > 0" class="gain-row gain-artifact-bonus">
            <span class="gain-icon">{{ bonus.icon }}</span>
            <span class="gain-name">{{ bonus.name }}</span>
            <span class="gain-value gain-value--leadership"
              >+{{ bonus.leadershipBonus }} leadership</span
            >
          </div>
        </template>
      </div>

      <!-- Total or -->
      <div class="total-row">
        <span class="total-label">Or total reçu</span>
        <CurrencyBadge :amount="totalGold" />
      </div>
    </div>

    <template #footer>
      <Button @click="emit('close')">Continuer l'aventure →</Button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Artifact } from '@/stores/gameStore'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import Button from '@/components/ui/Button.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import RarityBadge from '@/components/ui/RarityBadge.vue'
import CurrencyBadge from '@/components/ui/CurrencyBadge.vue'

interface ArtifactBonus {
  id: string
  name: string
  icon: string
  goldBonus: number
  leadershipBonus: number
}

const props = defineProps<{
  visible: boolean
  nodeTitle: string
  bonusGold: number
  nodeRewardGold: number
  nodeRewardArtifact: Artifact | null
  artifactBonuses: ArtifactBonus[]
}>()

const emit = defineEmits<{ close: [] }>()

const totalGold = computed(() => {
  let total = props.bonusGold + props.nodeRewardGold
  for (const b of props.artifactBonuses) total += b.goldBonus
  return total
})

// Fermeture via le backdrop/Esc de BaseDialog — équivaut à un clic sur "Continuer"
function onUpdateOpen(value: boolean) {
  if (!value) emit('close')
}
</script>

<style scoped>
/* ── Bannière — bleed hors du padding du panneau BaseDialog (1.5rem) ── */
.victory-banner {
  position: relative;
  height: 170px;
  margin: -1.5rem -1.5rem 0;
  border-radius: 14px 14px 0 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at 30% 60%, rgba(234, 179, 8, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 30%, rgba(34, 197, 94, 0.1) 0%, transparent 55%),
    linear-gradient(160deg, #fff7e0 0%, #fdf3d8 50%, #fff9ea 100%);
}

/* Particules */
.banner-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #f59e0b;
  box-shadow: 0 0 6px #fbbf24;
  animation: float-particle 3s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.32s);
  left: calc(var(--i) * 9% + 2%);
  top: 40%;
}

@keyframes float-particle {
  0%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-22px) scale(1.6);
    opacity: 1;
  }
}

.banner-emblem {
  position: relative;
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 2;
}

.emblem-icon {
  font-size: 2.6rem;
  line-height: 1;
  position: relative;
  z-index: 2;
  animation: pulse-emblem 2s ease-in-out infinite;
}

@keyframes pulse-emblem {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.emblem-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(var(--color-accent-rgb), 0.5);
  box-shadow: 0 0 20px rgba(var(--color-accent-rgb), 0.2);
  animation: spin-ring 8s linear infinite;
}

@keyframes spin-ring {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.banner-text {
  z-index: 2;
  margin-left: 18px;
}

.banner-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--color-accent-ink);
  margin: 0 0 4px;
  line-height: 1;
}

.banner-subtitle {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0;
  font-style: italic;
}

/* ── Section gains ── */
.gains-section {
  margin-top: 1rem;
}

.gains-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 14px;
}

/* Ligne de gain générique */
.gain-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid;
}

.gain-gold {
  background: rgba(var(--color-accent-rgb), 0.06);
  border-color: rgba(var(--color-accent-rgb), 0.22);
}

.gain-artifact-bonus {
  background: rgba(99, 102, 241, 0.05);
  border-color: rgba(99, 102, 241, 0.18);
}

.gain-artifact {
  background: rgba(var(--rarity-epic-rgb), 0.06);
  border-color: rgba(var(--rarity-epic-rgb), 0.2);
}

.gain-artifact.rarity-legendary {
  background: rgba(var(--rarity-legendary-rgb), 0.08);
  border-color: rgba(var(--rarity-legendary-rgb), 0.35);
}

.gain-artifact.rarity-epic {
  background: rgba(var(--rarity-epic-rgb), 0.08);
  border-color: rgba(var(--rarity-epic-rgb), 0.35);
}

.gain-artifact.rarity-rare {
  background: rgba(var(--rarity-rare-rgb), 0.06);
  border-color: rgba(var(--rarity-rare-rgb), 0.25);
}

.gain-icon {
  font-size: 1.2rem;
  line-height: 1;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.gain-name {
  flex: 1;
  min-width: 0;
  font-size: 0.85rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gain-artifact-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.gain-artifact-info .gain-name {
  flex: initial;
}

.gain-value {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--color-accent-ink);
  white-space: nowrap;
}

.gain-value--artifact {
  color: var(--rarity-epic);
  font-size: 0.75rem;
  background: rgba(var(--rarity-epic-rgb), 0.12);
  border: 1px solid rgba(var(--rarity-epic-rgb), 0.3);
  border-radius: 999px;
  padding: 2px 8px;
}

.gain-value--leadership {
  color: var(--color-info);
}

/* ── Total ── */
.total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(var(--color-accent-rgb), 0.08);
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  border-radius: 8px;
  margin-top: 4px;
}

.total-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-accent-ink);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .banner-title {
    font-size: 1.4rem;
  }
}
</style>

<template>
  <Transition name="modal-pop">
    <div v-if="visible" class="modal-backdrop" @click.self="emit('close')">
      <div class="victory-modal">
        <!-- Bannière hero -->
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
          <div class="banner-fade"></div>
        </div>

        <!-- Corps -->
        <div class="modal-body">
          <!-- Section gains -->
          <div class="gains-section">
            <div class="section-label">Récompenses obtenues</div>

            <div class="gains-list">
              <!-- Or de base campagne -->
              <div class="gain-row gain-gold">
                <span class="gain-icon">🪙</span>
                <span class="gain-name">Bonus de campagne</span>
                <span class="gain-value">+{{ bonusGold }} or</span>
              </div>

              <!-- Or du nœud -->
              <div v-if="nodeRewardGold > 0" class="gain-row gain-gold">
                <span class="gain-icon">💰</span>
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
                  <span class="artifact-rarity">{{ rarityLabel(nodeRewardArtifact.rarity) }}</span>
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
              <span class="total-value">🪙 {{ totalGold }}</span>
            </div>
          </div>

          <!-- Bouton fermer -->
          <button class="btn-continue" @click="emit('close')">Continuer l'aventure →</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Artifact } from '@/stores/gameStore'

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

function rarityLabel(rarity: Artifact['rarity']): string {
  const labels: Record<Artifact['rarity'], string> = {
    common: 'Commun',
    rare: 'Rare',
    epic: 'Épique',
    legendary: 'Légendaire',
  }
  return labels[rarity]
}
</script>

<style scoped>
/* ── Backdrop ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Modal ── */
.victory-modal {
  width: 520px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  background: linear-gradient(160deg, #1a2540, #0f172a);
  border: 2px solid rgba(234, 179, 8, 0.35);
  border-radius: 20px;
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.85),
    0 0 60px rgba(234, 179, 8, 0.08);
  color: #e2e8f0;
}

/* ── Bannière ── */
.victory-banner {
  position: relative;
  height: 170px;
  border-radius: 18px 18px 0 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at 30% 60%, rgba(234, 179, 8, 0.4) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 30%, rgba(34, 197, 94, 0.2) 0%, transparent 55%),
    linear-gradient(160deg, #0f2a1a 0%, #0a1f35 50%, #1a1200 100%);
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
  background: #fde68a;
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
  border: 2px solid rgba(234, 179, 8, 0.6);
  box-shadow: 0 0 20px rgba(234, 179, 8, 0.25);
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
  color: #fde68a;
  text-shadow:
    0 0 20px rgba(234, 179, 8, 0.5),
    0 2px 12px rgba(0, 0, 0, 0.5);
  margin: 0 0 4px;
  line-height: 1;
}

.banner-subtitle {
  font-size: 0.82rem;
  color: #94a3b8;
  margin: 0;
  font-style: italic;
}

.banner-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 55px;
  background: linear-gradient(to bottom, transparent, #0f172a);
  z-index: 1;
}

/* ── Corps ── */
.modal-body {
  padding: 20px 26px 26px;
}

/* ── Section gains ── */
.gains-section {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 16px;
}

.section-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #64748b;
  margin-bottom: 12px;
}

.gains-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
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
  background: rgba(234, 179, 8, 0.08);
  border-color: rgba(234, 179, 8, 0.22);
}

.gain-artifact-bonus {
  background: rgba(99, 102, 241, 0.07);
  border-color: rgba(99, 102, 241, 0.2);
}

.gain-artifact {
  background: rgba(168, 85, 247, 0.08);
  border-color: rgba(168, 85, 247, 0.25);
}

.gain-artifact.rarity-legendary {
  background: rgba(234, 179, 8, 0.1);
  border-color: rgba(234, 179, 8, 0.4);
  box-shadow: 0 0 12px rgba(234, 179, 8, 0.1);
}

.gain-artifact.rarity-epic {
  background: rgba(168, 85, 247, 0.1);
  border-color: rgba(168, 85, 247, 0.4);
}

.gain-artifact.rarity-rare {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.3);
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
  font-size: 0.85rem;
  color: #cbd5e1;
}

.gain-artifact-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.artifact-rarity {
  font-size: 0.7rem;
  color: #94a3b8;
  font-style: italic;
}

.gain-value {
  font-size: 0.88rem;
  font-weight: 700;
  color: #fde68a;
  white-space: nowrap;
}

.gain-value--artifact {
  color: #c084fc;
  font-size: 0.75rem;
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 999px;
  padding: 2px 8px;
}

.gain-value--leadership {
  color: #67e8f9;
}

/* ── Total ── */
.total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 8px;
  margin-top: 4px;
}

.total-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #fbbf24;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.total-value {
  font-size: 1.05rem;
  font-weight: 800;
  color: #fde68a;
}

/* ── Bouton ── */
.btn-continue {
  display: block;
  width: 100%;
  margin-top: 18px;
  padding: 13px;
  background: linear-gradient(135deg, #d97706, #b45309);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.03em;
  transition: all 0.2s;
}

.btn-continue:hover {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(217, 119, 6, 0.4);
}

/* ── Transition ── */
.modal-pop-enter-active,
.modal-pop-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-pop-enter-from,
.modal-pop-leave-to {
  opacity: 0;
  transform: scale(0.88);
}
</style>

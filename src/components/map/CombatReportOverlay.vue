<template>
  <Transition name="slide-fade">
    <section v-if="report" class="combat-report-panel">
      <!-- Bannière hero victoire / défaite -->
      <div class="hero-banner" :class="report.attackerVictory ? 'banner-victory' : 'banner-defeat'">
        <div class="banner-particles">
          <span v-for="i in 8" :key="i" class="particle" :style="{ '--i': i }"></span>
        </div>
        <div class="banner-content">
          <div class="banner-emblem">
            <span class="banner-emblem-icon">{{ report.attackerVictory ? '🏆' : '💔' }}</span>
            <div class="banner-emblem-ring"></div>
          </div>
          <div class="banner-text">
            <h2 class="banner-title">{{ report.attackerVictory ? 'Victoire !' : 'Défaite' }}</h2>
            <p class="banner-subtitle">
              {{
                report.attackerVictory
                  ? 'Vos armées triomphent !'
                  : 'Vos troupes ont battu en retraite'
              }}
            </p>
          </div>
        </div>
        <div class="banner-fade-bottom"></div>
      </div>

      <div class="report-body">
        <p class="report-summary">{{ report.summary }}</p>

        <div class="report-details">
          <div class="report-side">
            <h4>{{ report.attacker.army.label }}</h4>
            <div class="report-stat">
              ⚔️ Force : {{ report.attacker.totalPowerUsed }}
              <span v-if="attackerBonusPct > 0" class="bonus-badge">+{{ attackerBonusPct }}%</span>
            </div>
            <!-- Pertes par type d'unité -->
            <div class="losses-section">
              <div class="losses-label">Pertes</div>
              <div class="unit-losses">
                <div
                  v-for="(killed, type) in report.attacker.losses.killed"
                  :key="type"
                  class="unit-loss-row"
                  :class="{ 'no-loss': killed === 0 }"
                >
                  <span class="unit-loss-icon">{{ unitIcon(String(type)) }}</span>
                  <span class="unit-loss-name">{{ type }}</span>
                  <span class="unit-loss-count" :class="{ 'count-zero': killed === 0 }">
                    {{ killed === 0 ? '—' : `-${killed}` }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Survivants -->
            <div v-if="report.attacker.losses.survivors.length > 0" class="survivors-section">
              <div class="survivors-label">Survivants</div>
              <div class="survivors-chips">
                <div
                  v-for="unit in report.attacker.losses.survivors"
                  :key="unit.type"
                  class="survivor-chip"
                >
                  <span class="chip-icon">{{ unitIcon(unit.type) }}</span>
                  <span class="chip-count">{{ unit.count }}</span>
                  <span class="chip-name">{{ unit.type }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="report-divider"></div>

          <div class="report-side">
            <h4>{{ report.defender.army.label }}</h4>
            <div class="report-stat">🛡️ Force : {{ report.defender.totalPowerUsed }}</div>
            <!-- Pertes par type d'unité -->
            <div class="losses-section">
              <div class="losses-label">Pertes</div>
              <div class="unit-losses">
                <div
                  v-for="(killed, type) in report.defender.losses.killed"
                  :key="type"
                  class="unit-loss-row"
                  :class="{ 'no-loss': killed === 0 }"
                >
                  <span class="unit-loss-icon">{{ unitIcon(String(type)) }}</span>
                  <span class="unit-loss-name">{{ type }}</span>
                  <span class="unit-loss-count" :class="{ 'count-zero': killed === 0 }">
                    {{ killed === 0 ? '—' : `-${killed}` }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Survivants -->
            <div v-if="report.defender.losses.survivors.length > 0" class="survivors-section">
              <div class="survivors-label">Survivants</div>
              <div class="survivors-chips">
                <div
                  v-for="unit in report.defender.losses.survivors"
                  :key="unit.type"
                  class="survivor-chip"
                >
                  <span class="chip-icon">{{ unitIcon(unit.type) }}</span>
                  <span class="chip-count">{{ unit.count }}</span>
                  <span class="chip-name">{{ unit.type }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section butin (uniquement si victoire avec pillage) -->
        <div v-if="report.pillage && lootTotal > 0" class="report-loot">
          <h4 class="loot-title">💰 Butin récupéré</h4>
          <div class="loot-resources">
            <span v-if="report.pillage.loot.gold > 0" class="loot-item">
              🪙 <strong>{{ report.pillage.loot.gold }}</strong>
            </span>
            <span v-if="report.pillage.loot.wood > 0" class="loot-item">
              🪵 <strong>{{ report.pillage.loot.wood }}</strong>
            </span>
            <span v-if="report.pillage.loot.iron > 0" class="loot-item">
              ⚙️ <strong>{{ report.pillage.loot.iron }}</strong>
            </span>
            <span v-if="report.pillage.loot.crop > 0" class="loot-item">
              🌾 <strong>{{ report.pillage.loot.crop }}</strong>
            </span>
          </div>
          <div class="loot-meta">
            <span class="loot-capacity">🎒 Capacité : {{ report.pillage.carryCapacity }}</span>
            <span v-if="report.pillage.wasCapacityLimited" class="loot-warning"
              >⚠️ Limité par la capacité</span
            >
            <span v-if="report.pillage.wasRecentlyPillaged" class="loot-warning"
              >⚠️ Pillé récemment (−50%)</span
            >
          </div>
        </div>
        <div
          v-else-if="report.attackerVictory && report.pillage"
          class="report-loot report-loot--empty"
        >
          <span>🏜️ Village vide — aucune ressource à piller</span>
        </div>

        <button class="report-close-btn" @click="emit('close')">Fermer</button>
      </div>
    </section>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CombatReport } from '../../combat/types'

const props = defineProps<{ report: CombatReport | null }>()
const emit = defineEmits<{ close: [] }>()

/** % de bonus d'attaque apporté par les modificateurs artefacts */
const attackerBonusPct = computed(() => {
  if (!props.report) return 0
  const army = props.report.attacker.army
  const rawPower = army.units.reduce((s, u) => s + u.attack * u.count, 0)
  if (rawPower === 0) return 0
  const bonus = props.report.attacker.totalPowerUsed - rawPower
  return bonus > 0 ? Math.round((bonus / rawPower) * 100) : 0
})

/** Icône selon le type d'unité */
function unitIcon(type: string): string {
  const icons: Record<string, string> = {
    infantry: '🗡️',
    archer: '🏹',
    cavalry: '🐎',
    siege: '🏰',
    mage: '🔮',
    scout: '🦅',
  }
  return icons[type.toLowerCase()] ?? '⚔️'
}

/** Total des ressources pillées (pour masquer la section si rien) */
const lootTotal = computed(() => {
  const p = props.report?.pillage?.loot
  if (!p) return 0
  return p.gold + p.wood + p.iron + p.crop
})
</script>

<style scoped>
.combat-report-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(160deg, #1a2540, #0f172a);
  border: 2px solid #334155;
  border-radius: 20px;
  padding: 0;
  width: 680px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 1100;
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.8),
    0 0 60px rgba(59, 130, 246, 0.08);
  color: #e2e8f0;
}

/* ── Bannière hero ── */
.hero-banner {
  position: relative;
  height: 180px;
  border-radius: 18px 18px 0 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-victory {
  background:
    radial-gradient(ellipse at 30% 60%, rgba(234, 179, 8, 0.35) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 30%, rgba(34, 197, 94, 0.25) 0%, transparent 55%),
    linear-gradient(160deg, #0f2a1a 0%, #0a1f35 50%, #1a1200 100%);
}

.banner-defeat {
  background:
    radial-gradient(ellipse at 30% 60%, rgba(239, 68, 68, 0.35) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 30%, rgba(120, 20, 20, 0.4) 0%, transparent 55%),
    linear-gradient(160deg, #1f0a0a 0%, #1a0f0f 50%, #0d0d0d 100%);
}

/* Particules décoratives animées */
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
  animation: float-particle 3s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.4s);
  left: calc(var(--i) * 12% + 2%);
  top: 30%;
}

.banner-victory .particle {
  background: #fde68a;
  box-shadow: 0 0 6px #fbbf24;
}

.banner-defeat .particle {
  background: #fca5a5;
  box-shadow: 0 0 6px #ef4444;
}

@keyframes float-particle {
  0%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translateY(-20px) scale(1.5);
    opacity: 1;
  }
}

.banner-content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 20px;
}

.banner-emblem {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  flex-shrink: 0;
}

.banner-emblem-icon {
  font-size: 2.8rem;
  line-height: 1;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 0 12px currentColor);
  animation: pulse-emblem 2s ease-in-out infinite;
}

@keyframes pulse-emblem {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

.banner-emblem-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid;
  animation: spin-ring 8s linear infinite;
}

.banner-victory .banner-emblem-ring {
  border-color: rgba(234, 179, 8, 0.5);
  box-shadow: 0 0 20px rgba(234, 179, 8, 0.2);
}

.banner-defeat .banner-emblem-ring {
  border-color: rgba(239, 68, 68, 0.5);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
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
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 1px;
  margin: 0;
  line-height: 1;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}

.banner-victory .banner-title {
  color: #fde68a;
  text-shadow:
    0 0 20px rgba(234, 179, 8, 0.4),
    0 2px 12px rgba(0, 0, 0, 0.5);
}

.banner-defeat .banner-title {
  color: #fca5a5;
  text-shadow:
    0 0 20px rgba(239, 68, 68, 0.4),
    0 2px 12px rgba(0, 0, 0, 0.5);
}

.banner-subtitle {
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0;
  font-style: italic;
}

.banner-fade-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to bottom, transparent, #0f172a);
  z-index: 1;
}

/* ── Corps du rapport ── */
.report-body {
  padding: 20px 28px 24px;
}

.report-icon {
  font-size: 1.8rem;
}

.report-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.report-header.victory .report-title {
  color: #4ade80;
}

.report-header.defeat .report-title {
  color: #f87171;
}

.report-summary {
  text-align: center;
  font-size: 0.9rem;
  color: #94a3b8;
  margin-bottom: 20px;
  line-height: 1.5;
}

.report-details {
  display: flex;
  gap: 16px;
  align-items: stretch;
}

.report-side {
  flex: 1;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 14px;
}

.report-side h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #cbd5e1;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #334155;
}

.report-stat {
  font-size: 0.82rem;
  color: #93c5fd;
  margin-bottom: 8px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bonus-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.15);
  border: 1px solid rgba(74, 222, 128, 0.35);
  border-radius: 999px;
  padding: 0 6px;
  line-height: 1.6;
}

/* ── Pertes visuelles ── */
.losses-section {
  margin-top: 10px;
}

.losses-label,
.survivors-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 6px;
}

.unit-losses {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.unit-loss-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  transition: background 0.15s;
}

.unit-loss-row.no-loss {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.06);
  opacity: 0.5;
}

.unit-loss-icon {
  font-size: 0.9rem;
  line-height: 1;
  flex-shrink: 0;
}

.unit-loss-name {
  font-size: 0.78rem;
  color: #cbd5e1;
  flex: 1;
  text-transform: capitalize;
}

.unit-loss-count {
  font-size: 0.8rem;
  font-weight: 700;
  color: #f87171;
  background: rgba(239, 68, 68, 0.15);
  border-radius: 4px;
  padding: 1px 6px;
  min-width: 28px;
  text-align: center;
}

.unit-loss-count.count-zero {
  color: #475569;
  background: transparent;
}

/* ── Survivants ── */
.survivors-section {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #334155;
}

.survivors-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.survivor-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 999px;
  color: #4ade80;
}

.chip-icon {
  font-size: 0.8rem;
  line-height: 1;
}

.chip-count {
  font-size: 0.82rem;
  font-weight: 700;
  color: #86efac;
}

.chip-name {
  font-size: 0.75rem;
  color: #4ade80;
  text-transform: capitalize;
}

.report-divider {
  width: 2px;
  background: linear-gradient(to bottom, transparent, #475569, transparent);
  flex-shrink: 0;
}

.report-close-btn {
  display: block;
  width: 100%;
  margin-top: 20px;
  padding: 10px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.report-close-btn:hover {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translate(-50%, -50%) scale(0.95);
  opacity: 0;
}

/* ── Section butin ── */
.report-loot {
  margin-top: 16px;
  background: rgba(234, 179, 8, 0.07);
  border: 1px solid rgba(234, 179, 8, 0.25);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-loot--empty {
  text-align: center;
  font-size: 0.84em;
  color: #78716c;
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.06);
}

.loot-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #fbbf24;
  margin: 0;
}

.loot-resources {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.loot-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.95rem;
  color: #e2e8f0;
}

.loot-item strong {
  color: #fde68a;
  font-size: 1.05em;
}

.loot-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.76rem;
  color: #94a3b8;
}

.loot-capacity {
  color: #7dd3fc;
}

.loot-warning {
  color: #fb923c;
  font-weight: 600;
}
</style>

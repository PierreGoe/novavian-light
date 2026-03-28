<template>
  <Transition name="slide-fade">
    <section v-if="report" class="combat-report-panel">
      <div class="report-header" :class="report.attackerVictory ? 'victory' : 'defeat'">
        <span class="report-icon">{{ report.attackerVictory ? '🏆' : '💔' }}</span>
        <span class="report-title">{{ report.attackerVictory ? 'Victoire !' : 'Défaite' }}</span>
      </div>

      <p class="report-summary">{{ report.summary }}</p>

      <div class="report-details">
        <div class="report-side">
          <h4>{{ report.attacker.army.label }}</h4>
          <div class="report-stat">
            ⚔️ Force : {{ report.attacker.totalPowerUsed }}
            <span v-if="attackerBonusPct > 0" class="bonus-badge">+{{ attackerBonusPct }}%</span>
          </div>
          <div
            v-for="(killed, type) in report.attacker.losses.killed"
            :key="type"
            class="report-loss"
          >
            {{ type }} : -{{ killed }} tué(s)
          </div>
          <div v-if="report.attacker.losses.survivors.length > 0" class="report-survivors">
            Survivants :
            {{ report.attacker.losses.survivors.map((u) => `${u.count} ${u.type}`).join(', ') }}
          </div>
        </div>

        <div class="report-divider"></div>

        <div class="report-side">
          <h4>{{ report.defender.army.label }}</h4>
          <div class="report-stat">🛡️ Force : {{ report.defender.totalPowerUsed }}</div>
          <div
            v-for="(killed, type) in report.defender.losses.killed"
            :key="type"
            class="report-loss"
          >
            {{ type }} : -{{ killed }} tué(s)
          </div>
          <div v-if="report.defender.losses.survivors.length > 0" class="report-survivors">
            Survivants :
            {{ report.defender.losses.survivors.map((u) => `${u.count} ${u.type}`).join(', ') }}
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
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 2px solid #334155;
  border-radius: 16px;
  padding: 28px 32px;
  width: 420px;
  max-width: 90vw;
  z-index: 1100;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.7),
    0 0 40px rgba(59, 130, 246, 0.1);
  color: #e2e8f0;
}

.report-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  margin-bottom: 16px;
}

.report-header.victory {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1));
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.report-header.defeat {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1));
  border: 1px solid rgba(239, 68, 68, 0.4);
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

.report-loss {
  font-size: 0.8rem;
  color: #f87171;
  margin-bottom: 4px;
}

.report-survivors {
  font-size: 0.8rem;
  color: #4ade80;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #334155;
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

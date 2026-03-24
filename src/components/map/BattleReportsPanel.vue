<template>
  <section class="reports-panel">
    <button class="reports-toggle" @click="showReportsPanel = !showReportsPanel">
      📜 Rapports ({{ missionStore.battleReports.value.length }})
      <span v-if="missionStore.unreadReportsCount.value > 0" class="unread-badge">
        {{ missionStore.unreadReportsCount.value }}
      </span>
    </button>

    <div v-if="showReportsPanel" class="reports-list">
      <div v-if="missionStore.battleReports.value.length === 0" class="reports-empty">
        Aucun rapport de bataille
      </div>
      <div
        v-for="report in missionStore.battleReports.value"
        :key="report.id"
        class="report-entry"
        :class="[
          report.attackerVictory ? 'entry-victory' : 'entry-defeat',
          { 'entry-unread': !report.read },
        ]"
        @click="handleViewReport(report)"
      >
        <span class="report-entry-icon">{{ report.attackerVictory ? '🏆' : '💔' }}</span>
        <div class="report-entry-info">
          <span class="report-entry-name">
            <span v-if="!report.read" class="new-dot"></span>
            {{ report.tileName }}
          </span>
          <span class="report-entry-date">{{ formatReportDate(report.date) }}</span>
        </div>
        <button
          class="report-delete-btn"
          title="Supprimer"
          @click.stop="missionStore.deleteBattleReport(report.id)"
        >
          ✕
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMissionStore } from '../../stores/missionStore'
import type { SavedBattleReport } from '../../combat/types'

const emit = defineEmits<{ viewReport: [report: SavedBattleReport] }>()

const missionStore = useMissionStore()
const showReportsPanel = ref(false)

const formatReportDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleViewReport = (report: SavedBattleReport) => {
  missionStore.markReportRead(report.id)
  showReportsPanel.value = false
  emit('viewReport', report)
}
</script>

<style scoped>
.reports-panel {
  margin-top: 12px;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 1px solid #334155;
  border-radius: 10px;
  overflow: hidden;
}

.reports-toggle {
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.reports-toggle:hover {
  color: #e2e8f0;
  background: rgba(51, 65, 85, 0.4);
}

.reports-list {
  max-height: 260px;
  overflow-y: auto;
  border-top: 1px solid #334155;
}

.reports-empty {
  font-size: 0.82rem;
  color: #475569;
  text-align: center;
  padding: 14px;
  font-style: italic;
}

.report-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid rgba(51, 65, 85, 0.4);
}

.report-entry:last-child {
  border-bottom: none;
}

.report-entry:hover {
  background: rgba(51, 65, 85, 0.5);
}

.report-entry-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.report-entry-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.report-entry-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-victory .report-entry-name {
  color: #4ade80;
}

.entry-defeat .report-entry-name {
  color: #f87171;
}

.report-entry-date {
  font-size: 0.72rem;
  color: #64748b;
}

.entry-unread {
  background: rgba(59, 130, 246, 0.08);
}

.new-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3b82f6;
  margin-right: 5px;
  vertical-align: middle;
}

.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ef4444;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  margin-left: 8px;
}

.report-delete-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.report-delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
</style>

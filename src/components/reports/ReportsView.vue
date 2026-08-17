<template>
  <div class="reports-view">
    <header class="reports-header">
      <div class="header-title">
        <h1>📜 Rapports de combat</h1>
        <p class="header-subtitle">
          {{ totalCount }} rapport{{ totalCount !== 1 ? 's' : '' }}
          <template v-if="unreadCount > 0"> · {{ unreadCount }} non lu{{ unreadCount !== 1 ? 's' : '' }}</template>
        </p>
      </div>
      <div class="header-actions">
        <button class="action-btn" :disabled="unreadCount === 0" @click="markAllRead">
          ✓ Tout marquer comme lu
        </button>
        <button class="action-btn action-btn--danger" :disabled="totalCount === 0" @click="requestDeleteAll">
          🗑️ Tout supprimer
        </button>
      </div>
    </header>

    <div class="reports-toolbar">
      <div class="filter-tabs" role="tablist">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          class="filter-tab"
          :class="{ 'filter-tab--active': filter === f.key }"
          role="tab"
          :aria-selected="filter === f.key"
          @click="filter = f.key"
        >
          {{ f.label }}
          <span class="filter-count">{{ countFor(f.key) }}</span>
        </button>
      </div>
      <input
        v-model="search"
        type="search"
        class="search-input"
        placeholder="Rechercher une cible…"
        aria-label="Rechercher un rapport par nom de cible"
      />
    </div>

    <div v-if="filteredReports.length === 0" class="reports-empty-state">
      <span class="empty-icon">🕊️</span>
      <p>{{ emptyMessage }}</p>
    </div>

    <ul v-else class="reports-list">
      <li
        v-for="report in filteredReports"
        :key="report.id"
        class="report-row"
        :class="[report.attackerVictory ? 'row-victory' : 'row-defeat', { 'row-unread': !report.read }]"
        @click="viewReport(report)"
      >
        <span class="row-icon">{{ report.attackerVictory ? '🏆' : '💔' }}</span>

        <div class="row-main">
          <div class="row-title-line">
            <span v-if="!report.read" class="unread-dot" title="Non lu"></span>
            <span class="row-title">{{ report.tileName }}</span>
            <span v-if="report.playerIsDefender" class="row-tag">Défense</span>
          </div>
          <span class="row-summary">{{ report.summary }}</span>
        </div>

        <span class="row-date">{{ formatReportDate(report.date) }}</span>

        <div class="row-actions">
          <button
            v-if="!report.read"
            class="row-btn"
            title="Marquer comme lu"
            @click.stop="missionStore.markReportRead(report.id)"
          >
            ✓
          </button>
          <button class="row-btn row-btn--danger" title="Supprimer" @click.stop="requestDelete(report.id)">
            ✕
          </button>
        </div>
      </li>
    </ul>

    <CombatReportOverlay :report="viewedReport" @close="viewedReport = null" />

    <ConfirmDialog
      v-model:open="showDeleteConfirm"
      title="Supprimer ce rapport ?"
      message="Ce rapport de combat sera définitivement supprimé."
      confirm-label="Supprimer"
      danger
      @confirm="confirmDelete"
    />

    <ConfirmDialog
      v-model:open="showBulkDeleteConfirm"
      title="Supprimer tous les rapports ?"
      :message="`${totalCount} rapport${totalCount !== 1 ? 's' : ''} seront définitivement supprimés. Cette action est irréversible.`"
      confirm-label="Tout supprimer"
      danger
      @confirm="confirmDeleteAll"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import type { SavedBattleReport } from '@/combat/types'
import CombatReportOverlay from '@/components/map/CombatReportOverlay.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const missionStore = useMissionStore()

// La page peut être ouverte directement (lien de menu, rechargement) sans que la carte
// ou la campagne n'aient été montées au préalable — recharger explicitement garantit que
// les rapports sauvegardés en localStorage sont bien reflétés dans le store.
onMounted(() => missionStore.loadMissionState())

type FilterKey = 'all' | 'unread' | 'victory' | 'defeat'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'unread', label: 'Non lus' },
  { key: 'victory', label: 'Victoires' },
  { key: 'defeat', label: 'Défaites' },
]

const filter = ref<FilterKey>('all')
const search = ref('')

const allReports = computed(() => missionStore.battleReports.value)
const totalCount = computed(() => allReports.value.length)
const unreadCount = computed(() => missionStore.unreadReportsCount.value)

const countFor = (key: FilterKey): number => {
  switch (key) {
    case 'all':
      return totalCount.value
    case 'unread':
      return unreadCount.value
    case 'victory':
      return allReports.value.filter((r) => r.attackerVictory).length
    case 'defeat':
      return allReports.value.filter((r) => !r.attackerVictory).length
  }
}

const filteredReports = computed(() => {
  let list = allReports.value
  if (filter.value === 'unread') list = list.filter((r) => !r.read)
  else if (filter.value === 'victory') list = list.filter((r) => r.attackerVictory)
  else if (filter.value === 'defeat') list = list.filter((r) => !r.attackerVictory)

  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((r) => r.tileName.toLowerCase().includes(q))

  return list
})

const emptyMessage = computed(() =>
  totalCount.value === 0
    ? 'Aucun rapport de bataille pour le moment. Partez à la conquête !'
    : 'Aucun rapport ne correspond à ce filtre.',
)

// --- Consultation d'un rapport ---
const viewedReport = ref<SavedBattleReport | null>(null)
const viewReport = (report: SavedBattleReport) => {
  missionStore.markReportRead(report.id)
  viewedReport.value = report
}

// --- Actions groupées ---
const markAllRead = () => missionStore.markAllReportsRead()

const showBulkDeleteConfirm = ref(false)
const requestDeleteAll = () => {
  showBulkDeleteConfirm.value = true
}
const confirmDeleteAll = () => missionStore.deleteAllBattleReports()

// --- Suppression individuelle ---
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref<string | null>(null)
const requestDelete = (id: string) => {
  pendingDeleteId.value = id
  showDeleteConfirm.value = true
}
const confirmDelete = () => {
  if (pendingDeleteId.value) missionStore.deleteBattleReport(pendingDeleteId.value)
  pendingDeleteId.value = null
}

const formatReportDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.reports-view {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

/* ── En-tête ── */
.reports-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.header-title h1 {
  font-size: 1.5rem;
  margin: 0 0 4px;
  color: #e2e8f0;
}

.header-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #334155;
  background: rgba(51, 65, 85, 0.4);
  color: #cbd5e1;
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #93c5fd;
}

.action-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
  color: #f87171;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Barre d'outils : filtres + recherche ── */
.reports-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.filter-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #334155;
  background: rgba(30, 41, 59, 0.6);
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-tab:hover {
  color: #e2e8f0;
  border-color: #475569;
}

.filter-tab--active {
  background: rgba(59, 130, 246, 0.18);
  border-color: #3b82f6;
  color: #93c5fd;
}

.filter-count {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  min-width: 18px;
  text-align: center;
}

.search-input {
  flex: 1;
  min-width: 180px;
  max-width: 260px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: rgba(15, 23, 42, 0.6);
  color: #e2e8f0;
  font-size: 0.85rem;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

/* ── État vide ── */
.reports-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 20px;
  color: #64748b;
  font-style: italic;
  text-align: center;
}

.empty-icon {
  font-size: 2.2rem;
  opacity: 0.7;
}

/* ── Liste des rapports ── */
.reports-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.report-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 1px solid #334155;
  cursor: pointer;
  transition: all 0.15s;
}

.report-row:hover {
  border-color: #475569;
  background: rgba(51, 65, 85, 0.5);
}

.row-unread {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.35);
}

.row-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-title-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.row-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-victory .row-title {
  color: #4ade80;
}

.row-defeat .row-title {
  color: #f87171;
}

.row-tag {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #94a3b8;
  flex-shrink: 0;
}

.row-summary {
  font-size: 0.78rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3b82f6;
  flex-shrink: 0;
}

.row-date {
  font-size: 0.75rem;
  color: #64748b;
  flex-shrink: 0;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.row-btn {
  width: 26px;
  height: 26px;
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

.row-btn:hover {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.row-btn--danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

@media (max-width: 640px) {
  .reports-view {
    padding: 14px;
  }

  .row-summary,
  .row-date {
    display: none;
  }
}
</style>

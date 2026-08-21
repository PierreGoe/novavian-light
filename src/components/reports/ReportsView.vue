<template>
  <div class="reports-view">
    <header class="reports-header">
      <div class="header-title">
        <h1>📜 Rapports de combat</h1>
        <p class="header-subtitle">
          {{ totalCount }} rapport{{ totalCount !== 1 ? 's' : '' }}
          <template v-if="unreadCount > 0">
            · {{ unreadCount }} non lu{{ unreadCount !== 1 ? 's' : '' }}</template
          >
        </p>
      </div>
      <div class="header-actions">
        <Button variant="secondary" size="sm" :disabled="unreadCount === 0" @click="markAllRead">
          ✓ Tout marquer comme lu
        </Button>
        <Button variant="danger" size="sm" :disabled="totalCount === 0" @click="requestDeleteAll">
          🗑️ Tout supprimer
        </Button>
      </div>
    </header>

    <div class="reports-toolbar">
      <FilterTabs
        :items="FILTERS.map((f) => ({ ...f, count: countFor(f.key) }))"
        :model-value="filter"
        @update:model-value="filter = $event as FilterKey"
      />
      <SearchInput
        v-model="search"
        placeholder="Rechercher une cible ou un résumé…"
        class="reports-search"
      />
    </div>

    <EmptyState v-if="filteredReports.length === 0" :message="emptyMessage" icon="🕊️" />

    <ul v-else class="reports-list">
      <li v-for="report in filteredReports" :key="report.id">
        <ListRow
          class="report-row"
          :class="[
            report.attackerVictory ? 'row-victory' : 'row-defeat',
            { 'row-unread': !report.read },
          ]"
          @click="viewReport(report)"
        >
          <template #icon>{{ report.attackerVictory ? '🏆' : '💔' }}</template>

          <div class="row-main-wrap">
            <div class="row-main">
              <div class="row-title-line">
                <span v-if="!report.read" class="unread-dot" title="Non lu"></span>
                <span class="row-title">{{ report.tileName }}</span>
                <span v-if="reportCoords(report)" class="row-coords">{{
                  reportCoords(report)
                }}</span>
                <span v-if="report.playerIsDefender" class="row-tag">Défense</span>
              </div>
              <span class="row-summary">{{ report.summary }}</span>
            </div>
            <span class="row-date">{{ formatReportDate(report.date) }}</span>
          </div>

          <template #actions>
            <button
              v-if="reportTile(report)"
              class="row-btn"
              title="Voir sur la carte"
              @click.stop="viewOnMap(report)"
            >
              🗺️
            </button>
            <button
              v-if="!report.read"
              class="row-btn"
              title="Marquer comme lu"
              @click.stop="missionStore.markReportRead(report.id)"
            >
              ✓
            </button>
            <button
              class="row-btn row-btn--danger"
              title="Supprimer"
              @click.stop="requestDelete(report.id)"
            >
              ✕
            </button>
          </template>
        </ListRow>
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
import { useRouter } from 'vue-router'
import { useMissionStore } from '@/stores/missionStore'
import { useMapStore } from '@/stores/mapStore'
import type { SavedBattleReport } from '@/combat/types'
import CombatReportOverlay from '@/components/map/CombatReportOverlay.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import Button from '@/components/ui/Button.vue'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ListRow from '@/components/ui/ListRow.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const missionStore = useMissionStore()
const mapStore = useMapStore()
const router = useRouter()

// La page peut être ouverte directement (lien de menu, rechargement) sans que la carte
// ou la campagne n'aient été montées au préalable — recharger explicitement garantit que
// les rapports sauvegardés en localStorage sont bien reflétés dans le store.
onMounted(() => {
  missionStore.loadMissionState()
  // Idem pour la carte (nécessaire pour localiser les combats) — sans écraser
  // un état déjà chargé par la campagne.
  if (mapStore.mapState.mapTiles.length === 0) mapStore.loadMapState()
})

// --- Localisation du combat sur la carte ---
// La tuile peut ne plus exister (village rasé, carte régénérée) : dans ce cas,
// ni coordonnées ni action « Voir sur la carte ».
const reportTile = (report: SavedBattleReport) => mapStore.getTileById(report.tileId)

const reportCoords = (report: SavedBattleReport): string | null => {
  const tile = reportTile(report)
  return tile ? `(${tile.position.x}, ${tile.position.y})` : null
}

/** Ouvre la fiche de la tuile du combat sur la carte de campagne */
const viewOnMap = (report: SavedBattleReport) => {
  mapStore.selectTile(report.tileId)
  router.push({ name: 'campaign-map' })
}

type FilterKey = 'all' | 'unread' | 'victory' | 'defeat'

const FILTERS: { key: FilterKey; value: FilterKey; label: string }[] = [
  { key: 'all', value: 'all', label: 'Tous' },
  { key: 'unread', value: 'unread', label: 'Non lus' },
  { key: 'victory', value: 'victory', label: 'Victoires' },
  { key: 'defeat', value: 'defeat', label: 'Défaites' },
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
  if (q)
    list = list.filter(
      (r) => r.tileName.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q),
    )

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
  color: var(--color-text);
}

.header-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-faint);
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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

.reports-search {
  flex: 1;
  min-width: 180px;
  max-width: 260px;
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
  border-radius: 10px;
  border: 1px solid rgba(var(--overlay-rgb), 0.12);
  cursor: pointer;
}

.report-row.row-unread {
  background: rgba(var(--color-accent-rgb), 0.05);
  border-color: rgba(var(--color-accent-rgb), 0.3);
}

.row-main-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-victory .row-title {
  color: var(--color-success-strong);
}

.row-defeat .row-title {
  color: var(--color-danger-light);
}

.row-coords {
  font-size: 0.72rem;
  color: var(--color-text-faint);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.row-tag {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--overlay-rgb), 0.08);
  border: 1px solid rgba(var(--overlay-rgb), 0.2);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.row-summary {
  font-size: 0.78rem;
  color: var(--color-text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-accent);
  flex-shrink: 0;
}

.row-date {
  font-size: 0.75rem;
  color: var(--color-text-faint);
  flex-shrink: 0;
  white-space: nowrap;
}

/* Custom volontaire : bouton icône seule (✓/✕) sans padding ni fond de base —
   aucun variant `Button` ne couvre ce format minimal (cf. `.detail-close`,
   `.deactivate-btn` ailleurs dans l'app). */
.row-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-faint);
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.row-btn:hover {
  background: rgba(var(--color-success-strong-rgb), 0.15);
  color: var(--color-success-strong);
}

.row-btn--danger:hover {
  background: rgba(var(--color-danger-rgb), 0.15);
  color: var(--color-danger);
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

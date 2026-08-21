<template>
  <div class="score-view">
    <!-- Modal de victoire de campagne -->
    <CampaignVictoryModal
      :visible="showVictoryModal"
      :node-title="completedNodeTitle"
      :bonus-gold="CAMPAIGN_BONUS_GOLD"
      :node-reward-gold="pendingNodeRewardGold"
      :node-reward-artifact="pendingNodeRewardArtifact"
      :artifact-bonuses="pendingArtifactBonuses"
      @close="onModalClose"
      @go-inventory="onModalGoInventory"
    />
    <ConfirmDialog
      v-model:open="showCompleteConfirm"
      title="Terminer la campagne ?"
      message="Cette action est définitive : les récompenses seront distribuées et tu retourneras à la carte des missions."
      confirm-label="Valider et terminer"
      danger
      @confirm="proceedComplete"
    />
    <!-- Header -->
    <header class="score-header">
      <Button variant="secondary" size="sm" @click="goBack">← Retour à la campagne</Button>
      <h1>⚔️ Points de Victoire</h1>
    </header>

    <!-- Bannière de victoire -->
    <Transition name="banner-fade">
      <div v-if="objectiveReached && !continuing" class="victory-banner">
        <div class="victory-glow" />
        <div class="victory-content">
          <h2>🏆 Objectif de campagne atteint !</h2>
          <p>
            Tu as atteint les <strong>{{ COMBAT_VP_GOAL }} PV Combat</strong> requis pour remporter
            cette campagne. Valide pour empocher tes récompenses et rentrer sur la carte des
            missions, ou continue à jouer librement.
          </p>
          <div class="victory-rewards">
            <Badge v-if="currentNodeReward?.reward?.type === 'relic'" tone="epic">
              💎 Relique {{ currentNodeReward.type === 'elite' ? 'rare' : 'commune' }} garantie
            </Badge>
            <Badge v-else-if="currentNodeReward?.reward?.type === 'gold'" tone="accent">
              💰 +{{ currentNodeReward.reward.amount }} or (récompense du node)
            </Badge>
            <Badge tone="accent">🏆 Node de mission validé</Badge>
            <Badge tone="accent">📜 Accès à la prochaine mission</Badge>
          </div>
          <div class="victory-actions">
            <Button
              :disabled="completing"
              :title="completing ? 'Distribution des récompenses en cours' : undefined"
              @click="handleComplete"
            >
              {{ completing ? '⏳ Validation…' : '🏁 Valider et terminer la campagne' }}
            </Button>
            <Button v-if="!continuing" variant="secondary" @click="continuing = true">
              ⚔️ Continuer quand même
            </Button>
            <span v-else class="continuing-note">
              Mode libre activé — reviens ici quand tu veux terminer.
            </span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Bouton "Terminer" persistant si le joueur a choisi de continuer -->
    <div v-if="objectiveReached && continuing" class="finish-bar">
      <span>🏆 Objectif atteint — tu joues en mode libre</span>
      <Button
        size="sm"
        :disabled="completing"
        :title="completing ? 'Distribution des récompenses en cours' : undefined"
        @click="handleComplete"
      >
        {{ completing ? '⏳ Validation…' : '🏁 Terminer la campagne' }}
      </Button>
    </div>

    <!-- Grille des catégories -->
    <section class="score-grid">
      <!-- Combat -->
      <!--
        score-card-header volontairement custom, pas de SectionHeader : le sous-titre
        s'affiche SOUS le titre ici, alors que le slot par défaut de SectionHeader
        s'affiche à côté du titre — mise en page incompatible.
      -->
      <StateCard :state="combatDone ? 'done' : 'neutral'">
        <div class="score-card-header">
          <span class="score-card-icon">⚔️</span>
          <div>
            <h3>Combat</h3>
            <p class="score-card-subtitle">Victoires, destructions, missions</p>
          </div>
          <span class="score-card-total" :class="{ 'total--done': combatDone }">
            {{ totalCombatVP }} PV
          </span>
        </div>

        <div class="score-bar-wrap">
          <ProgressBar
            class="score-bar"
            tone="danger"
            :value="(totalCombatVP / COMBAT_VP_GOAL) * 100"
            :done="combatDone"
          />
          <span class="score-bar-label">{{ totalCombatVP }} / {{ COMBAT_VP_GOAL }}</span>
        </div>

        <ul class="score-sources">
          <li class="src-capped">
            <span class="src-icon">⚔️</span>
            <span class="src-label"
              >Victoire en combat
              <em class="src-cap"
                >({{ victoryPointsDetail.combatVictoryVp }}/{{ COMBAT_VICTORY_VP_CAP }} PV du
                plafond déjà obtenus)</em
              ></span
            >
            <span class="src-pts">+1 PV</span>
          </li>
          <li class="src-capped">
            <span class="src-icon">🏚️</span>
            <span class="src-label"
              >Village ennemi détruit
              <em class="src-cap"
                >({{ victoryPointsDetail.villageVp }}/{{ VILLAGE_VP_CAP }} PV du plafond déjà
                obtenus)</em
              ></span
            >
            <span class="src-pts">+2 PV</span>
          </li>
          <li>
            <span class="src-icon">🏰</span>
            <span class="src-label">Forteresse détruite</span>
            <span class="src-pts">+4 PV</span>
          </li>
          <li>
            <span class="src-icon">🎯</span>
            <span class="src-label">Mission complétée (facile)</span>
            <span class="src-pts">+2 PV</span>
          </li>
          <li>
            <span class="src-icon">🎯</span>
            <span class="src-label">Mission complétée (moyenne)</span>
            <span class="src-pts">+4 PV</span>
          </li>
          <li>
            <span class="src-icon">🎯</span>
            <span class="src-label">Mission complétée (difficile)</span>
            <span class="src-pts">+7 PV</span>
          </li>
          <li>
            <span class="src-icon">🎯</span>
            <span class="src-label">Mission complétée (élite)</span>
            <span class="src-pts">+12 PV</span>
          </li>
        </ul>
      </StateCard>

      <!-- Futures catégories (placeholder) -->
      <StateCard state="locked">
        <div class="score-card-header">
          <span class="score-card-icon">🔬</span>
          <div>
            <h3>Science</h3>
            <p class="score-card-subtitle">Recherches, ruines, découvertes</p>
          </div>
          <span class="score-card-total locked-label">Bientôt</span>
        </div>
        <EmptyState message="Cette catégorie sera disponible dans une prochaine version." />
      </StateCard>

      <StateCard state="locked">
        <div class="score-card-header">
          <span class="score-card-icon">🪙</span>
          <div>
            <h3>Commerce</h3>
            <p class="score-card-subtitle">Échanges, marchands, richesses</p>
          </div>
          <span class="score-card-total locked-label">Bientôt</span>
        </div>
        <EmptyState message="Cette catégorie sera disponible dans une prochaine version." />
      </StateCard>
    </section>

    <!-- Historique complet -->
    <section class="history-section">
      <h2>📜 Historique des gains</h2>

      <EmptyState
        v-if="history.length === 0"
        message="Aucun point de victoire encore gagné. Lance-toi dans la bataille !"
      />

      <DataTable v-else :headers="['Type', 'Action', 'Date', 'PV']">
        <tr
          v-for="event in history"
          :key="event.id"
          :class="{ 'hist-row--link': eventTile(event) }"
          :title="eventTile(event) ? 'Voir la case sur la carte' : undefined"
          @click="viewEventOnMap(event)"
        >
          <td>
            <span class="hist-icon" role="img" :aria-label="getTypeLabel(event.type)">{{
              getTypeIcon(event.type)
            }}</span>
          </td>
          <td class="hist-reason">{{ event.reason }}</td>
          <td class="hist-date" :title="formatDateFull(event.date)">
            {{ formatDate(event.date) }}
          </td>
          <td class="hist-pts">+{{ event.amount }}</td>
        </tr>
      </DataTable>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  useGameStore,
  COMBAT_VP_GOAL,
  VILLAGE_VP_CAP,
  COMBAT_VICTORY_VP_CAP,
} from '@/stores/gameStore'
import type { VictoryPointType, VictoryEvent, Artifact } from '@/stores/gameStore'
import { useMapStore } from '@/stores/mapStore'
import CampaignVictoryModal from './CampaignVictoryModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StateCard from '@/components/ui/StateCard.vue'
import DataTable from '@/components/ui/DataTable.vue'

const CAMPAIGN_BONUS_GOLD = 100

const router = useRouter()
const gameStore = useGameStore()
const mapStore = useMapStore()

// La vue est hors de CampaignLayout : charger la carte si nécessaire pour
// pouvoir localiser les gains de PV liés à une tuile (sans écraser un état chargé).
onMounted(() => {
  if (mapStore.mapState.mapTiles.length === 0) mapStore.loadMapState()
})

const continuing = ref(false)

// État de la modal de victoire
const showVictoryModal = ref(false)
const pendingNodeRewardGold = ref(0)
const pendingNodeRewardArtifact = ref<Artifact | null>(null)
const completedNodeTitle = ref('')

interface ArtifactBonus {
  id: string
  name: string
  icon: string
  goldBonus: number
  leadershipBonus: number
}
const pendingArtifactBonuses = ref<ArtifactBonus[]>([])

const totalCombatVP = computed(() => gameStore.victoryPoints.value.combat)
const victoryPointsDetail = computed(() => gameStore.victoryPoints.value)
const objectiveReached = computed(() => gameStore.campaignObjectiveReached.value)
const combatDone = computed(() => totalCombatVP.value >= COMBAT_VP_GOAL)
const history = computed(() => gameStore.victoryHistory.value)

// --- Localisation d'un gain de PV sur la carte ---
// tileId est un champ optionnel récent de VictoryEvent : les anciens événements
// persistés n'en ont pas — accès défensif via un cast local.
const eventTile = (event: VictoryEvent) => {
  const tileId = (event as { tileId?: string }).tileId
  return tileId ? mapStore.getTileById(tileId) : undefined
}

const viewEventOnMap = (event: VictoryEvent) => {
  const tile = eventTile(event)
  if (!tile) return
  mapStore.selectTile(tile.id)
  router.push({ name: 'campaign-map' })
}

// Récompense promise par le node actuel
const currentNodeReward = computed(() => {
  const nodeId = gameStore.gameState.mapState.selectedNodeId
  if (!nodeId) return null
  for (const layer of gameStore.gameState.mapState.layers) {
    const node = layer.nodes.find((n) => n.id === nodeId)
    if (node) return { type: node.type, reward: node.reward }
  }
  return null
})

function goBack() {
  router.push('/campaign')
}

const completing = ref(false)
const showCompleteConfirm = ref(false)

function handleComplete() {
  if (completing.value) return
  showCompleteConfirm.value = true
}

function proceedComplete() {
  completing.value = true

  // Calculer les bonus artefacts actifs AVANT completeCampaign (qui les consomme)
  const equippedArtifacts = gameStore.gameState.inventory.artifacts.filter((a) =>
    gameStore.gameState.inventory.activeArtifacts.includes(a.id),
  )
  const bonuses: ArtifactBonus[] = []
  for (const artifact of equippedArtifacts) {
    const sp = artifact.specialPower
    if (!sp) continue
    if (sp.type === 'gold_on_victory' || sp.type === 'leadership_on_victory') {
      bonuses.push({
        id: artifact.id,
        name: artifact.name,
        icon: artifact.icon,
        goldBonus: sp.type === 'gold_on_victory' ? sp.value : 0,
        leadershipBonus: sp.type === 'leadership_on_victory' ? sp.value : 0,
      })
    }
  }
  pendingArtifactBonuses.value = bonuses

  // Récupérer le titre du node courant
  const nodeId = gameStore.gameState.mapState.selectedNodeId
  let nodeTitle = 'Node de mission complété'
  if (nodeId) {
    for (const layer of gameStore.gameState.mapState.layers) {
      const node = layer.nodes.find((n) => n.id === nodeId)
      if (node) {
        nodeTitle = node.title
        break
      }
    }
  }
  completedNodeTitle.value = nodeTitle

  // Exécuter la completion (récompenses distribuées ici)
  const { nodeRewardArtifact, nodeRewardGold } = gameStore.completeCampaign(CAMPAIGN_BONUS_GOLD)
  pendingNodeRewardGold.value = nodeRewardGold
  pendingNodeRewardArtifact.value = nodeRewardArtifact

  // Afficher la modal
  showVictoryModal.value = true
}

function onModalClose() {
  showVictoryModal.value = false
  completing.value = false
  router.push('/mission-tree')
}

// Variante « voir la relique » : même fermeture, mais direction l'inventaire
function onModalGoInventory() {
  showVictoryModal.value = false
  completing.value = false
  router.push({ name: 'inventory' })
}

function getTypeIcon(type: VictoryPointType): string {
  return type === 'combat' ? '⚔️' : '🏆'
}

function getTypeLabel(type: VictoryPointType): string {
  return type === 'combat' ? 'Victoire de combat' : 'Autre'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Date complète (avec année et secondes) — affichée au survol de la colonne Date */
function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<style scoped>
/* ── Layout global ── */
.score-view {
  min-height: 100vh;
  background: var(--gradient-canvas);
  color: var(--color-text);
  padding-bottom: 4rem;
}

/* ── Header ── */
.score-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.2rem 2rem;
  background: rgba(var(--color-white-rgb), 0.7);
  border-bottom: 1px solid rgba(var(--color-accent-rgb), 0.25);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
}
.score-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--color-accent-ink);
}
/* ── Bannière victoire ── */
.victory-banner {
  position: relative;
  margin: 1.5rem 2rem;
  padding: 1.75rem 2rem;
  background: linear-gradient(
    135deg,
    rgba(var(--color-accent-rgb), 0.14),
    rgba(184, 134, 11, 0.16)
  );
  border: 1px solid rgba(var(--color-accent-rgb), 0.45);
  border-radius: 16px;
  overflow: hidden;
}
.victory-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at top left,
    rgba(var(--color-accent-rgb), 0.1) 0%,
    transparent 60%
  );
  pointer-events: none;
}
.victory-content {
  position: relative;
}
.victory-banner h2 {
  margin: 0 0 0.6rem;
  font-size: 1.4rem;
  color: var(--color-accent-ink);
}
.victory-banner p {
  margin: 0 0 1rem;
  font-size: 0.92rem;
  color: var(--color-text);
  line-height: 1.6;
  max-width: 640px;
}

.victory-rewards {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.victory-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.continuing-note {
  font-size: 0.82rem;
  color: var(--color-text-faint);
  font-style: italic;
}

/* ── Barre "mode libre" ── */
.finish-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 2rem 0.5rem;
  padding: 0.75rem 1.25rem;
  background: rgba(var(--color-accent-rgb), 0.1);
  border: 1px solid rgba(var(--color-accent-rgb), 0.25);
  border-radius: 10px;
  font-size: 0.88rem;
  color: var(--color-accent-ink);
}

/* ── Grille catégories ── */
.score-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
  padding: 1.5rem 2rem;
}

.score-card-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.score-card-icon {
  font-size: 1.8rem;
  flex-shrink: 0;
}
.score-card-header > div {
  flex: 1;
}
.score-card-header h3 {
  margin: 0 0 0.15rem;
  font-size: 1.05rem;
  color: var(--color-text);
}
.score-card-subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-faint);
}
.score-card-total {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-accent-ink);
  flex-shrink: 0;
}
.total--done {
  color: var(--color-success-strong);
}
.locked-label {
  font-size: 0.75rem;
  color: var(--color-text-disabled);
  font-style: italic;
}

/* ── Barre de progression ── */
.score-bar-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.score-bar {
  flex: 1;
}
.score-bar-label {
  font-size: 0.75rem;
  color: var(--color-text-faint);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Sources de PV ── */
.score-sources {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
}
.score-sources li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.7rem;
  font-size: 0.83rem;
  color: var(--color-text-muted);
  background: rgba(var(--overlay-rgb), 0.04);
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.06);
}
.score-sources li:last-child {
  border-bottom: none;
}
.src-icon {
  flex-shrink: 0;
  font-size: 0.9rem;
}
.src-label {
  flex: 1;
}
.src-pts {
  font-weight: 700;
  color: var(--color-accent-ink);
  flex-shrink: 0;
}
/* Ligne avec plafond : texte légèrement atténué pour signaler la contrainte */
.src-capped {
  opacity: 0.85;
}
.src-cap {
  font-style: italic;
  font-size: 0.75em;
  color: var(--color-text-faint);
  font-weight: 400;
}

/* ── Historique ── */
.history-section {
  padding: 0 2rem;
}
.history-section h2 {
  font-size: 1.15rem;
  color: var(--color-accent-ink);
  margin: 0 0 1rem;
}
.hist-icon {
  font-size: 1rem;
}
.hist-reason {
  color: var(--color-text-muted);
}
.hist-date {
  color: var(--color-text-disabled);
  font-size: 0.78rem;
}
.hist-pts {
  font-weight: 700;
  color: var(--color-danger);
  text-align: right;
}

/* Ligne d'historique localisable sur la carte */
.hist-row--link {
  cursor: pointer;
}

.hist-row--link:hover td {
  background: rgba(var(--color-accent-rgb), 0.06);
}

/* ── Animations ── */
.banner-fade-enter-active,
.banner-fade-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}
.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .score-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
  }

  .victory-banner,
  .finish-bar {
    margin-left: 1rem;
    margin-right: 1rem;
  }

  .score-grid,
  .history-section {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .finish-bar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

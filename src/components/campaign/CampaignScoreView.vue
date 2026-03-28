<template>
  <div class="score-view">
    <!-- Header -->
    <header class="score-header">
      <button class="btn-back" @click="goBack">← Retour à la campagne</button>
      <h1>⚔️ Points de Victoire</h1>
    </header>

    <!-- Bannière de victoire -->
    <Transition name="banner-fade">
      <div v-if="objectiveReached" class="victory-banner">
        <div class="victory-glow" />
        <div class="victory-content">
          <h2>🏆 Objectif de campagne atteint !</h2>
          <p>
            Tu as atteint les <strong>{{ COMBAT_VP_GOAL }} PV Combat</strong> requis pour remporter
            cette campagne. Valide pour empocher tes récompenses et rentrer sur la carte des
            missions, ou continue à jouer librement.
          </p>
          <div class="victory-rewards">
            <div
              v-if="currentNodeReward?.reward?.type === 'relic'"
              class="reward-chip reward-chip--relic"
            >
              💎 Relique {{ currentNodeReward.type === 'elite' ? 'rare' : 'commune' }} garantie
            </div>
            <div v-else-if="currentNodeReward?.reward?.type === 'gold'" class="reward-chip">
              💰 +{{ currentNodeReward.reward.amount }} or (récompense du node)
            </div>
            <div class="reward-chip">🏆 Node de mission validé</div>
            <div class="reward-chip">📜 Accès à la prochaine mission</div>
          </div>
          <div class="victory-actions">
            <button class="btn-primary" @click="handleComplete">
              🏁 Valider et terminer la campagne
            </button>
            <button v-if="!continuing" class="btn-secondary" @click="continuing = true">
              ⚔️ Continuer quand même
            </button>
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
      <button class="btn-primary btn-sm" @click="handleComplete">🏁 Terminer la campagne</button>
    </div>

    <!-- Grille des catégories -->
    <section class="score-grid">
      <!-- Combat -->
      <div class="score-card" :class="{ 'score-card--done': combatDone }">
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
          <div class="score-bar">
            <div
              class="score-bar-fill"
              :class="{ 'fill--done': combatDone }"
              :style="{ width: `${Math.min((totalCombatVP / COMBAT_VP_GOAL) * 100, 100)}%` }"
            />
          </div>
          <span class="score-bar-label">{{ totalCombatVP }} / {{ COMBAT_VP_GOAL }}</span>
        </div>

        <ul class="score-sources">
          <li>
            <span class="src-icon">⚔️</span>
            <span class="src-label">Victoire en combat</span>
            <span class="src-pts">+1 PV</span>
          </li>
          <li>
            <span class="src-icon">🏚️</span>
            <span class="src-label">Village ennemi détruit</span>
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
      </div>

      <!-- Futures catégories (placeholder) -->
      <div class="score-card score-card--locked">
        <div class="score-card-header">
          <span class="score-card-icon">🔬</span>
          <div>
            <h3>Science</h3>
            <p class="score-card-subtitle">Recherches, ruines, découvertes</p>
          </div>
          <span class="score-card-total locked-label">Bientôt</span>
        </div>
        <div class="score-locked-msg">
          Cette catégorie sera disponible dans une prochaine version.
        </div>
      </div>

      <div class="score-card score-card--locked">
        <div class="score-card-header">
          <span class="score-card-icon">🪙</span>
          <div>
            <h3>Commerce</h3>
            <p class="score-card-subtitle">Échanges, marchands, richesses</p>
          </div>
          <span class="score-card-total locked-label">Bientôt</span>
        </div>
        <div class="score-locked-msg">
          Cette catégorie sera disponible dans une prochaine version.
        </div>
      </div>
    </section>

    <!-- Historique complet -->
    <section class="history-section">
      <h2>📜 Historique des gains</h2>

      <div v-if="history.length === 0" class="history-empty">
        Aucun point de victoire encore gagné. Lance-toi dans la bataille !
      </div>

      <table v-else class="history-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Action</th>
            <th>Date</th>
            <th>PV</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in history" :key="event.id">
            <td>
              <span class="hist-icon">{{ getTypeIcon(event.type) }}</span>
            </td>
            <td class="hist-reason">{{ event.reason }}</td>
            <td class="hist-date">{{ formatDate(event.date) }}</td>
            <td class="hist-pts">+{{ event.amount }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore, COMBAT_VP_GOAL } from '@/stores/gameStore'
import type { VictoryPointType } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'

const CAMPAIGN_BONUS_GOLD = 100

const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()

const continuing = ref(false)

const totalCombatVP = computed(() => gameStore.victoryPoints.value.combat)
const objectiveReached = computed(() => gameStore.campaignObjectiveReached.value)
const combatDone = computed(() => totalCombatVP.value >= COMBAT_VP_GOAL)
const history = computed(() => gameStore.victoryHistory.value)

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

function handleComplete() {
  const { nodeRewardArtifact, nodeRewardGold } = gameStore.completeCampaign(CAMPAIGN_BONUS_GOLD)
  if (nodeRewardArtifact) {
    toastStore.showSuccess(
      `🏆 Récompense : ${nodeRewardArtifact.name} (relique ${nodeRewardArtifact.rarity}) ajoutée à votre inventaire !`,
      { duration: 7000 },
    )
  } else if (nodeRewardGold > 0) {
    toastStore.showSuccess(`💰 Récompense : +${nodeRewardGold} or !`, { duration: 4000 })
  }
  router.push('/mission-tree')
}

function getTypeIcon(type: VictoryPointType): string {
  return type === 'combat' ? '⚔️' : '🏆'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
/* ── Layout global ── */
.score-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #2c1810 0%, #1a0f08 100%);
  color: #f4e4bc;
  padding-bottom: 4rem;
}

/* ── Header ── */
.score-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.2rem 2rem;
  background: rgba(0, 0, 0, 0.35);
  border-bottom: 1px solid rgba(218, 165, 32, 0.25);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
}
.score-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #daa520;
}
.btn-back {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #c9a96e;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.88rem;
  transition: background 0.15s;
  white-space: nowrap;
}
.btn-back:hover {
  background: rgba(255, 255, 255, 0.13);
}

/* ── Bannière victoire ── */
.victory-banner {
  position: relative;
  margin: 1.5rem 2rem;
  padding: 1.75rem 2rem;
  background: linear-gradient(135deg, rgba(218, 165, 32, 0.14), rgba(139, 69, 19, 0.3));
  border: 1px solid rgba(218, 165, 32, 0.45);
  border-radius: 16px;
  overflow: hidden;
}
.victory-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at top left, rgba(218, 165, 32, 0.12) 0%, transparent 60%);
  pointer-events: none;
}
.victory-content {
  position: relative;
}
.victory-banner h2 {
  margin: 0 0 0.6rem;
  font-size: 1.4rem;
  color: #daa520;
}
.victory-banner p {
  margin: 0 0 1rem;
  font-size: 0.92rem;
  color: #f4e4bc;
  line-height: 1.6;
  max-width: 640px;
}

.victory-rewards {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.reward-chip {
  font-size: 0.85rem;
  padding: 0.35rem 0.85rem;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(218, 165, 32, 0.35);
  border-radius: 20px;
  color: #daa520;
}

.reward-chip--relic {
  border-color: rgba(139, 92, 246, 0.5);
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
  font-weight: 600;
}

.victory-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.continuing-note {
  font-size: 0.82rem;
  color: #888;
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
  background: rgba(218, 165, 32, 0.1);
  border: 1px solid rgba(218, 165, 32, 0.25);
  border-radius: 10px;
  font-size: 0.88rem;
  color: #daa520;
}

/* ── Boutons ── */
.btn-primary {
  padding: 0.65rem 1.4rem;
  background: linear-gradient(135deg, #daa520, #b8860b);
  color: #1a0f08;
  border: none;
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    opacity 0.15s,
    transform 0.1s;
  white-space: nowrap;
}
.btn-primary:hover {
  opacity: 0.88;
}
.btn-primary:active {
  transform: scale(0.98);
}
.btn-sm {
  padding: 0.4rem 0.9rem;
  font-size: 0.8rem;
}

.btn-secondary {
  padding: 0.65rem 1.2rem;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #c9a96e;
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.13);
}

/* ── Grille catégories ── */
.score-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
  padding: 1.5rem 2rem;
}

.score-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(218, 165, 32, 0.18);
  border-radius: 14px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.score-card--done {
  border-color: rgba(218, 165, 32, 0.5);
  background: rgba(218, 165, 32, 0.06);
}
.score-card--locked {
  opacity: 0.55;
  border-style: dashed;
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
  color: #f4e4bc;
}
.score-card-subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: #888;
}
.score-card-total {
  font-size: 1.2rem;
  font-weight: 700;
  color: #daa520;
  flex-shrink: 0;
}
.total--done {
  color: #22c55e;
}
.locked-label {
  font-size: 0.75rem;
  color: #666;
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
  height: 10px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 5px;
  overflow: hidden;
}
.score-bar-fill {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, #ef4444, #dc2626);
  transition: width 0.5s ease;
}
.score-bar-fill.fill--done {
  background: linear-gradient(90deg, #22c55e, #16a34a);
}
.score-bar-label {
  font-size: 0.75rem;
  color: #888;
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
  color: #c9a96e;
  background: rgba(0, 0, 0, 0.15);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
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
  color: #daa520;
  flex-shrink: 0;
}

.score-locked-msg {
  font-size: 0.82rem;
  color: #555;
  font-style: italic;
  text-align: center;
  padding: 0.5rem;
}

/* ── Historique ── */
.history-section {
  padding: 0 2rem;
}
.history-section h2 {
  font-size: 1.15rem;
  color: #daa520;
  margin: 0 0 1rem;
}
.history-empty {
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
  padding: 1rem 0;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.history-table thead tr {
  border-bottom: 1px solid rgba(218, 165, 32, 0.25);
}
.history-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.72rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.history-table tbody tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.1s;
}
.history-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}
.history-table td {
  padding: 0.5rem 0.75rem;
}
.hist-icon {
  font-size: 1rem;
}
.hist-reason {
  color: #c9a96e;
}
.hist-date {
  color: #666;
  font-size: 0.78rem;
}
.hist-pts {
  font-weight: 700;
  color: #ef4444;
  text-align: right;
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
</style>

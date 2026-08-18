<template>
  <div class="settings-view">
    <header class="settings-header">
      <h1>⚙️ Paramètres</h1>
      <p class="settings-subtitle">Configuration du jeu — sauvegardée automatiquement</p>
    </header>

    <div class="settings-body">
      <!-- ── Vitesse & moteur ─────────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">🎮 Vitesse & Moteur</h2>

        <SettingRow>
          <template #label>Vitesse du jeu</template>
          <template #description>Multiplicateur global de vitesse (déplacements)</template>
          <RangeSlider
            v-model="settings.gameSpeedMultiplier"
            :min="1"
            :max="10"
            :step="1"
            :format-value="formatSpeed"
          />
        </SettingRow>
      </section>

      <!-- ── Carte & exploration ───────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">🗺️ Carte & Exploration</h2>

        <SettingRow>
          <template #label>Brouillard de guerre</template>
          <template #description>Masque les zones non explorées</template>
          <ToggleSwitch v-model="fogEnabled" label="Brouillard de guerre" />
        </SettingRow>

        <SettingRow>
          <template #label>Zones d'influence ennemies</template>
          <template #description>Affiche le halo rouge autour des forteresses ennemies</template>
          <ToggleSwitch v-model="settings.showInfluenceZones" label="Zones d'influence ennemies" />
        </SettingRow>

        <SettingRow>
          <template #label>Rayon de révélation initial</template>
          <template #description>Zone visible au démarrage (distance de Chebyshev)</template>
          <RangeSlider
            v-model="settings.rankRevealRange"
            :min="2"
            :max="25"
            :step="1"
            :format-value="formatCases"
          />
        </SettingRow>
      </section>

      <!-- ── Difficulté ennemis ───────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">⚔️ Difficulté des Ennemis</h2>

        <SettingRow>
          <template #label>Infanterie d'un village ennemi</template>
          <template #description>Nombre de base de soldats dans les villages</template>
          <RangeSlider v-model="settings.enemyBaseInfantry" :min="1" :max="20" :step="1" />
        </SettingRow>

        <SettingRow>
          <template #label>Garnison d'une forteresse</template>
          <template #description>Nombre de base de soldats dans les forteresses</template>
          <RangeSlider v-model="settings.enemyStrongholdInfantry" :min="2" :max="30" :step="1" />
        </SettingRow>
      </section>

      <!-- ── Ressources initiales ──────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">📦 Ressources de départ</h2>
        <p class="section-note">Quantité disponible au début de chaque nouvelle mission.</p>

        <SettingRow v-for="res in INITIAL_RESOURCES" :key="res.key">
          <template #label>{{ res.icon }} {{ res.label }}</template>
          <RangeSlider
            v-model="settings.initialResources[res.key]"
            :min="res.min"
            :max="res.max"
            :step="res.step"
          />
        </SettingRow>
      </section>

      <!-- ── Debug / Triche ───────────────────────────────── -->
      <!-- Bloc volontairement mis à l'écart visuellement : ce ne sont pas des options de
           jeu normales, mais des triches réservées au debug/dev (pas destinées au joueur). -->
      <div class="debug-zone">
        <div class="debug-zone-label">🔧 Mode Debug (dev uniquement)</div>
        <section class="settings-section settings-section--debug">
          <h2 class="section-title">🛠️ Options de Débogage</h2>
          <p class="debug-warning">
            ⚠️ Triches réservées aux tests internes — affectent les prochaines missions.
          </p>

          <SettingRow>
            <template #label>Ressources de départ</template>
            <template #description>Démarre chaque mission avec 10 000 de chaque ressource</template>
            <ToggleSwitch v-model="settings.cheatResources" label="Ressources de départ (triche)" />
          </SettingRow>

          <SettingRow>
            <template #label>Points de victoire de départ</template>
            <template #description>Démarre chaque mission avec 1 000 points de victoire</template>
            <ToggleSwitch
              v-model="settings.cheatVictoryPoints"
              label="Points de victoire de départ (triche)"
            />
          </SettingRow>

          <SettingRow>
            <template #label>Garnison de départ (100 fantassins)</template>
            <template #description
              >Démarre chaque mission avec 100 fantassins au lieu de la garnison normale</template
            >
            <ToggleSwitch
              v-model="settings.cheatStartingGarrison"
              label="Garnison de départ (triche)"
            />
          </SettingRow>
        </section>
      </div>

      <!-- ── Réinitialiser ────────────────────────────────── -->
      <div class="settings-footer">
        <Button variant="ghost" size="sm" @click="confirmReset">
          ↺ Réinitialiser les paramètres
        </Button>
        <span class="saved-hint">✓ Paramètres sauvegardés automatiquement</span>
      </div>
    </div>

    <ConfirmDialog
      v-model:open="showResetConfirm"
      title="Réinitialiser les paramètres ?"
      message="Tous les réglages reviendront à leurs valeurs par défaut."
      confirm-label="Réinitialiser"
      danger
      @confirm="doReset"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameSettings, resetGameSettings } from '@/stores/gameSettingsStore'
import { useToastStore } from '@/stores/toastStore'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import Button from '@/components/ui/Button.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import RangeSlider from '@/components/ui/RangeSlider.vue'
import SettingRow from '@/components/ui/SettingRow.vue'

const settings = gameSettings
const toastStore = useToastStore()

const INITIAL_RESOURCES = [
  { key: 'wood' as const, icon: '🪵', label: 'Bois', min: 0, max: 2000, step: 50 },
  { key: 'clay' as const, icon: '🧱', label: 'Argile', min: 0, max: 2000, step: 50 },
  { key: 'iron' as const, icon: '⚒️', label: 'Fer', min: 0, max: 2000, step: 50 },
  { key: 'crop' as const, icon: '🌾', label: 'Céréales', min: 0, max: 2000, step: 50 },
]

// Inverse de disableFogOfWar pour un toggle plus intuitif ("Brouillard actif")
const fogEnabled = computed({
  get: () => !settings.disableFogOfWar,
  set: (v: boolean) => {
    settings.disableFogOfWar = !v
  },
})

// Aux bornes, un libellé descriptif est plus clair qu'un simple multiplicateur —
// utilisé à la fois pour la valeur courante (si elle atteint une borne) et pour
// les libellés min/max de RangeSlider.
const formatSpeed = (v: number): string => {
  if (v === 1) return 'Normale'
  if (v === 10) return 'Rapide'
  return `×${v}`
}

const formatCases = (v: number): string => `${v} cases`

const showResetConfirm = ref(false)
const confirmReset = () => {
  showResetConfirm.value = true
}
const doReset = () => {
  resetGameSettings()
  toastStore.showSuccess('Paramètres réinitialisés', { duration: 2000 })
}
</script>

<style scoped>
.settings-view {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  min-height: 100vh;
}

/* ---- En-tête ---- */
.settings-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(var(--color-accent-rgb), 0.2);
}

.settings-header h1 {
  margin: 0 0 0.35rem;
  color: var(--color-accent-ink);
  font-size: 1.6rem;
  font-weight: 700;
}

.settings-subtitle {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-faint);
}

/* ---- Sections ---- */
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  border: 1px solid rgba(var(--overlay-rgb), 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.section-title {
  margin: 0;
  padding: 0.65rem 1rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-faint);
  background: rgba(var(--overlay-rgb), 0.03);
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.06);
}

.settings-section :deep(.setting-row) {
  padding-left: 1rem;
  padding-right: 1rem;
}

/* ---- Zone debug : séparée visuellement du reste des paramètres ---- */
.debug-zone {
  margin-top: 0.5rem;
  padding: 0.9rem 0.9rem 0.75rem;
  border: 1px dashed rgba(var(--color-warning-rgb), 0.35);
  border-radius: 14px;
  background: repeating-linear-gradient(
    135deg,
    rgba(var(--color-warning-rgb), 0.035),
    rgba(var(--color-warning-rgb), 0.035) 10px,
    rgba(var(--color-warning-rgb), 0.06) 10px,
    rgba(var(--color-warning-rgb), 0.06) 20px
  );
}

.debug-zone-label {
  margin: 0 0 0.6rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-warning);
}

.settings-section--debug {
  border-color: rgba(var(--color-warning-rgb), 0.3);
  background: rgba(var(--color-warning-rgb), 0.03);
}

.settings-section--debug .section-title {
  color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), 0.08);
  border-bottom-color: rgba(var(--color-warning-rgb), 0.15);
}

.section-note {
  margin: 0;
  padding: 0.4rem 1rem;
  font-size: 0.72rem;
  color: var(--color-text-faint);
  background: rgba(var(--overlay-rgb), 0.02);
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.05);
}

.debug-warning {
  margin: 0;
  padding: 0.45rem 1rem;
  font-size: 0.75rem;
  color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), 0.06);
  border-bottom: 1px solid rgba(var(--color-warning-rgb), 0.1);
}

/* ---- Footer ---- */
.settings-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  gap: 1rem;
  flex-wrap: wrap;
}

.saved-hint {
  font-size: 0.72rem;
  color: var(--color-text-faint);
}
</style>

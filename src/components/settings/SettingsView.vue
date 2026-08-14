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

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Vitesse du jeu</span>
            <span class="setting-desc">Multiplicateur global de vitesse (déplacements)</span>
          </div>
          <div class="setting-control">
            <div class="range-wrap">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                v-model.number="settings.gameSpeedMultiplier"
                class="range-input"
              />
              <span class="range-value">×{{ settings.gameSpeedMultiplier }}</span>
            </div>
            <div class="range-labels"><span>Normale</span><span>Rapide</span></div>
          </div>
        </div>
      </section>

      <!-- ── Carte & exploration ───────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">🗺️ Carte & Exploration</h2>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Brouillard de guerre</span>
            <span class="setting-desc">Masque les zones non explorées</span>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="fogEnabled" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Zones d'influence ennemies</span>
            <span class="setting-desc">Affiche le halo rouge autour des forteresses ennemies</span>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.showInfluenceZones" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Rayon de révélation initial</span>
            <span class="setting-desc">Zone visible au démarrage (distance de Chebyshev)</span>
          </div>
          <div class="setting-control">
            <div class="range-wrap">
              <input
                type="range"
                min="2"
                max="25"
                step="1"
                v-model.number="settings.rankRevealRange"
                class="range-input"
              />
              <span class="range-value">{{ settings.rankRevealRange }} cases</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Difficulté ennemis ───────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">⚔️ Difficulté des Ennemis</h2>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Infanterie d'un village ennemi</span>
            <span class="setting-desc">Nombre de base de soldats dans les villages</span>
          </div>
          <div class="setting-control">
            <div class="range-wrap">
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                v-model.number="settings.enemyBaseInfantry"
                class="range-input"
              />
              <span class="range-value">{{ settings.enemyBaseInfantry }}</span>
            </div>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Garnison d'une forteresse</span>
            <span class="setting-desc">Nombre de base de soldats dans les forteresses</span>
          </div>
          <div class="setting-control">
            <div class="range-wrap">
              <input
                type="range"
                min="2"
                max="30"
                step="1"
                v-model.number="settings.enemyStrongholdInfantry"
                class="range-input"
              />
              <span class="range-value">{{ settings.enemyStrongholdInfantry }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Ressources initiales ──────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">📦 Ressources de départ</h2>
        <p class="section-note">Quantité disponible au début de chaque nouvelle mission.</p>

        <div v-for="res in INITIAL_RESOURCES" :key="res.key" class="setting-row">
          <div class="setting-info">
            <span class="setting-label">{{ res.icon }} {{ res.label }}</span>
          </div>
          <div class="setting-control">
            <div class="range-wrap">
              <input
                type="range"
                :min="res.min"
                :max="res.max"
                :step="res.step"
                v-model.number="settings.initialResources[res.key]"
                class="range-input"
              />
              <span class="range-value">{{ settings.initialResources[res.key] }}</span>
            </div>
          </div>
        </div>
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

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Ressources de départ</span>
              <span class="setting-desc"
                >Démarre chaque mission avec 10 000 de chaque ressource</span
              >
            </div>
            <label class="toggle">
              <input type="checkbox" v-model="settings.cheatResources" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Points de victoire de départ</span>
              <span class="setting-desc">Démarre chaque mission avec 1 000 points de victoire</span>
            </div>
            <label class="toggle">
              <input type="checkbox" v-model="settings.cheatVictoryPoints" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Garnison de départ (100 fantassins)</span>
              <span class="setting-desc"
                >Démarre chaque mission avec 100 fantassins au lieu de la garnison normale</span
              >
            </div>
            <label class="toggle">
              <input type="checkbox" v-model="settings.cheatStartingGarrison" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </section>
      </div>

      <!-- ── Réinitialiser ────────────────────────────────── -->
      <div class="settings-footer">
        <button class="btn-reset" @click="confirmReset">↺ Réinitialiser les paramètres</button>
        <span class="saved-hint">✓ Paramètres sauvegardés automatiquement</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { gameSettings, resetGameSettings } from '@/stores/gameSettingsStore'
import { useToastStore } from '@/stores/toastStore'

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

const confirmReset = () => {
  if (confirm('Réinitialiser tous les paramètres aux valeurs par défaut ?')) {
    resetGameSettings()
    toastStore.showSuccess('Paramètres réinitialisés', { duration: 2000 })
  }
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
  border-bottom: 1px solid rgba(218, 165, 32, 0.2);
}

.settings-header h1 {
  margin: 0 0 0.35rem;
  color: #daa520;
  font-size: 1.6rem;
  font-weight: 700;
}

.settings-subtitle {
  margin: 0;
  font-size: 0.82rem;
  color: #4b5563;
}

/* ---- Sections ---- */
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  border: 1px solid rgba(255, 255, 255, 0.06);
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
  color: #6b7280;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

/* ---- Zone debug : séparée visuellement du reste des paramètres ---- */
.debug-zone {
  margin-top: 0.5rem;
  padding: 0.9rem 0.9rem 0.75rem;
  border: 1px dashed rgba(245, 158, 11, 0.35);
  border-radius: 14px;
  background: repeating-linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.035),
    rgba(245, 158, 11, 0.035) 10px,
    rgba(245, 158, 11, 0.06) 10px,
    rgba(245, 158, 11, 0.06) 20px
  );
}

.debug-zone-label {
  margin: 0 0 0.6rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #f59e0b;
}

.settings-section--debug {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(17, 17, 17, 0.35);
}

.settings-section--debug .section-title {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
  border-bottom-color: rgba(245, 158, 11, 0.15);
}

.section-note {
  margin: 0;
  padding: 0.4rem 1rem;
  font-size: 0.72rem;
  color: #4b5563;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.debug-warning {
  margin: 0;
  padding: 0.45rem 1rem;
  font-size: 0.75rem;
  color: #92400e;
  background: rgba(245, 158, 11, 0.06);
  border-bottom: 1px solid rgba(245, 158, 11, 0.1);
}

/* ---- Ligne de paramètre ---- */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s;
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #e2e8f0;
}

.setting-desc {
  font-size: 0.72rem;
  color: #4b5563;
  line-height: 1.3;
}

/* ---- Slider ---- */
.setting-control {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 180px;
}

.range-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.range-input {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #daa520;
  cursor: pointer;
  transition: transform 0.15s;
}

.range-input::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.range-value {
  font-size: 0.78rem;
  font-weight: 700;
  color: #daa520;
  min-width: 48px;
  text-align: right;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.62rem;
  color: #374151;
}

/* ---- Toggle switch ---- */
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  cursor: pointer;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: background 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #6b7280;
  top: 2px;
  left: 2px;
  transition:
    transform 0.2s,
    background 0.2s;
}

.toggle input:checked + .toggle-slider {
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.5);
}

.toggle input:checked + .toggle-slider::before {
  background: #4ade80;
  transform: translateX(18px);
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

.btn-reset {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #6b7280;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.saved-hint {
  font-size: 0.72rem;
  color: #374151;
}
</style>

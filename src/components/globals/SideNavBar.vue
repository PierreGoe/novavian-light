<template>
  <!-- =========================================================
       Sidebar desktop (masquée sur mobile)
       ========================================================= -->
  <nav
    v-if="!isFullscreenRoute"
    class="side-nav"
    :class="{ 'side-nav--collapsed': isCollapsed }"
    role="navigation"
    aria-label="Navigation principale"
  >
    <!-- Bouton toggle collapse / expand -->
    <button
      class="nav-toggle"
      @click="toggleCollapsed"
      :title="isCollapsed ? 'Déployer le menu' : 'Réduire le menu'"
      :aria-expanded="!isCollapsed"
    >
      <span class="toggle-icon">{{ isCollapsed ? '›' : '‹' }}</span>
    </button>

    <!-- Logo -->
    <router-link to="/mission-tree" class="nav-logo" title="Accueil">
      <span class="logo-icon">⚔️</span>
      <Transition name="fade-text">
        <span v-if="!isCollapsed" class="logo-text">MiniTravian</span>
      </Transition>
    </router-link>

    <!-- Liens de navigation -->
    <div class="nav-links">
      <router-link
        v-for="link in visibleNavLinks"
        :key="link.to"
        :to="link.to"
        class="nav-link"
        :title="isCollapsed ? link.label : ''"
        active-class="nav-link--active"
      >
        <span class="nav-icon">{{ link.icon }}</span>
        <Transition name="fade-text">
          <span v-if="!isCollapsed" class="nav-label">{{ link.label }}</span>
        </Transition>
      </router-link>
    </div>

    <!-- Séparateur -->
    <div class="nav-divider" v-if="isInGame"></div>

    <!-- Stats joueur (visibles uniquement en jeu) -->
    <div class="nav-stats" v-if="isInGame">
      <!-- Or -->
      <div class="stat-item stat-gold" :title="isCollapsed ? `${formatNumber(gold)} Or` : ''">
        <span class="stat-icon" ref="goldIconRef">🪙</span>
        <Transition name="fade-text">
          <span v-if="!isCollapsed" class="stat-value">{{ formatNumber(gold) }}</span>
        </Transition>
      </div>

      <!-- Leadership -->
      <div
        class="stat-item stat-leadership"
        :class="`leadership-${leadershipStatus}`"
        :title="isCollapsed ? `${leadership} Leadership` : leadershipTooltip"
      >
        <span class="stat-icon" ref="leadershipIconRef">👑</span>
        <Transition name="fade-text">
          <span v-if="!isCollapsed" class="stat-value">{{ leadership }}</span>
        </Transition>
      </div>

      <!-- Race -->
      <div class="stat-item stat-race" v-if="race" :title="isCollapsed ? race.name : ''">
        <span class="stat-icon">{{ race.icon }}</span>
        <Transition name="fade-text">
          <span v-if="!isCollapsed" class="stat-value">{{ race.name }}</span>
        </Transition>
      </div>
    </div>

    <!-- Bouton menu principal (retour accueil) -->
    <button v-if="isInGame" class="nav-home-btn" @click="goHome" title="Menu principal">
      <span class="nav-icon">🏠</span>
      <Transition name="fade-text">
        <span v-if="!isCollapsed" class="nav-label">Menu principal</span>
      </Transition>
    </button>

    <!-- Chiffres flottants pour les animations or/leadership -->
    <div class="floating-numbers-container">
      <div
        v-for="floating in floatingNumbers"
        :key="floating.id"
        class="floating-number"
        :class="[floating.isPositive ? 'floating-number--positive' : 'floating-number--negative']"
      >
        {{ floating.isPositive ? '+' : '-' }}{{ floating.amount }}
        {{ floating.type === 'gold' ? '🪙' : '👑' }}
      </div>
    </div>
  </nav>

  <!-- =========================================================
       Bottom nav mobile (visible seulement sur mobile)
       ========================================================= -->
  <nav
    v-if="!isFullscreenRoute"
    class="bottom-nav"
    role="navigation"
    aria-label="Navigation mobile"
  >
    <router-link
      v-for="link in visibleNavLinks"
      :key="link.to"
      :to="link.to"
      class="bottom-nav-link"
      active-class="bottom-nav-link--active"
    >
      <span class="bottom-nav-icon">{{ link.icon }}</span>
      <span class="bottom-nav-label">{{ link.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { formatNumber } from '@/utils/formatNumber'

// ===============================================================
// Stores & router
// ===============================================================
const gameStore = useGameStore()
const route = useRoute()
const router = useRouter()

// ===============================================================
// Etat du sidebar (collapse / expand)
// ===============================================================
const STORAGE_KEY = 'sidebar-collapsed'
const isCollapsed = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'true')

const toggleCollapsed = () => {
  isCollapsed.value = !isCollapsed.value
  localStorage.setItem(STORAGE_KEY, String(isCollapsed.value))
  // Notifie App.vue pour mettre à jour la variable CSS --sidebar-width
  window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: isCollapsed.value }))
}

// ===============================================================
// Routes qui n'affichent pas la sidebar (écrans plein page)
// ===============================================================
const FULLSCREEN_ROUTES = new Set(['home', 'race-selection', 'game-over'])
const isFullscreenRoute = computed(() => FULLSCREEN_ROUTES.has(route.name as string))

// ===============================================================
// Liens de navigation
// ===============================================================
interface NavLink {
  to: string
  icon: string
  label: string
  requireGame?: boolean
}

const NAV_LINKS: NavLink[] = [
  { to: '/mission-tree', icon: '🗺️', label: 'Missions', requireGame: true },
  { to: '/campaign', icon: '⚔️', label: 'Campagne', requireGame: true },
  { to: '/inventory', icon: '🎒', label: 'Inventaire', requireGame: true },
  { to: '/bazar', icon: '🛒', label: 'Bazar Mystique', requireGame: true },
  { to: '/settings', icon: '⚙️', label: 'Paramètres' },
]

const isInGame = computed(() => gameStore.gameState.currentStatus === 'in-progress')

const visibleNavLinks = computed(() =>
  NAV_LINKS.filter((link) => !link.requireGame || isInGame.value),
)

// ===============================================================
// Données joueur
// ===============================================================
const gold = computed(() => gameStore.gameState.inventory.gold)
const leadership = computed(() => gameStore.gameState.inventory.leadership)
const race = computed(() => gameStore.gameState.race)

const leadershipStatus = computed(() => gameStore.leadershipStatus.value.level)
const leadershipTooltip = computed(() => {
  const ls = leadership.value
  const status = gameStore.leadershipStatus.value
  return `Leadership: ${ls}/200 — ${status.description}`
})


const goHome = () => {
  if (window.confirm('Retourner au menu principal ? Votre partie en cours reste sauvegardée.')) {
    router.push('/')
  }
}

// ===============================================================
// Animation des chiffres flottants
// ===============================================================
interface FloatingNumber {
  id: string
  amount: number
  type: 'gold' | 'leadership'
  isPositive: boolean
}

const floatingNumbers = ref<FloatingNumber[]>([])
let animationCounter = 0

const addFloatingNumber = (amount: number, type: 'gold' | 'leadership') => {
  if (amount === 0) return
  const floating: FloatingNumber = {
    id: `float-${++animationCounter}`,
    amount: Math.abs(amount),
    type,
    isPositive: amount > 0,
  }
  floatingNumbers.value.push(floating)
  const duration = Math.abs(amount) >= 50 ? 2500 : 2000
  setTimeout(() => {
    const idx = floatingNumbers.value.findIndex((f) => f.id === floating.id)
    if (idx > -1) floatingNumbers.value.splice(idx, 1)
  }, duration)
}

const previousGold = ref(gold.value)
const previousLeadership = ref(leadership.value)

watch(gold, (newVal) => {
  const diff = newVal - previousGold.value
  if (diff !== 0) {
    nextTick(() => addFloatingNumber(diff, 'gold'))
    previousGold.value = newVal
  }
})

watch(leadership, (newVal) => {
  const diff = newVal - previousLeadership.value
  if (diff !== 0) {
    nextTick(() => addFloatingNumber(diff, 'leadership'))
    previousLeadership.value = newVal
  }
})
</script>

<style scoped lang="scss">
// ===============================================================
// Variables
// ===============================================================
$nav-width-expanded: 220px;
$nav-width-collapsed: 64px;
$nav-bg: linear-gradient(180deg, #1a0f08 0%, #2c1810 100%);
$nav-border: rgba(218, 165, 32, 0.35);
$gold-color: #daa520;
$text-color: #f4e4bc;
$transition: 0.25s ease;
$mobile-breakpoint: 768px;

// ===============================================================
// Sidebar desktop
// ===============================================================
.side-nav {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: $nav-width-expanded;
  background: $nav-bg;
  border-right: 1px solid $nav-border;
  box-shadow: 3px 0 15px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  z-index: 200;
  overflow: hidden;
  transition: width $transition;

  // Caché sur mobile (bottom nav à la place)
  @media (max-width: $mobile-breakpoint) {
    display: none;
  }

  &--collapsed {
    width: $nav-width-collapsed;

    .nav-logo,
    .nav-link,
    .nav-home-btn,
    .stat-item {
      justify-content: center;
    }
  }
}

// Bouton collapse / expand
.nav-toggle {
  align-self: flex-end;
  margin: 0.75rem 0.5rem 0.25rem;
  width: 28px;
  height: 28px;
  border: 1px solid $nav-border;
  border-radius: 6px;
  background: rgba(218, 165, 32, 0.1);
  color: $gold-color;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  line-height: 1;
  transition:
    background $transition,
    border-color $transition;
  flex-shrink: 0;

  &:hover {
    background: rgba(218, 165, 32, 0.25);
    border-color: $gold-color;
  }

  .toggle-icon {
    display: block;
    transform: translateY(-1px);
  }
}

// Logo
.nav-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: $gold-color;
  text-decoration: none;
  font-weight: 700;
  font-size: 1rem;
  white-space: nowrap;
  transition: background $transition;
  border-radius: 0;
  overflow: hidden;

  &:hover {
    background: rgba(218, 165, 32, 0.12);
  }

  .logo-icon {
    font-size: 1.4rem;
    flex-shrink: 0;
  }

  .logo-text {
    color: $gold-color;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);
  }
}

// Liens nav
.nav-links {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.5rem;
  margin-top: 0.5rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  color: $text-color;
  text-decoration: none;
  border-radius: 8px;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  transition:
    background $transition,
    color $transition;
  border: 1px solid transparent;

  &:hover {
    background: rgba(218, 165, 32, 0.12);
    border-color: $nav-border;
    color: $gold-color;
  }

  &--active {
    background: rgba(218, 165, 32, 0.2);
    border-color: rgba(218, 165, 32, 0.5);
    color: $gold-color;
    font-weight: 600;
  }

  .nav-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
    width: 1.5rem;
    text-align: center;
  }

  .nav-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// Séparateur
.nav-divider {
  height: 1px;
  background: $nav-border;
  margin: 0.5rem 0.75rem;
}

// Stats joueur
.nav-stats {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0 0.5rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  border: 1px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  font-size: 0.85rem;

  .stat-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
    width: 1.5rem;
    text-align: center;
  }

  .stat-value {
    color: $gold-color;
    font-weight: 600;
  }
}

.stat-gold {
  background: rgba(255, 215, 0, 0.08);
  border-color: rgba(255, 215, 0, 0.2);
}

.stat-leadership {
  background: rgba(218, 165, 32, 0.08);
  border-color: rgba(218, 165, 32, 0.2);

  &.leadership-excellent {
    border-color: rgba(34, 197, 94, 0.5);
    background: rgba(34, 197, 94, 0.1);
  }
  &.leadership-good {
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(59, 130, 246, 0.08);
  }
  &.leadership-average {
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(245, 158, 11, 0.08);
  }
  &.leadership-low {
    border-color: rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.08);
  }
  &.leadership-critical {
    border-color: rgba(220, 38, 38, 0.7);
    background: rgba(220, 38, 38, 0.12);
    animation: leadershipAlert 2s infinite;
  }
}

.stat-race {
  background: rgba(218, 165, 32, 0.06);
  border-color: rgba(218, 165, 32, 0.15);
}

@keyframes leadershipAlert {
  0%,
  100% {
    border-color: rgba(220, 38, 38, 0.7);
  }
  50% {
    border-color: rgba(255, 0, 0, 1);
    box-shadow: 0 0 8px rgba(255, 0, 0, 0.4);
  }
}

// Bouton menu principal
.nav-home-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  margin: 0.5rem;
  margin-top: auto;
  color: $text-color;
  background: rgba(139, 69, 19, 0.3);
  border: 1px solid rgba(139, 69, 19, 0.5);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  transition:
    background $transition,
    border-color $transition,
    color $transition;

  &:hover {
    background: rgba(218, 165, 32, 0.2);
    border-color: $gold-color;
    color: $gold-color;
  }

  .nav-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
    width: 1.5rem;
    text-align: center;
  }

  .nav-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// Chiffres flottants
.floating-numbers-container {
  position: absolute;
  bottom: 80px;
  right: -10px;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-end;
}

.floating-number {
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: rgba(26, 15, 8, 0.9);
  border: 1px solid $nav-border;
  animation: floatUp 2s ease-out forwards;
  white-space: nowrap;

  &--positive {
    color: #22c55e;
  }
  &--negative {
    color: #ef4444;
  }
}

@keyframes floatUp {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-40px);
  }
}

// Transition du texte (fade lors du collapse)
.fade-text-enter-active,
.fade-text-leave-active {
  transition:
    opacity 0.15s ease,
    max-width 0.25s ease;
  max-width: 200px;
  overflow: hidden;
}

.fade-text-enter-from,
.fade-text-leave-to {
  opacity: 0;
  max-width: 0;
}

// ===============================================================
// Bottom nav mobile
// ===============================================================
.bottom-nav {
  display: none;

  @media (max-width: $mobile-breakpoint) {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 64px;
    background: $nav-bg;
    border-top: 1px solid $nav-border;
    box-shadow: 0 -3px 15px rgba(0, 0, 0, 0.5);
    z-index: 200;
    align-items: stretch;
    justify-content: space-around;
  }
}

.bottom-nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  flex: 1;
  color: rgba(244, 228, 188, 0.7);
  text-decoration: none;
  font-size: 0.65rem;
  transition:
    color $transition,
    background $transition;
  padding: 0.4rem 0.25rem;

  &:hover,
  &--active {
    color: $gold-color;
    background: rgba(218, 165, 32, 0.12);
  }

  .bottom-nav-icon {
    font-size: 1.4rem;
    line-height: 1;
  }

  .bottom-nav-label {
    line-height: 1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60px;
  }
}
</style>

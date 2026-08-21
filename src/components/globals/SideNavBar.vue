<template>
  <!-- =========================================================
       Sidebar desktop (masquée sur mobile)
       ========================================================= -->
  <nav
    v-if="!isFullscreenRoute"
    class="side-nav"
    :class="{ 'side-nav--collapsed': effectiveCollapsed }"
    role="navigation"
    aria-label="Navigation principale"
  >
    <!-- Bouton toggle collapse / expand — masqué sur desktop étroit (repli forcé en CSS) -->
    <NavToggleButton
      v-if="!isNarrowDesktop"
      :collapsed="isCollapsed"
      side="left"
      @toggle="toggleCollapsed"
    />

    <!-- Logo -->
    <router-link to="/mission-tree" class="nav-logo" title="Accueil">
      <span class="logo-icon">⚔️</span>
      <Transition name="fade-text">
        <span v-if="!effectiveCollapsed" class="logo-text">Novavian</span>
      </Transition>
    </router-link>

    <!-- Liens de navigation -->
    <div class="nav-links">
      <template v-for="link in visibleNavLinks" :key="link.to">
        <router-link
          :to="link.to"
          class="nav-link"
          :class="{ 'nav-link--active': isChildRouteActive(link) }"
          :title="effectiveCollapsed ? link.label : ''"
          active-class="nav-link--active"
        >
          <span class="nav-icon">
            {{ link.icon }}
            <CountBadge
              v-if="link.to === '/reports'"
              :count="unreadReportsCount"
              variant="active"
              :label="`${unreadReportsCount} rapport(s) non lu(s)`"
            />
          </span>
          <Transition name="fade-text">
            <span v-if="!effectiveCollapsed" class="nav-label">{{ link.label }}</span>
          </Transition>
        </router-link>

        <!-- Sous-menu (ex. Campagne → Carte / Village) — en mode réduit, version icône
             seule (tooltip natif pour le libellé) pour garder l'accès Carte/Village -->
        <div
          v-if="link.children"
          class="nav-submenu"
          :class="{ 'nav-submenu--collapsed': effectiveCollapsed }"
        >
          <router-link
            v-for="child in link.children"
            :key="child.to"
            :to="child.to"
            class="nav-sublink"
            :title="effectiveCollapsed ? child.label : ''"
            active-class="nav-sublink--active"
          >
            <span class="nav-icon">{{ child.icon }}</span>
            <Transition name="fade-text">
              <span v-if="!effectiveCollapsed" class="nav-label">{{ child.label }}</span>
            </Transition>
          </router-link>
        </div>
      </template>
    </div>

    <!-- Séparateur -->
    <div class="nav-divider" v-if="isInGame"></div>

    <!-- Stats joueur (visibles uniquement en jeu) -->
    <div class="nav-stats" v-if="isInGame">
      <!-- Or -->
      <div
        class="stat-item stat-gold"
        :title="`Or : ${formatNumber(gold)} — dépensable au Bazar et à la Forge`"
      >
        <span class="stat-icon" ref="goldIconRef">🪙</span>
        <Transition name="fade-text">
          <span v-if="!effectiveCollapsed" class="stat-value">{{ formatNumber(gold) }}</span>
        </Transition>
      </div>

      <!-- Leadership -->
      <div
        class="stat-item stat-leadership"
        :class="`leadership-${leadershipStatus}`"
        :title="effectiveCollapsed ? `${leadership} Leadership` : leadershipTooltip"
      >
        <span class="stat-icon" ref="leadershipIconRef">👑</span>
        <Transition name="fade-text">
          <span v-if="!effectiveCollapsed" class="stat-value">{{ leadership }}</span>
        </Transition>
      </div>

      <!-- Race -->
      <div class="stat-item stat-race" v-if="race" :title="raceTooltip">
        <span class="stat-icon">{{ race.icon }}</span>
        <Transition name="fade-text">
          <span v-if="!effectiveCollapsed" class="stat-value">{{ race.name }}</span>
        </Transition>
      </div>
    </div>

    <!--
      Bouton menu principal — volontairement custom, pas de Button : doit reprendre au
      pixel le style icône+libellé collapsible des .nav-link voisins pour rester visuellement
      dans la même famille de navigation, ce que Button (bouton d'action générique) ne fait pas.
    -->
    <button v-if="isInGame" class="nav-home-btn" @click="goHome" title="Menu principal">
      <span class="nav-icon">🏠</span>
      <Transition name="fade-text">
        <span v-if="!effectiveCollapsed" class="nav-label">Menu principal</span>
      </Transition>
    </button>

    <!--
      Chiffres flottants or/leadership — volontairement custom, pas de FloatingNumber :
      ce composant n'a pas de slot pour l'emoji suffixe (🪙/👑) ni de fond en pilule,
      les deux présents ici.
    -->
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

  <ConfirmDialog
    v-model:open="showGoHomeConfirm"
    title="Retourner au menu principal ?"
    message="Votre partie en cours reste sauvegardée."
    confirm-label="Retourner au menu"
    @confirm="doGoHome"
  />

  <!-- =========================================================
       Barre de stats compacte mobile (or/leadership + accueil),
       masquée sur desktop — au-dessus de la bottom nav
       ========================================================= -->
  <div v-if="!isFullscreenRoute && isInGame" class="bottom-stats">
    <div class="bottom-stat-item">
      <span class="bottom-stat-icon">🪙</span>
      <span class="bottom-stat-value">{{ formatNumber(gold) }}</span>
    </div>
    <div
      class="bottom-stat-item"
      :class="`leadership-${leadershipStatus}`"
      :title="leadershipTooltip"
    >
      <span class="bottom-stat-icon">👑</span>
      <span class="bottom-stat-value">{{ leadership }}</span>
    </div>
    <!-- Équivalent mobile de .nav-home-btn — même exception (cohérence avec les .bottom-stat-item voisins). -->
    <button
      class="bottom-stat-home"
      @click="goHome"
      title="Menu principal"
      aria-label="Menu principal"
    >
      🏠
    </button>
  </div>

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
      <span class="bottom-nav-icon">
        {{ link.icon }}
        <CountBadge
          v-if="link.to === '/reports'"
          :count="unreadReportsCount"
          variant="active"
          :label="`${unreadReportsCount} rapport(s) non lu(s)`"
        />
      </span>
      <span class="bottom-nav-label">{{ link.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useMissionStore } from '@/stores/missionStore'
import { STARTING_ARTIFACTS } from '@/data/artifacts'
import { formatNumber } from '@/utils/formatNumber'
import { useMediaQuery, NARROW_DESKTOP_QUERY } from '@/composables/useMediaQuery'
import NavToggleButton from '@/components/ui/NavToggleButton.vue'
import CountBadge from '@/components/ui/CountBadge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

// ===============================================================
// Stores & router
// ===============================================================
const gameStore = useGameStore()
const missionStore = useMissionStore()
const route = useRoute()
const router = useRouter()

// ===============================================================
// Etat du sidebar (collapse / expand)
// ===============================================================
const STORAGE_KEY = 'sidebar-collapsed'
const isCollapsed = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'true')

// Desktop étroit (769px–1200px) : sidebar forcée en mode replié pour laisser la place
// au contenu — le choix utilisateur (isCollapsed) est conservé et reprend effet au-delà.
// L'offset du contenu est géré en CSS dans App.vue (min(var(--sidebar-width), 64px)).
const isNarrowDesktop = useMediaQuery(NARROW_DESKTOP_QUERY)
const effectiveCollapsed = computed(() => isNarrowDesktop.value || isCollapsed.value)

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
  children?: { to: string; icon: string; label: string }[]
}

const NAV_LINKS: NavLink[] = [
  { to: '/mission-tree', icon: '🗺️', label: 'Missions', requireGame: true },
  {
    to: '/campaign',
    icon: '⚔️',
    label: 'Campagne',
    requireGame: true,
    children: [
      { to: '/campaign/map', icon: '🗺️', label: 'Carte' },
      { to: '/campaign/village', icon: '🏛️', label: 'Village' },
    ],
  },
  { to: '/reports', icon: '📜', label: 'Rapports', requireGame: true },
  { to: '/inventory', icon: '🎒', label: 'Inventaire', requireGame: true },
  { to: '/bazar', icon: '🛒', label: 'Bazar Mystique', requireGame: true },
  { to: '/settings', icon: '⚙️', label: 'Paramètres' },
]

const isInGame = computed(() => gameStore.gameState.currentStatus === 'in-progress')

const visibleNavLinks = computed(() =>
  NAV_LINKS.filter((link) => !link.requireGame || isInGame.value),
)

// Sous-menu "Campagne" (Carte / Village) — déplié automatiquement quand une route enfant
// est active, pas de persistance séparée (un seul sous-menu existe, inutile de complexifier).
const isChildRouteActive = (link: NavLink) =>
  !!link.children && route.path.startsWith(link.to + '/')

// Badge "non lus" affiché uniquement sur le lien Rapports
const unreadReportsCount = computed(() => missionStore.unreadReportsCount.value)

// ===============================================================
// Données joueur
// ===============================================================
const gold = computed(() => gameStore.gameState.inventory.gold)
const leadership = computed(() => gameStore.gameState.inventory.leadership)
const race = computed(() => gameStore.gameState.race)

/** Tooltip de la race : rappelle l'artefact de départ et ses bonus — même
 * source de vérité que RaceSelector (STARTING_ARTIFACTS), présentés sinon
 * uniquement au moment de la sélection de race. */
const raceTooltip = computed(() => {
  if (!race.value) return ''
  const artifact = STARTING_ARTIFACTS[race.value.id]
  if (!artifact) return race.value.name
  const e = artifact.effects
  const parts: string[] = []
  if (e.economy) parts.push(`+${e.economy}% Éco`)
  if (e.military) parts.push(`+${e.military}% Mil`)
  if (e.defense) parts.push(`+${e.defense}% Déf`)
  if (e.resourceBonus?.wood) parts.push(`+${e.resourceBonus.wood}% Bois`)
  if (e.resourceBonus?.stone) parts.push(`+${e.resourceBonus.stone}% Pierre`)
  if (e.resourceBonus?.iron) parts.push(`+${e.resourceBonus.iron}% Fer`)
  if (e.resourceBonus?.crop) parts.push(`+${e.resourceBonus.crop}% Céréales`)
  const fx = parts.length > 0 ? ` (${parts.join(', ')})` : ''
  return `${race.value.name} — ${artifact.icon} ${artifact.name}${fx}`
})

const leadershipStatus = computed(() => gameStore.leadershipStatus.value.level)
const leadershipTooltip = computed(() => {
  const ls = leadership.value
  const status = gameStore.leadershipStatus.value
  return `Leadership: ${ls}/200 — ${status.description}`
})

const showGoHomeConfirm = ref(false)
const goHome = () => {
  showGoHomeConfirm.value = true
}
const doGoHome = () => {
  router.push('/')
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
// Sidebar légèrement distincte du canvas (--color-bg-canvas) pour se détacher
// subtilement du contenu, sans reprendre le fond sombre pré-passage à la base claire.
$nav-bg: var(--color-bg-surface);
$nav-border: rgba(var(--color-accent-rgb), 0.25);
$gold-color: var(--color-accent-ink);
$text-color: var(--color-text);
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
  box-shadow: 3px 0 15px rgba(var(--color-black-rgb), 0.06);
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
    position: relative;
    display: inline-flex;
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

// Sous-menu (ex. Campagne → Carte / Village)
.nav-submenu {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding-left: 1.75rem;
  margin: 0.1rem 0 0.35rem;

  // Mode réduit : plus d'indentation, icônes centrées comme les liens principaux
  &--collapsed {
    padding-left: 0;

    .nav-sublink {
      justify-content: center;
    }
  }
}

.nav-sublink {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  color: var(--color-text-subtle);
  text-decoration: none;
  border-radius: 7px;
  font-size: 0.82rem;
  white-space: nowrap;
  overflow: hidden;
  transition:
    background $transition,
    color $transition;

  &:hover {
    background: rgba(218, 165, 32, 0.1);
    color: $gold-color;
  }

  &--active {
    background: rgba(218, 165, 32, 0.16);
    color: $gold-color;
    font-weight: 600;
  }

  .nav-icon {
    font-size: 1rem;
    width: 1.25rem;
    text-align: center;
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
    position: relative;
    display: inline-flex;
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
  background: rgba(var(--color-white-rgb), 0.95);
  border: 1px solid $nav-border;
  box-shadow: 0 2px 8px rgba(var(--color-black-rgb), 0.1);
  animation: floatUp 2s ease-out forwards;
  white-space: nowrap;

  &--positive {
    color: var(--color-success-strong);
  }
  &--negative {
    color: var(--color-danger);
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
    box-shadow: 0 -3px 15px rgba(var(--color-black-rgb), 0.06);
    z-index: 200;
    align-items: stretch;
    justify-content: space-around;
  }
}

.bottom-stats {
  display: none;

  @media (max-width: $mobile-breakpoint) {
    display: flex;
    position: fixed;
    bottom: 64px;
    left: 0;
    right: 0;
    height: 34px;
    background: rgba(var(--color-white-rgb), 0.9);
    border-top: 1px solid $nav-border;
    z-index: 200;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0 0.75rem;
  }
}

.bottom-stat-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: $text-color;
}

.bottom-stat-icon {
  font-size: 0.9rem;
}

.bottom-stat-item.leadership-critical {
  color: var(--color-danger);
  animation: leadershipAlert 2s infinite;
}

.bottom-stat-home {
  margin-left: auto;
  background: none;
  border: none;
  color: $text-color;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.2rem;
  line-height: 1;
}

.bottom-nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  flex: 1;
  color: var(--color-text-subtle);
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
    position: relative;
    display: inline-flex;
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

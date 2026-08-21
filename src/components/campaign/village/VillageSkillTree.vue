<!--
  Place du village en arbre de compétence : le Bâtiment Principal au centre
  (hub), les 6 autres bâtiments en branches hexagonales autour de lui.
  Remplace l'ancienne grille de BuildingCard.vue. Purement présentationnel —
  tout l'état vient de VillagePlanView.vue (villageTiles), seule source de
  vérité ; ce composant se contente de dessiner l'arbre et d'émettre select.

  Plateau fixe (7 nœuds, pas de pan/zoom) : un simple <svg viewBox="0 0 100
  100"> mis à l'échelle du conteneur suffit — pas besoin de la mécanique de
  LargeMapGrid.vue (viewport, cadrans, tuiles tampon), inutile ici.
-->
<template>
  <div class="tree-frame">
    <svg viewBox="0 0 100 100" class="tree">
      <!-- Fond décoratif statique (orbites, lignes de front) — jamais recalculé. -->
      <g aria-hidden="true">
        <circle class="orbit" :cx="CENTER.x" :cy="CENTER.y" r="24" />
        <circle class="orbit" :cx="CENTER.x" :cy="CENTER.y" r="50" />
        <line class="leyline" x1="0" y1="0" x2="100" y2="62" />
        <line class="leyline" x1="100" y1="0" x2="0" y2="70" />
        <line class="leyline" x1="10" y1="100" x2="90" y2="8" />
        <line class="leyline" x1="90" y1="100" x2="15" y2="30" />
      </g>

      <g v-for="b in branchPositions" :key="b.tile.type">
        <line
          class="path-line"
          :class="{ unlocked: b.tile.state !== 'locked', done: b.tile.state === 'maxed' }"
          :x1="CENTER.x"
          :y1="CENTER.y"
          :x2="b.nx"
          :y2="b.ny"
          aria-hidden="true"
        />
        <circle
          class="connector"
          :class="{ unlocked: b.tile.state !== 'locked' }"
          :cx="b.midX"
          :cy="b.midY"
          r="1.3"
          aria-hidden="true"
        />
        <line
          class="ghost-line"
          :x1="b.nx"
          :y1="b.ny"
          :x2="b.ghostLineEnd.x"
          :y2="b.ghostLineEnd.y"
          aria-hidden="true"
        />
        <circle
          v-for="(ghost, gi) in b.ghosts"
          :key="gi"
          class="ghost-dot"
          :cx="ghost.x"
          :cy="ghost.y"
          r="0.6"
          aria-hidden="true"
        />

        <SkillTreeNode
          :cx="b.nx"
          :cy="b.ny"
          :r="7"
          :icon-size="6.2"
          :pip-gap="4.4"
          show-name
          :icon="b.tile.icon"
          :name="b.tile.name"
          :level="b.tile.level"
          :max-level="b.tile.maxLevel"
          :state="b.tile.state"
          :selected="b.tile.selected"
          :status-detail="b.tile.statusDetail"
          @select="emit('select', b.tile.type)"
        />
      </g>

      <SkillTreeNode
        v-if="hub"
        :cx="CENTER.x"
        :cy="CENTER.y"
        :r="10.2"
        :icon-size="8.2"
        :pip-gap="5.1"
        :icon="hub.icon"
        :name="hub.name"
        :level="hub.level"
        :max-level="hub.maxLevel"
        :state="hub.state"
        :selected="hub.selected"
        :status-detail="hub.statusDetail"
        @select="emit('select', hub.type)"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BuildingType } from '@/data/buildings'
import SkillTreeNode from './SkillTreeNode.vue'

type BuildingState = 'locked' | 'available' | 'constructing' | 'upgradable' | 'waiting' | 'maxed'

export interface VillageTreeTile {
  type: BuildingType
  angle: number
  isCenter?: boolean
  icon: string
  name: string
  level: number
  maxLevel: number
  state: BuildingState
  selected: boolean
  statusDetail?: string
}

const props = defineProps<{ tiles: VillageTreeTile[] }>()
const emit = defineEmits<{ select: [type: BuildingType] }>()

const CENTER = { x: 50, y: 48 }
const RADIUS = 40

const hub = computed(() => props.tiles.find((t) => t.isCenter) ?? null)
const branches = computed(() => props.tiles.filter((t) => !t.isCenter))

const branchPositions = computed(() =>
  branches.value.map((tile) => {
    const rad = ((tile.angle - 90) * Math.PI) / 180
    const dx = Math.cos(rad)
    const dy = Math.sin(rad)
    const nx = CENTER.x + dx * RADIUS
    const ny = CENTER.y + dy * RADIUS
    const midX = CENTER.x + dx * RADIUS * 0.56
    const midY = CENTER.y + dy * RADIUS * 0.56
    // Frontière décorative au-delà du bâtiment (suggère la suite de l'arbre) —
    // filtrée aux bords du viewBox pour ne pas laisser de point à moitié coupé.
    const ghosts = [1.16, 1.28, 1.4]
      .map((t) => ({ x: CENTER.x + dx * RADIUS * t, y: CENTER.y + dy * RADIUS * t }))
      .filter((p) => p.x > 2 && p.x < 98 && p.y > 2 && p.y < 98)
    const ghostLineEnd = { x: CENTER.x + dx * RADIUS * 1.45, y: CENTER.y + dy * RADIUS * 1.45 }
    return { tile, nx, ny, midX, midY, ghosts, ghostLineEnd }
  }),
)
</script>

<style scoped>
.tree-frame {
  position: relative;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  /* Respiration entre l'arbre et le bord du cadre : le <svg> est en
     position:absolute + inset:0, une marge posée sur lui n'a aucun effet —
     c'est le padding du conteneur qui compte (inset:0 se cale sur le bord
     intérieur du padding, pas sur la bordure). box-sizing:border-box (reset
     global, App.vue) garde le carré à sa taille : seul l'intérieur se resserre. */
  padding: 16px;
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  /* Fond clair (comme le reste de l'appli) plutôt que l'îlot nocturne façon
     HUD de carte — plus discret, plus proche de la base parchemin. */
  background: radial-gradient(120% 90% at 50% 15%, rgba(var(--color-accent-rgb), 0.08), var(--gradient-canvas));
  box-shadow:
    0 20px 40px -25px rgba(var(--overlay-rgb), 0.3),
    inset 0 0 0 1px rgba(var(--overlay-rgb), 0.08);
  overflow: hidden;
}

.tree {
  /* Pas de position:absolute ici : rien d'autre à superposer dans le cadre,
     et un enfant absolu en inset:0 se cale sur le bord intérieur de la
     bordure du parent — il ignore complètement son padding. En flux normal,
     le padding de .tree-frame crée la respiration voulue tout seul. */
  display: block;
  width: 100%;
  height: 100%;
}

.orbit {
  fill: none;
  stroke: rgba(var(--overlay-rgb), 0.08);
}
.leyline {
  stroke: rgba(var(--overlay-rgb), 0.05);
  stroke-width: 0.3;
}

.path-line {
  fill: none;
  stroke: rgba(var(--overlay-rgb), 0.16);
  stroke-width: 0.45;
}
.path-line.unlocked {
  stroke: rgba(var(--overlay-rgb), 0.35);
}
.path-line.done {
  stroke: rgba(var(--color-accent-rgb), 0.65);
}

.connector {
  fill: var(--color-bg-surface);
  stroke: rgba(var(--overlay-rgb), 0.16);
  stroke-width: 0.4;
}
.connector.unlocked {
  stroke: rgba(var(--overlay-rgb), 0.35);
}

.ghost-line {
  fill: none;
  stroke: rgba(var(--overlay-rgb), 0.07);
  stroke-width: 0.35;
  stroke-dasharray: 0.6 1.4;
}
.ghost-dot {
  fill: rgba(var(--overlay-rgb), 0.1);
}
</style>

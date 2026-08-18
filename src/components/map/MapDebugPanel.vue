<!--
  Panneau de diagnostic partagé pour le module carte — remplace les deux panels
  debug historiques (LargeMapGrid, TileDetails) qui dupliquaient chacun leur
  propre palette sombre. Volontairement hors de la base claire de l'app,
  comme PerformanceMonitor.vue : un panneau de debug reste un panneau de
  debug, indépendamment du thème.
-->
<template>
  <div class="map-debug-panel">
    <div class="map-debug-title">{{ title }}</div>
    <div class="map-debug-rows">
      <div v-for="(row, i) in rows" :key="i" class="map-debug-row">
        <span class="map-debug-label">{{ row.label }}</span>
        <span class="map-debug-value" :class="`tone-${row.tone ?? 'default'}`">{{ row.value }}</span>
      </div>
    </div>
    <div v-if="$slots.default" class="map-debug-extra"><slot /></div>
  </div>
</template>

<script setup lang="ts">
export interface MapDebugRow {
  label: string
  value: string
  tone?: 'default' | 'mono' | 'accent' | 'danger' | 'warning' | 'success'
}

defineProps<{
  title: string
  rows: MapDebugRow[]
}>()
</script>

<style scoped>
.map-debug-panel {
  background: var(--debug-bg);
  border: 1px solid rgba(var(--debug-border-rgb), 0.35);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  font-size: 11px;
  color: var(--debug-text);
}

.map-debug-title {
  font-weight: 700;
  color: var(--debug-title);
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(var(--debug-border-rgb), 0.25);
  padding-bottom: 4px;
}

.map-debug-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.map-debug-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.map-debug-label {
  color: var(--debug-text);
}

.map-debug-value {
  color: var(--debug-text-strong);
  font-weight: 600;
  text-align: right;
}

.map-debug-value.tone-mono {
  color: var(--debug-mono-accent);
  font-weight: 400;
}
.map-debug-value.tone-accent {
  color: var(--debug-accent);
}
.map-debug-value.tone-danger {
  color: var(--debug-danger);
}
.map-debug-value.tone-warning {
  color: var(--debug-warning);
}
.map-debug-value.tone-success {
  color: var(--debug-success);
}

.map-debug-extra {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
</style>

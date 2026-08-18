<template>
  <div class="data-table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th v-for="header in headers" :key="header">{{ header }}</th>
        </tr>
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  headers: string[]
}>()
</script>

<style scoped>
.data-table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table :deep(th) {
  text-align: left;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  font-weight: 600;
  /* --color-text-faint échoue le contraste AA à cette taille (~2.5:1 sur blanc) —
     --color-text-muted reste visuellement secondaire tout en restant lisible. */
  color: var(--color-text-muted);
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.15);
  white-space: nowrap;
}

.data-table :deep(td) {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.08);
  font-size: 0.88rem;
  color: var(--color-text);
}

.data-table :deep(tbody tr:hover) {
  background: rgba(var(--overlay-rgb), 0.04);
}

.data-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}
</style>

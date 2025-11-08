<!-- Exemple simple d'utilisation de la grande carte -->
<template>
  <div class="app-container">
    <nav class="app-nav">
      <router-link to="/map">Petite Carte (11x11)</router-link>
      <router-link to="/map-large">Grande Carte (100x100)</router-link>
    </nav>

    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useMapStore } from '@/stores/mapStore'

// Charger l'état sauvegardé au démarrage
const mapStore = useMapStore()

onMounted(() => {
  mapStore.loadMapState()
})
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.app-nav {
  background: #2a5298;
  padding: 15px;
  display: flex;
  gap: 20px;
  justify-content: center;
}

.app-nav a {
  color: white;
  text-decoration: none;
  padding: 10px 20px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.2s;
}

.app-nav a:hover,
.app-nav a.router-link-active {
  background: rgba(255, 255, 255, 0.2);
}

main {
  padding: 20px;
}
</style>

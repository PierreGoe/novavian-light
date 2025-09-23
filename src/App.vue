<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import ResourcesHeader from '@/components/ResourcesHeader.vue'

const gameStore = useGameStore()

onMounted(() => {
  // Démarrer l'auto-save au montage de l'app
  gameStore.startAutoSave()
})

onUnmounted(() => {
  // Arrêter l'auto-save au démontage
  gameStore.stopAutoSave()
})
</script>

<template>
  <div id="app">
    <ResourcesHeader />
    <RouterView />
  </div>
</template>

<style>
/* Reset et styles globaux */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #f4e4bc;
  background: #1a0f08;
  overflow-x: hidden;
}

#app {
  min-height: 100vh;
}

/* Classe pour les pages principales qui doivent éviter le header */
.main-content {
  min-height: calc(100vh - 80px); /* Ajuster selon la hauteur du header */
}

/* Styles utilitaires globaux */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(-100%);
}

/* Scrollbar personnalisée */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(139, 69, 19, 0.2);
}

::-webkit-scrollbar-thumb {
  background: rgba(218, 165, 32, 0.6);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(218, 165, 32, 0.8);
}

/* Responsivité globale */
@media (max-width: 768px) {
  body {
    font-size: 0.9rem;
  }
}
</style>

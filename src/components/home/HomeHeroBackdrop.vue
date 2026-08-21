<template>
  <div class="hero-backdrop" aria-hidden="true">
    <div class="hero-image" :style="{ backgroundImage: `url(${heroImageUrl})` }"></div>
    <div class="hero-fade-bottom"></div>
    <div class="hero-vignette"></div>
  </div>
</template>

<script setup lang="ts">
const heroImageUrl = `${import.meta.env.BASE_URL}background.jpg`
</script>

<style scoped>
.hero-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

/* L'image source ne fait que 1152px de large : au-delà, "cover" en plein
   viewport la sur-agrandit et floute le détail (le "zoom" perd la
   résolution). On plafonne donc sa largeur affichée bien au-dessus de la
   résolution native seulement sur très grands écrans, et on estompe ses
   bords verticaux avec un masque plutôt que de laisser une coupe nette. */
.hero-image {
  position: absolute;
  top: 0;
  left: 50%;
  width: min(1500px, 100%);
  height: 100%;
  transform: translateX(-50%);
  background-size: cover;
  background-position: center 28%;
  background-repeat: no-repeat;
  mask-image: linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 4%,
    black 96%,
    transparent 100%
  );
}

/* Fondu vers le fond crème de l'écran, pour que la scène se dissolve dans
   le reste de la page plutôt que de finir sur un bord net. */
.hero-fade-bottom {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 40%, var(--color-bg-canvas) 92%);
}

/* Voile clair centré, pour garder le titre et les cartes lisibles (contraste
   AA) sans masquer la scène près des bords de l'écran. */
.hero-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 85% 75% at 50% 42%,
    rgba(var(--color-bg-canvas-rgb), 0.86) 0%,
    rgba(var(--color-bg-canvas-rgb), 0.48) 55%,
    transparent 85%
  );
}
</style>

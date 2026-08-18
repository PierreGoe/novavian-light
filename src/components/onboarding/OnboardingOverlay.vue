<template>
  <BaseDialog
    :open="visible"
    role="alertdialog"
    :labelledby="titleId"
    :close-on-backdrop="false"
    @update:open="onUpdateOpen"
  >
    <template #header>
      <div class="onboarding-header-row">
        <h2 :id="titleId" class="onboarding-title">{{ currentStepData.title }}</h2>
        <button class="onboarding-skip" type="button" @click="skip">Passer</button>
      </div>
    </template>

    <p class="onboarding-body">{{ currentStepData.body }}</p>

    <div class="onboarding-progress">
      <span class="onboarding-progress-text">Étape {{ currentStep + 1 }}/{{ STEPS.length }}</span>
      <StepDots :total="STEPS.length" :current="currentStep" />
    </div>

    <template #footer>
      <Button
        v-if="currentStep > 0"
        variant="secondary"
        class="onboarding-prev"
        @click="goToPrevious"
      >
        Précédent
      </Button>
      <Button v-if="!isLastStep" ref="primaryBtnRef" @click="goToNext">Suivant</Button>
      <Button v-else ref="primaryBtnRef" @click="finish">Terminer</Button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useOnboarding } from '@/composables/useOnboarding'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import Button from '@/components/ui/Button.vue'
import StepDots from '@/components/ui/StepDots.vue'

interface OnboardingStep {
  title: string
  body: string
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Bienvenue, chef de guerre !',
    body: "Votre objectif : progresser sur la carte de mission jusqu'à la bataille finale, tout en gardant votre Leadership au-dessus de zéro. S'il tombe à 0, c'est la fin de la partie.",
  },
  {
    title: 'La carte de mission',
    body: 'Chaque case représente une étape : combat, élite, boutique, événement, repos ou boss. Cliquez sur une case accessible (mise en surbrillance) pour avancer.',
  },
  {
    title: 'Vos ressources',
    body: "Une fois en mission, une barre en haut de l'écran affiche votre bois, argile, fer et blé à gérer pour construire et recruter.",
  },
  {
    title: 'La barre latérale',
    body: "Le menu latéral (barre en bas sur mobile) vous donne toujours accès à l'Inventaire d'artefacts et au Bazar pour acheter, vendre ou reroll votre équipement.",
  },
  {
    title: 'À vous de jouer !',
    body: 'Ce message ne réapparaîtra plus. Bonne chance, chef de guerre !',
  },
]

const route = useRoute()
const { hasSeenOnboarding, markOnboardingSeen } = useOnboarding()

const currentStep = ref(0)
const primaryBtnRef = ref<{ focus: () => void } | null>(null)

const visible = computed(() => route.name === 'mission-tree' && !hasSeenOnboarding.value)
const currentStepData = computed(() => STEPS[currentStep.value])
const isLastStep = computed(() => currentStep.value === STEPS.length - 1)

const titleId = `onboarding-title-${Math.random().toString(36).slice(2, 9)}`

function goToNext() {
  if (currentStep.value < STEPS.length - 1) {
    currentStep.value++
  }
}

function goToPrevious() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function skip() {
  markOnboardingSeen()
}

function finish() {
  markOnboardingSeen()
}

// Fermeture via Esc (BaseDialog) — équivaut à "Passer"
function onUpdateOpen(value: boolean) {
  if (!value) skip()
}

// Focus posé sur le bouton principal à l'ouverture et à chaque changement d'étape.
// Deux nextTick : le premier laisse BaseDialog poser son propre focus par défaut
// sur le panneau, le second nous laisse le reprendre sur le bouton principal.
watch(
  () => [visible.value, currentStep.value],
  async ([isVisible]) => {
    if (isVisible) {
      await nextTick()
      await nextTick()
      primaryBtnRef.value?.focus()
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.onboarding-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.onboarding-title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-accent-ink);
}

.onboarding-skip {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--color-text-faint);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.2rem 0;
  text-decoration: underline;
}

.onboarding-skip:hover {
  color: var(--color-text-muted);
}

.onboarding-skip:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.onboarding-body {
  margin: 0 0 1.25rem;
}

.onboarding-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.onboarding-progress-text {
  font-size: 0.78rem;
  color: var(--color-text-faint);
}

.onboarding-prev {
  margin-right: auto;
}
</style>

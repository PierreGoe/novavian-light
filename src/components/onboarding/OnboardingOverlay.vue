<template>
  <Teleport to="body">
    <Transition name="onboarding-fade">
      <div
        v-if="visible"
        class="onboarding-backdrop"
        @keydown.esc="skip"
      >
        <div
          ref="dialogRef"
          class="onboarding-dialog"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <button class="onboarding-skip" type="button" @click="skip">Passer</button>

          <h2 :id="titleId" class="onboarding-title">{{ currentStepData.title }}</h2>
          <p class="onboarding-body">{{ currentStepData.body }}</p>

          <div class="onboarding-progress">
            <span class="onboarding-progress-text">Étape {{ currentStep + 1 }}/{{ STEPS.length }}</span>
            <div class="onboarding-dots">
              <span
                v-for="(step, index) in STEPS"
                :key="index"
                class="onboarding-dot"
                :class="{ 'onboarding-dot--active': index === currentStep }"
              />
            </div>
          </div>

          <div class="onboarding-actions">
            <button
              v-if="currentStep > 0"
              class="onboarding-btn onboarding-btn--secondary"
              type="button"
              @click="goToPrevious"
            >
              Précédent
            </button>
            <button
              v-if="!isLastStep"
              ref="primaryBtnRef"
              class="onboarding-btn onboarding-btn--primary"
              type="button"
              @click="goToNext"
            >
              Suivant
            </button>
            <button
              v-else
              ref="primaryBtnRef"
              class="onboarding-btn onboarding-btn--primary"
              type="button"
              @click="finish"
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useOnboarding } from '@/composables/useOnboarding'

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
    body: "Ce message ne réapparaîtra plus. Bonne chance, chef de guerre !",
  },
]

const route = useRoute()
const { hasSeenOnboarding, markOnboardingSeen } = useOnboarding()

const currentStep = ref(0)
const dialogRef = ref<HTMLDivElement | null>(null)
const primaryBtnRef = ref<HTMLButtonElement | null>(null)

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

// Focus posé sur le bouton principal à l'ouverture et à chaque changement d'étape
watch(
  () => [visible.value, currentStep.value],
  async ([isVisible]) => {
    if (isVisible) {
      await nextTick()
      primaryBtnRef.value?.focus()
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.onboarding-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.onboarding-dialog {
  position: relative;
  background: #1e293b;
  border: 2px solid rgba(218, 165, 32, 0.5);
  border-radius: 14px;
  padding: 1.75rem 1.5rem 1.5rem;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
}

.onboarding-skip {
  position: absolute;
  top: 0.9rem;
  right: 1rem;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.25rem 0.4rem;
  text-decoration: underline;
}

.onboarding-skip:hover {
  color: #cbd5e1;
}

.onboarding-skip:focus-visible {
  outline: 2px solid #daa520;
  outline-offset: 2px;
}

.onboarding-title {
  margin: 0 1.5rem 0.6rem 0;
  font-size: 1.1rem;
  color: #daa520;
}

.onboarding-body {
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
  color: #cbd5e1;
  line-height: 1.5;
}

.onboarding-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.onboarding-progress-text {
  font-size: 0.78rem;
  color: #94a3b8;
}

.onboarding-dots {
  display: flex;
  gap: 0.4rem;
}

.onboarding-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: background 0.15s;
}

.onboarding-dot--active {
  background: #daa520;
}

.onboarding-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.onboarding-btn {
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background 0.15s,
    transform 0.1s;
}

.onboarding-btn:focus-visible {
  outline: 2px solid #daa520;
  outline-offset: 2px;
}

.onboarding-btn--secondary {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
  margin-right: auto;
}

.onboarding-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.13);
}

.onboarding-btn--primary {
  background: linear-gradient(135deg, #daa520, #b8860b);
  color: #1a0f08;
}

.onboarding-btn--primary:hover {
  filter: brightness(1.1);
}

.onboarding-btn:active {
  transform: scale(0.97);
}

.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity 0.15s ease;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}
</style>

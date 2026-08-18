import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGameStore, type Race } from '../gameStore'
import router from '../../router'

const ROMAINS: Race = {
  id: 'romains',
  name: 'Romains',
  icon: '🏛️',
  description: 'Une race équilibrée.',
}

const GAULOIS: Race = {
  id: 'gaulois',
  name: 'Gaulois',
  icon: '🐓',
  description: 'Une race défensive.',
}

describe('gameStore - sélection de race', () => {
  const gameStore = useGameStore()

  beforeEach(() => {
    localStorage.clear()
    gameStore.resetGameCompletely()
  })

  it('startNewGame écrit immédiatement la sauvegarde, sans attendre le debounce', () => {
    gameStore.startNewGame(ROMAINS)

    // Pas d'avance de timers ici : si l'écriture était encore debouncée (400ms),
    // ce test échouerait, tout comme le loadGame() appelé au montage de MissionTree
    // juste après la navigation depuis RaceSelector.
    const saved = localStorage.getItem('minitravian-save')
    expect(saved).not.toBeNull()
    expect(JSON.parse(saved as string).race?.id).toBe('romains')
  })

  it("loadGame() appelé juste après startNewGame() ne perd pas la race sélectionnée et ne rebondit pas vers l'accueil (régression redirection race-selection -> mission-tree)", () => {
    const pushSpy = vi.spyOn(router, 'push')

    gameStore.startNewGame(ROMAINS)

    // Reproduit MissionTree.onMounted() qui appelle loadGame() dès le montage de la page
    // suivant la navigation, potentiellement avant que la sauvegarde debouncée n'ait été écrite.
    gameStore.loadGame()

    expect(gameStore.gameState.race?.id).toBe('romains')
    expect(gameStore.gameState.currentStatus).toBe('in-progress')
    // loadGame() ne doit pas rediriger vers l'accueil faute de sauvegarde trouvée
    expect(pushSpy).not.toHaveBeenCalledWith('/')

    pushSpy.mockRestore()
  })

  it("loadGame() appelé juste après startNewGame() ne réécrase pas la race avec une ancienne sauvegarde", () => {
    // Une ancienne partie existait déjà avec une autre race
    gameStore.startNewGame(GAULOIS)
    gameStore.flushGame()

    // Le joueur recommence une nouvelle partie avec une race différente
    gameStore.resetGameCompletely()
    gameStore.startNewGame(ROMAINS)
    gameStore.loadGame()

    expect(gameStore.gameState.race?.id).toBe('romains')
  })
})

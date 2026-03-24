import { ref, onMounted, onUnmounted } from 'vue'
import { useMissionStore, type ScoutMission } from '../stores/missionStore'
import type { MapTile } from '../stores/mapStore'

export function useScoutDisplay() {
  const missionStore = useMissionStore()
  const currentTime = ref(Date.now())
  let displayTimer: number | null = null

  onMounted(() => {
    displayTimer = window.setInterval(() => {
      currentTime.value = Date.now()
    }, 1000)
  })

  onUnmounted(() => {
    if (displayTimer !== null) clearInterval(displayTimer)
  })

  const isBeingExplored = (tile: MapTile): boolean => {
    return missionStore.getScoutMissions.value.some(
      (m: ScoutMission) =>
        m.status === 'pending' &&
        m.target.x === tile.position.x &&
        m.target.y === tile.position.y,
    )
  }

  const getExploringTimer = (tile: MapTile): string => {
    const mission = missionStore.getScoutMissions.value.find(
      (m: ScoutMission) =>
        m.status === 'pending' &&
        m.target.x === tile.position.x &&
        m.target.y === tile.position.y,
    )
    if (!mission) return ''
    const remaining = Math.max(0, mission.endsAt - currentTime.value)
    const seconds = Math.floor(remaining / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getExploringProgress = (tile: MapTile): number => {
    const mission = missionStore.getScoutMissions.value.find(
      (m: ScoutMission) =>
        m.status === 'pending' &&
        m.target.x === tile.position.x &&
        m.target.y === tile.position.y,
    )
    if (!mission) return 0
    const total = mission.endsAt - mission.startedAt
    const elapsed = currentTime.value - mission.startedAt
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }

  const getTileExploringOpacity = (tile: MapTile): string => {
    const progress = getExploringProgress(tile)
    return (1 - (progress / 100) * 0.7).toFixed(2)
  }

  return { isBeingExplored, getExploringTimer, getExploringProgress, getTileExploringOpacity }
}

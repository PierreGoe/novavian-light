<!-- ═══════════════════════════════════════════════════════════════════
     VillageMapView.vue — Rendu isométrique du village (style Travian)
     ═══════════════════════════════════════════════════════════════════
     Utilise la technique CSS sprite : un <img src="x.gif"> transparent
     dont le background-image est défini par la classe CSS du bâtiment.

     Props :
       buildings  — liste des bâtiments construits (MissionBuilding[])
       buildQueue — file de construction en cours

     Événements :
       @building-click { slotIndex, fieldId, buildingType }
     ═══════════════════════════════════════════════════════════════════ -->

<template>
  <div class="village2">
    <div class="village-map-wrapper">
      <!-- Carte du village -->
      <div id="village_map" :class="mapBackgroundClass">
        <!-- Couche visuelle : bâtiments d1-d20 (pas d'interaction directe) -->
        <img
          v-for="slot in buildingSlots"
          :key="slot.slotIndex"
          src="/gpack/img/x.gif"
          :class="[
            'building',
            `d${slot.slotIndex}`,
            slot.spriteClass,
            { selected: selectedSlot === slot.slotIndex },
          ]"
          alt=""
        />

        <!-- Couche interactive : hitboxes centrées au z-index max -->
        <div
          v-for="slot in buildingSlots"
          :key="`hit-${slot.slotIndex}`"
          :class="['hitbox', `hit-d${slot.slotIndex}`, { 'debug-hitbox': showHitboxes }]"
          :title="slot.tooltip"
          @click="onSlotClick(slot)"
        ></div>

        <!-- Badges de niveau -->
        <div id="levels" :class="{ on: showLevels }">
          <div
            v-for="slot in buildingSlots"
            :key="`lv-${slot.slotIndex}`"
            v-show="slot.level > 0"
            :class="`d${slot.slotIndex}`"
          >
            {{ slot.level }}
          </div>
        </div>
      </div>

      <!-- Bouton toggle niveaux -->
      <button
        class="level-toggle-btn"
        :class="{ active: showLevels }"
        @click="showLevels = !showLevels"
        title="Afficher/masquer les niveaux"
      >
        {{ showLevels ? '🔢' : '👁️' }}
      </button>

      <!-- Bouton debug hitboxes -->
      <button
        class="level-toggle-btn hitbox-toggle-btn"
        :class="{ active: showHitboxes }"
        @click="showHitboxes = !showHitboxes"
        title="Afficher/masquer les hitboxes"
      >
        🔲
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import { BUILDING_DEFINITIONS } from '@/data/buildings'
import type { BuildingType, BuildingDefinition } from '@/data/buildings'
import type { MissionBuilding } from '@/stores/missionStore'

// ── Mapping BuildingType Novavian → sprite Travian ──────────────────
const BUILDING_SPRITE_MAP: Record<BuildingType, number> = {
  headquarters: 15, // Main Building → g15
  barracks: 19, // Casernes → g19
  lumbermill: 5, // Scierie → g5
  farm: 8, // Ferme → g8 (Grain Mill)
  quarry: 6, // Carrière → g6 (Brickyard)
  mine: 7, // Mine → g7 (Iron Foundry)
}

// Slot prédéfini pour chaque type de bâtiment sur la carte
// (position fixe, comme dans Travian)
const SLOT_ASSIGNMENT: Record<BuildingType, number> = {
  headquarters: 8, // Centre de la carte (d8, position proéminente)
  barracks: 11, // g19 dans slot d11
  lumbermill: 1, // Scierie en haut gauche
  farm: 3, // Ferme en haut
  quarry: 6, // Carrière à gauche
  mine: 5, // Mine à droite
}

interface SlotData {
  slotIndex: number
  building: MissionBuilding | null
  buildingDef: BuildingDefinition | null
  spriteClass: string
  tooltip: string
  level: number
  type: BuildingType | null
  isUnderConstruction: boolean
}

const props = defineProps<{
  selectedBuildingType?: BuildingType | null
}>()

const emit = defineEmits<{
  'building-click': [payload: { slotIndex: number; buildingType: BuildingType | null }]
}>()

const missionStore = useMissionStore()
const town = computed(() => missionStore.town.value)

const showLevels = ref(true)
const showHitboxes = ref(true)
const selectedSlot = ref<number | null>(null)

// Fond de carte — on utilise bg11 (mur de pierre) par défaut pour Novavian
const mapBackgroundClass = computed(() => 'd2_11')

// Construit les données des 20 slots
const buildingSlots = computed((): SlotData[] => {
  const buildings = town.value?.buildings ?? []
  const slots: SlotData[] = []

  for (let i = 1; i <= 20; i++) {
    // Trouver si un bâtiment est assigné à ce slot
    const assignedType = Object.entries(SLOT_ASSIGNMENT).find(
      ([, slotIdx]) => slotIdx === i,
    )?.[0] as BuildingType | undefined

    const building = assignedType ? (buildings.find((b) => b.type === assignedType) ?? null) : null

    const buildingDef = assignedType ? BUILDING_DEFINITIONS[assignedType] : null
    const isUnderConstruction = building?.isUnderConstruction ?? false

    let spriteClass: string
    if (building && building.level > 0) {
      const spriteId = BUILDING_SPRITE_MAP[building.type]
      spriteClass = isUnderConstruction ? `g${spriteId}b` : `g${spriteId}`
    } else if (assignedType && buildingDef) {
      // Slot réservé mais pas encore construit
      spriteClass = 'iso'
    } else {
      // Slot libre
      spriteClass = 'iso'
    }

    const tooltip =
      building && building.level > 0
        ? `${buildingDef?.name ?? 'Bâtiment'} — Niveau ${building.level}`
        : assignedType && buildingDef
          ? `${buildingDef.name} (emplacement disponible)`
          : 'Emplacement vide'

    slots.push({
      slotIndex: i,
      building,
      buildingDef: buildingDef ?? null,
      spriteClass,
      tooltip,
      level: building?.level ?? 0,
      type: assignedType ?? null,
      isUnderConstruction,
    })
  }

  return slots
})

function onSlotClick(slot: SlotData) {
  selectedSlot.value = selectedSlot.value === slot.slotIndex ? null : slot.slotIndex
  emit('building-click', {
    slotIndex: slot.slotIndex,
    buildingType: slot.type,
  })
}
</script>

<style scoped>
.village-map-wrapper {
  position: relative;
  display: inline-block;
}

.level-toggle-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 200;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(218, 165, 32, 0.4);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.level-toggle-btn:hover,
.level-toggle-btn.active {
  background: rgba(218, 165, 32, 0.3);
  border-color: rgba(218, 165, 32, 0.8);
}

.hitbox-toggle-btn {
  bottom: 44px;
}
</style>

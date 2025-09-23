<template>
  <div class="mission-tree">
    <div class="tree-background"></div>

    <!-- En-tête avec progression -->
    <header class="tree-header">
      <h1>Arbre des Décisions</h1>
      <p>Choisissez votre voie pour façonner votre destin</p>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
      </div>
    </header>

    <!-- Arbre de navigation -->
    <main class="tree-container">
      <div class="tree-structure">
        <!-- Nœud actuel -->
        <div class="current-node" :class="'node-' + currentNode.id">
          <div class="node-content">
            <div class="node-icon">{{ currentNode.icon }}</div>
            <h2>{{ currentNode.title }}</h2>
            <p class="node-description">{{ currentNode.description }}</p>

            <!-- Choix disponibles -->
            <div class="choices" v-if="currentNode.choices && currentNode.choices.length > 0">
              <button
                v-for="choice in currentNode.choices"
                :key="choice.id"
                class="choice-button"
                :class="'choice-' + choice.type"
                @click="selectChoice(choice)"
              >
                <div class="choice-icon">{{ choice.icon }}</div>
                <div class="choice-content">
                  <h3>{{ choice.title }}</h3>
                  <p>{{ choice.description }}</p>
                  <span class="choice-consequence">{{ choice.consequence }}</span>
                </div>
              </button>
            </div>

            <!-- Action finale si nœud terminal -->
            <div class="final-action" v-else>
              <button class="start-game-button" @click="startGameSection">
                🎮 Commencer cette aventure
              </button>
              <button class="back-button" @click="goBack" v-if="visitedNodes.length > 1">
                ← Retour
              </button>
            </div>
          </div>
        </div>

        <!-- Chemin parcouru (breadcrumb visuel) -->
        <div class="path-visualization">
          <div class="path-nodes">
            <div
              v-for="(nodeId, index) in visitedNodes"
              :key="nodeId"
              class="path-node"
              :class="{ active: nodeId === currentNode.id }"
              @click="goToNode(nodeId)"
            >
              <span class="path-icon">{{ getNodeById(nodeId)?.icon }}</span>
              <span class="path-title">{{ getNodeById(nodeId)?.title }}</span>
              <div v-if="index < visitedNodes.length - 1" class="path-arrow">→</div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Bouton retour à l'accueil -->
    <footer class="tree-footer">
      <button class="home-button" @click="goHome">🏠 Retour à l'accueil</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

interface TreeChoice {
  id: string
  title: string
  description: string
  consequence: string
  icon: string
  type: 'military' | 'economic' | 'diplomatic'
  nextNode: string
}

interface TreeNode {
  id: string
  title: string
  description: string
  icon: string
  choices?: TreeChoice[]
  gameSection?: string // Section de jeu à lancer
}

const router = useRouter()
const gameStore = useGameStore()

// État de l'arbre
const currentNodeId = ref<string>('root')
const visitedNodes = ref<string[]>(['root'])

// Structure de l'arbre de décisions
const treeNodes: TreeNode[] = [
  {
    id: 'root',
    title: "L'Aube d'un Empire",
    description:
      "Vous venez d'établir votre première colonie. Les terres environnantes regorgent d'opportunités, mais aussi de dangers. Comment voulez-vous développer votre territoire ?",
    icon: '🏛️',
    choices: [
      {
        id: 'military',
        title: 'Voie Militaire',
        description: 'Lever une armée et conquérir les terres voisines',
        consequence: 'Progression rapide mais relations tendues',
        icon: '⚔️',
        type: 'military',
        nextNode: 'military-path',
      },
      {
        id: 'economic',
        title: 'Voie Économique',
        description: "Développer le commerce et l'agriculture",
        consequence: 'Croissance stable et alliances commerciales',
        icon: '💰',
        type: 'economic',
        nextNode: 'economic-path',
      },
      {
        id: 'diplomatic',
        title: 'Voie Diplomatique',
        description: 'Négocier des alliances avec les tribus locales',
        consequence: 'Expansion pacifique mais plus lente',
        icon: '🤝',
        type: 'diplomatic',
        nextNode: 'diplomatic-path',
      },
    ],
  },

  // Branche Militaire
  {
    id: 'military-path',
    title: "L'Art de la Guerre",
    description:
      "Vos légions sont prêtes. Devant vous s'étendent trois territoires : une forteresse barbare, des terres fertiles défendues par des milices, et un passage montagneux stratégique.",
    icon: '⚔️',
    choices: [
      {
        id: 'fortress',
        title: 'Assaut sur la Forteresse',
        description: 'Attaque frontale contre la forteresse barbare',
        consequence: 'Victoire glorieuse mais pertes importantes',
        icon: '🏰',
        type: 'military',
        nextNode: 'fortress-battle',
      },
      {
        id: 'fertile-lands',
        title: 'Conquête des Terres Fertiles',
        description: 'Invasion des plaines agricoles',
        consequence: 'Ressources abondantes, résistance modérée',
        icon: '🌾',
        type: 'military',
        nextNode: 'fertile-conquest',
      },
      {
        id: 'mountain-pass',
        title: 'Contrôle du Passage',
        description: 'Sécuriser la route commerciale montagnarde',
        consequence: 'Position stratégique, revenus de péage',
        icon: '⛰️',
        type: 'military',
        nextNode: 'mountain-control',
      },
    ],
  },

  // Branche Économique
  {
    id: 'economic-path',
    title: 'Les Routes du Commerce',
    description:
      "Votre ville prospère grâce au commerce. Trois opportunités s'offrent à vous pour étendre votre influence économique dans la région.",
    icon: '💰',
    choices: [
      {
        id: 'trade-routes',
        title: 'Réseau Commercial',
        description: 'Établir des routes commerciales avec les villes lointaines',
        consequence: 'Revenus élevés, dépendance aux partenaires',
        icon: '🛤️',
        type: 'economic',
        nextNode: 'trade-network',
      },
      {
        id: 'mining',
        title: 'Exploitation Minière',
        description: "Développer les mines de fer et d'or des collines",
        consequence: 'Ressources stratégiques, pollution locale',
        icon: '⛏️',
        type: 'economic',
        nextNode: 'mining-operation',
      },
      {
        id: 'agriculture',
        title: 'Révolution Agricole',
        description: "Moderniser l'agriculture et l'élevage",
        consequence: 'Autosuffisance alimentaire, croissance démographique',
        icon: '🚜',
        type: 'economic',
        nextNode: 'agricultural-boom',
      },
    ],
  },

  // Branche Diplomatique
  {
    id: 'diplomatic-path',
    title: "L'Alliance des Peuples",
    description:
      "Vos négociateurs ont établi des contacts prometteurs. Trois alliances majeures peuvent transformer l'équilibre de la région.",
    icon: '🤝',
    choices: [
      {
        id: 'tribal-alliance',
        title: 'Alliance Tribale',
        description: "S'allier avec les tribus nomades du désert",
        consequence: 'Cavalerie redoutable, culture nomade',
        icon: '🏕️',
        type: 'diplomatic',
        nextNode: 'tribal-pact',
      },
      {
        id: 'city-league',
        title: 'Ligue des Cités',
        description: 'Rejoindre la confédération des cités-États',
        consequence: 'Technologie avancée, obligations mutituelles',
        icon: '🏛️',
        type: 'diplomatic',
        nextNode: 'city-confederation',
      },
      {
        id: 'maritime-pact',
        title: 'Pacte Maritime',
        description: 'Alliance avec les puissances navales',
        consequence: 'Domination des mers, vulnérabilité terrestre',
        icon: '⚓',
        type: 'diplomatic',
        nextNode: 'naval-alliance',
      },
    ],
  },

  // Nœuds terminaux (seront étendus plus tard)
  {
    id: 'fortress-battle',
    title: 'La Bataille de la Forteresse',
    description: 'Votre première grande bataille vous attend...',
    icon: '⚔️',
    gameSection: 'fortress-battle',
  },
  {
    id: 'fertile-conquest',
    title: 'Maître des Plaines',
    description: 'Les terres fertiles sont à vous...',
    icon: '🌾',
    gameSection: 'fertile-conquest',
  },
  {
    id: 'mountain-control',
    title: 'Gardien du Passage',
    description: 'Vous contrôlez maintenant la route des montagnes...',
    icon: '⛰️',
    gameSection: 'mountain-control',
  },
  {
    id: 'trade-network',
    title: 'Empire Commercial',
    description: "Votre réseau commercial s'étend...",
    icon: '🛤️',
    gameSection: 'trade-network',
  },
  {
    id: 'mining-operation',
    title: 'Richesses Souterraines',
    description: "L'or et le fer coulent à flots...",
    icon: '⛏️',
    gameSection: 'mining-operation',
  },
  {
    id: 'agricultural-boom',
    title: 'Grenier de la Région',
    description: 'Vos terres nourrissent des milliers...',
    icon: '🚜',
    gameSection: 'agricultural-boom',
  },
  {
    id: 'tribal-pact',
    title: 'Frères des Sables',
    description: 'Les cavaliers nomades sont vos alliés...',
    icon: '🏕️',
    gameSection: 'tribal-pact',
  },
  {
    id: 'city-confederation',
    title: 'Cité Éclairée',
    description: 'La sagesse collective guide vos pas...',
    icon: '🏛️',
    gameSection: 'city-confederation',
  },
  {
    id: 'naval-alliance',
    title: 'Maître des Océans',
    description: 'Vos flottes dominent les mers...',
    icon: '⚓',
    gameSection: 'naval-alliance',
  },
]

// Computed
const currentNode = computed(() => {
  return treeNodes.find((node) => node.id === currentNodeId.value) || treeNodes[0]
})

const progressPercentage = computed(() => {
  return Math.min((visitedNodes.value.length / 4) * 100, 100)
})

// Méthodes
const getNodeById = (id: string) => {
  return treeNodes.find((node) => node.id === id)
}

const selectChoice = (choice: TreeChoice) => {
  currentNodeId.value = choice.nextNode
  if (!visitedNodes.value.includes(choice.nextNode)) {
    visitedNodes.value.push(choice.nextNode)
  }

  // Sauvegarder la progression
  saveProgress()
}

const goToNode = (nodeId: string) => {
  const nodeIndex = visitedNodes.value.indexOf(nodeId)
  if (nodeIndex !== -1) {
    currentNodeId.value = nodeId
    // Tronquer le chemin si on revient en arrière
    visitedNodes.value = visitedNodes.value.slice(0, nodeIndex + 1)
    saveProgress()
  }
}

const goBack = () => {
  if (visitedNodes.value.length > 1) {
    visitedNodes.value.pop()
    currentNodeId.value = visitedNodes.value[visitedNodes.value.length - 1]
    saveProgress()
  }
}

const startGameSection = () => {
  if (currentNode.value.gameSection) {
    // Sauvegarder quelle section de jeu a été choisie
    gameStore.gameState.currentGameSection = currentNode.value.gameSection
    gameStore.saveGame()

    // Naviguer vers la section de jeu spécifique
    router.push(`/game/${currentNode.value.gameSection}`)
  }
}

const saveProgress = () => {
  const progressData = {
    currentNodeId: currentNodeId.value,
    visitedNodes: [...visitedNodes.value],
  }
  localStorage.setItem('minitravian-tree-progress', JSON.stringify(progressData))
}

const loadProgress = () => {
  const saved = localStorage.getItem('minitravian-tree-progress')
  if (saved) {
    const progress = JSON.parse(saved)
    currentNodeId.value = progress.currentNodeId || 'root'
    visitedNodes.value = progress.visitedNodes || ['root']
  }
}

const goHome = () => {
  router.push('/')
}

onMounted(() => {
  loadProgress()
})
</script>

<style scoped>
.mission-tree {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a0f08 0%, #2c1810 100%);
  color: #f4e4bc;
  position: relative;
}

.tree-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 25% 25%, rgba(218, 165, 32, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(139, 69, 19, 0.05) 0%, transparent 50%);
  pointer-events: none;
}

.tree-header {
  text-align: center;
  padding: 2rem 2rem 1rem;
  position: relative;
  z-index: 1;
}

.tree-header h1 {
  font-size: 2.5rem;
  margin: 0 0 0.5rem;
  color: #daa520;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
}

.tree-header p {
  font-size: 1.1rem;
  margin: 0 0 1.5rem;
  opacity: 0.9;
}

.progress-bar {
  max-width: 400px;
  height: 6px;
  background: rgba(139, 69, 19, 0.5);
  border-radius: 3px;
  margin: 0 auto;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #daa520, #ffd700);
  transition: width 0.5s ease;
}

.tree-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
  position: relative;
  z-index: 1;
}

.current-node {
  background: rgba(139, 69, 19, 0.2);
  border: 2px solid #8b4513;
  border-radius: 20px;
  padding: 2rem;
  margin-bottom: 2rem;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.current-node:hover {
  border-color: #daa520;
  box-shadow: 0 10px 30px rgba(218, 165, 32, 0.2);
}

.node-content {
  text-align: center;
}

.node-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.node-content h2 {
  font-size: 2rem;
  margin: 0 0 1rem;
  color: #daa520;
}

.node-description {
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 2rem;
  opacity: 0.9;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.choices {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.choice-button {
  background: rgba(139, 69, 19, 0.3);
  border: 2px solid #8b4513;
  border-radius: 15px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  color: #f4e4bc;
  font-family: inherit;
}

.choice-button:hover {
  transform: translateY(-5px);
  border-color: #daa520;
  background: rgba(218, 165, 32, 0.2);
  box-shadow: 0 10px 25px rgba(218, 165, 32, 0.3);
}

.choice-military {
  border-left: 4px solid #dc143c;
}
.choice-economic {
  border-left: 4px solid #228b22;
}
.choice-diplomatic {
  border-left: 4px solid #4169e1;
}

.choice-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.choice-content h3 {
  margin: 0 0 0.5rem;
  color: #daa520;
  font-size: 1.3rem;
}

.choice-content p {
  margin: 0 0 0.8rem;
  opacity: 0.9;
  line-height: 1.4;
}

.choice-consequence {
  font-size: 0.9rem;
  font-style: italic;
  opacity: 0.7;
  color: #daa520;
}

.final-action {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 2rem;
}

.start-game-button,
.back-button {
  background: linear-gradient(45deg, #8b4513, #daa520);
  border: none;
  color: #f4e4bc;
  padding: 1rem 2rem;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.3s ease;
}

.start-game-button:hover,
.back-button:hover {
  background: linear-gradient(45deg, #daa520, #ffd700);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(218, 165, 32, 0.4);
}

.back-button {
  background: rgba(139, 69, 19, 0.5);
}

.back-button:hover {
  background: rgba(218, 165, 32, 0.3);
}

.path-visualization {
  margin-top: 2rem;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 15px;
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.path-nodes {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.path-node {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(139, 69, 19, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.path-node.active {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
}

.path-node:hover {
  background: rgba(218, 165, 32, 0.2);
  transform: scale(1.05);
}

.path-icon {
  font-size: 1.2rem;
}

.path-title {
  font-size: 0.9rem;
  font-weight: 500;
}

.path-arrow {
  margin: 0 0.5rem;
  color: #daa520;
  font-weight: bold;
}

.tree-footer {
  text-align: center;
  padding: 2rem;
  position: relative;
  z-index: 1;
}

.home-button {
  background: rgba(139, 69, 19, 0.4);
  border: 1px solid #8b4513;
  color: #f4e4bc;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.home-button:hover {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
}

/* Responsive */
@media (max-width: 768px) {
  .tree-header {
    padding: 1rem;
  }

  .tree-header h1 {
    font-size: 2rem;
  }

  .tree-container {
    padding: 1rem;
  }

  .current-node {
    padding: 1.5rem;
  }

  .choices {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .choice-button {
    padding: 1rem;
  }

  .path-nodes {
    flex-direction: column;
    align-items: stretch;
  }

  .path-arrow {
    transform: rotate(90deg);
    margin: 0.5rem 0;
  }
}
</style>

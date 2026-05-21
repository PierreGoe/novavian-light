/**
 * Script d'analyse d'équilibre économique — Novavian Light
 * Usage : node scripts/balance.mjs [durée_en_minutes]
 */

// ─── Données copiées depuis buildings.ts ──────────────────────────────────────

const BUILDINGS = {
  headquarters: {
    name: 'QG',
    maxLevel: 10,
    hqRequired: 0,
    productionPerLevel: null,
    levels: [
      { wood: 35, clay: 25, iron: 17, crop: 13 },
      { wood: 70, clay: 55, iron: 35, crop: 28 },
      { wood: 125, clay: 95, iron: 63, crop: 50 },
      { wood: 200, clay: 150, iron: 100, crop: 80 },
      { wood: 300, clay: 225, iron: 150, crop: 120 },
      { wood: 435, clay: 325, iron: 215, crop: 175 },
      { wood: 620, clay: 465, iron: 310, crop: 245 },
      { wood: 865, clay: 650, iron: 435, crop: 345 },
      { wood: 1200, clay: 900, iron: 600, crop: 480 },
      { wood: 1630, clay: 1225, iron: 815, crop: 650 },
    ],
  },
  barracks: {
    name: 'Casernes',
    maxLevel: 20,
    hqRequired: 3,
    productionPerLevel: null,
    levels: [
      { wood: 120, clay: 80, iron: 100, crop: 50 },
      { wood: 250, clay: 170, iron: 210, crop: 105 },
      { wood: 420, clay: 280, iron: 350, crop: 175 },
      { wood: 650, clay: 430, iron: 540, crop: 270 },
      { wood: 950, clay: 630, iron: 790, crop: 395 },
    ],
  },
  lumbermill: {
    name: 'Scierie',
    maxLevel: 20,
    hqRequired: 1,
    productionPerLevel: { resource: 'wood', amount: 10 },
    levels: [
      { wood: 8, clay: 40, iron: 22, crop: 15 },
      { wood: 18, clay: 85, iron: 45, crop: 32 },
      { wood: 30, clay: 143, iron: 77, crop: 53 },
      { wood: 47, clay: 223, iron: 120, crop: 83 },
      { wood: 68, clay: 330, iron: 177, crop: 123 },
    ],
  },
  farm: {
    name: 'Ferme',
    maxLevel: 20,
    hqRequired: 0,
    productionPerLevel: { resource: 'crop', amount: 12 },
    levels: [
      { wood: 27, clay: 32, iron: 13, crop: 5 },
      { wood: 57, clay: 67, iron: 28, crop: 10 },
      { wood: 95, clay: 113, iron: 48, crop: 18 },
      { wood: 148, clay: 177, iron: 75, crop: 28 },
      { wood: 217, clay: 260, iron: 110, crop: 42 },
    ],
  },
  quarry: {
    name: 'Carrière',
    maxLevel: 20,
    hqRequired: 1,
    productionPerLevel: { resource: 'clay', amount: 8 },
    levels: [
      { wood: 38, clay: 7, iron: 32, crop: 20 },
      { wood: 80, clay: 14, iron: 67, crop: 42 },
      { wood: 137, clay: 23, iron: 113, crop: 70 },
      { wood: 213, clay: 37, iron: 177, crop: 110 },
      { wood: 310, clay: 53, iron: 258, crop: 160 },
    ],
  },
  mine: {
    name: 'Mine',
    maxLevel: 20,
    hqRequired: 1,
    productionPerLevel: { resource: 'iron', amount: 6 },
    levels: [
      { wood: 43, clay: 35, iron: 6, crop: 15 },
      { wood: 92, clay: 73, iron: 13, crop: 32 },
      { wood: 155, clay: 125, iron: 21, crop: 53 },
      { wood: 242, clay: 195, iron: 33, crop: 83 },
      { wood: 353, clay: 285, iron: 49, crop: 122 },
    ],
  },
}

// ─── Paramètres ───────────────────────────────────────────────────────────────

const GAME_DURATION_MIN = parseFloat(process.argv[2] ?? '15')

// État initial réel (tous bâtiments niv. 1 dès le départ)
const INITIAL = {
  resources: { wood: 0, clay: 0, iron: 0, crop: 0 },
  production: { wood: 300, clay: 288, iron: 216, crop: 360 }, // /min
  levels: { headquarters: 1, barracks: 1, lumbermill: 1, farm: 1, quarry: 1, mine: 1 },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RESOURCES = ['wood', 'clay', 'iron', 'crop']
const ICONS = { wood: '🪵', clay: '🧱', iron: '⚒️', crop: '🌾' }
const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
}
const c = (col, str) => `${C[col]}${str}${C.reset}`

function getCost(type, level) {
  const def = BUILDINGS[type]
  return def.levels[Math.min(level, def.levels.length - 1)]
}

function totalCost(cost) {
  return cost.wood + cost.clay + cost.iron + cost.crop
}

// ─── Analyse ROI ──────────────────────────────────────────────────────────────

function analyzeROI() {
  console.log(c('cyan', '\n══════════════════════════════════════════════'))
  console.log(c('cyan', `  ANALYSE ROI — Partie de ${GAME_DURATION_MIN} minutes`))
  console.log(c('cyan', '══════════════════════════════════════════════'))
  console.log(c('dim', '  Production de départ : 🪵50 🧱48 ⚒️36 🌾60 /min'))
  console.log(c('dim', '  Tous les bâtiments démarrent niv. 1\n'))

  console.log(
    `  ${'Bâtiment'.padEnd(12)} ${'Niv'.padEnd(5)} ${'Coût Σ'.padEnd(10)} ${'Gain/min'.padEnd(10)} ${'ROI (min)'.padEnd(10)} Statut`,
  )
  console.log(`  ${'-'.repeat(62)}`)

  // Production totale au départ pour estimer le ROI "toutes ressources"
  const totalProd =
    INITIAL.production.wood +
    INITIAL.production.clay +
    INITIAL.production.iron +
    INITIAL.production.crop // 194/min

  for (const [type, def] of Object.entries(BUILDINGS)) {
    if (!def.productionPerLevel) continue
    const { amount } = def.productionPerLevel

    for (let lvl = 1; lvl < Math.min(6, def.levels.length + 1); lvl++) {
      const cost = getCost(type, lvl)
      const total = totalCost(cost)
      // ROI = temps pour que la production nette rembourse le coût total
      // On utilise la production totale disponible comme proxy du flux entrant
      const roi = total / totalProd

      let status
      if (roi < GAME_DURATION_MIN * 0.1) status = c('green', '✅ Court')
      else if (roi < GAME_DURATION_MIN * 0.25) status = c('green', '✅ OK')
      else if (roi < GAME_DURATION_MIN * 0.5) status = c('yellow', '⚠️  Limite')
      else status = c('red', '🔴 Trop long')

      const roiStr = roi.toFixed(1) + ' min'
      console.log(
        `  ${def.name.padEnd(12)} ${`${lvl}→${lvl + 1}`.padEnd(5)} ${String(total).padEnd(10)} ${String(amount).padEnd(10)} ${roiStr.padEnd(10)} ${status}`,
      )
    }
  }

  // Résumé QG (pas de production, mais c'est le coût le plus important)
  console.log()
  console.log(
    `  ${'QG'.padEnd(12)} ${'Niv'.padEnd(5)} ${'Coût Σ'.padEnd(10)} ${'Temps farm'.padEnd(10)}`,
  )
  console.log(`  ${'-'.repeat(42)}`)
  for (let lvl = 1; lvl <= 10; lvl++) {
    const cost = getCost('headquarters', lvl - 1)
    const total = totalCost(cost)
    const farmTime = (total / totalProd).toFixed(1)
    const mark =
      total / totalProd > GAME_DURATION_MIN * 0.5
        ? c('red', '🔴')
        : total / totalProd > GAME_DURATION_MIN * 0.25
          ? c('yellow', '⚠️ ')
          : c('green', '✅')
    console.log(
      `  ${'QG'.padEnd(12)} ${`${lvl - 1}→${lvl}`.padEnd(5)} ${String(total).padEnd(10)} ${(farmTime + ' min').padEnd(10)} ${mark}`,
    )
  }
}

// ─── Simulation de progression ────────────────────────────────────────────────

function simulate() {
  console.log(c('cyan', '\n══════════════════════════════════════════════'))
  console.log(c('cyan', `  SIMULATION — Progression sur ${GAME_DURATION_MIN} min`))
  console.log(c('cyan', '══════════════════════════════════════════════\n'))

  const res = { ...INITIAL.resources }
  const prod = { ...INITIAL.production }
  const levels = { ...INITIAL.levels }
  let time = 0

  const hqLevel = () => levels.headquarters

  const canAfford = (cost) =>
    res.wood >= cost.wood && res.clay >= cost.clay && res.iron >= cost.iron && res.crop >= cost.crop

  const spend = (cost) => {
    res.wood -= cost.wood
    res.clay -= cost.clay
    res.iron -= cost.iron
    res.crop -= cost.crop
  }

  const upgrade = (type) => {
    const def = BUILDINGS[type]
    const lvl = levels[type]
    if (lvl >= def.maxLevel || hqLevel() < def.hqRequired) return false
    const cost = getCost(type, lvl)
    if (!canAfford(cost)) return false
    spend(cost)
    levels[type]++
    if (def.productionPerLevel)
      prod[def.productionPerLevel.resource] += def.productionPerLevel.amount
    return true
  }

  const advance = (mins) => {
    RESOURCES.forEach((r) => {
      res[r] += prod[r] * mins
    })
    time += mins
  }

  const log = (action) => {
    const prodStr = RESOURCES.map((r) => `${ICONS[r]}${prod[r]}/min`).join(' ')
    const resStr = RESOURCES.map((r) => `${ICONS[r]}${Math.floor(res[r])}`).join(' ')
    console.log(`  ${c('dim', `[${time.toFixed(1)}min]`)} ${c('yellow', action)}`)
    console.log(`    ↳ Prod : ${prodStr}  |  Stock : ${resStr}\n`)
  }

  const waitAndDo = (type, label) => {
    let tries = 0
    while (!upgrade(type) && time < GAME_DURATION_MIN) {
      advance(0.25)
      if (++tries > 4000) break
    }
    if (time < GAME_DURATION_MIN) log(label)
  }

  const prodStr0 = RESOURCES.map((r) => `${ICONS[r]}${prod[r]}/min`).join(' ')
  console.log(`  Départ : ${prodStr0} | Tous bâtiments niv. 1\n`)

  // Progression en vagues : tous les bâtiments de ressources passent au même niveau
  // avant de passer au niveau suivant
  const PROD_BUILDINGS = ['lumbermill', 'farm', 'quarry', 'mine']
  const MAX_WAVE = 5

  for (let targetLevel = 2; targetLevel <= MAX_WAVE + 1; targetLevel++) {
    const waveStart = time
    console.log(c('cyan', `  ── Vague ${targetLevel - 1} : tous → niv. ${targetLevel} ──`))

    for (const type of PROD_BUILDINGS) {
      const def = BUILDINGS[type]
      const label = `${def.name} → niv. ${targetLevel}`
      let tries = 0
      while (!upgrade(type) && time < GAME_DURATION_MIN) {
        advance(0.1)
        if (++tries > 10000) break
      }
      if (time >= GAME_DURATION_MIN) break
      log(label)
    }

    if (time >= GAME_DURATION_MIN) break

    const waveDuration = (time - waveStart).toFixed(1)
    const totalProdNow = RESOURCES.reduce((s, r) => s + prod[r], 0)
    console.log(
      c('dim', `  → Vague terminée en ${waveDuration} min | Prod totale : ${totalProdNow}/min\n`),
    )
  }

  console.log(c('cyan', '─────────────────────────────────────────────'))
  console.log(`  Temps final : ${time.toFixed(1)} min / ${GAME_DURATION_MIN} min`)
  console.log()
  for (const [type, lvl] of Object.entries(levels)) {
    if (type === 'headquarters' || type === 'barracks') continue
    const bar = '█'.repeat(lvl) + '░'.repeat(Math.max(0, 6 - lvl))
    const prodDef = BUILDINGS[type].productionPerLevel
    const totalProd = prodDef ? prodDef.amount * lvl : 0
    const icon = prodDef ? ICONS[prodDef.resource] : '  '
    console.log(
      `    ${BUILDINGS[type].name.padEnd(12)} niv. ${String(lvl).padEnd(3)} ${bar}  ${icon}${totalProd}/min`,
    )
  }
}

// ─── Entrée ───────────────────────────────────────────────────────────────────

analyzeROI()
simulate()
console.log()

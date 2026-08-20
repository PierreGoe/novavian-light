import { test, expect } from '@playwright/test'

// vite.config.ts définit `base: '/novavian-light/'` : hors de la racine ('/', qui bénéficie
// d'une redirection + du script de restauration GitHub Pages), toute route de l'app n'est
// atteignable qu'avec ce préfixe.
const APP_BASE = '/novavian-light'

// Toutes les pages de jeu exigent une sauvegarde active : App.vue appelle gameStore.loadGame()
// au montage, qui redirige immédiatement vers '/' si aucune sauvegarde n'existe en
// localStorage — même en navigation directe vers une URL par ailleurs valide.
async function startNewGame(page: import('@playwright/test').Page) {
  await page.goto(`${APP_BASE}/`)
  await page.getByText('Nouvelle Partie').click()
  await expect(page).toHaveURL(new RegExp(`${APP_BASE}/race-selection`))
  await page.getByRole('heading', { name: 'Romains' }).click()
  await page.getByRole('button', { name: /Commencer avec/ }).click()
  await expect(page).toHaveURL(new RegExp(`${APP_BASE}/mission-tree`))
}

test('accueil affiche le titre du jeu', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('Novavian')
})

test('parcours: nouvelle partie -> choix de race -> arbre de mission', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await startNewGame(page)

  expect(errors).toEqual([])
})

test.describe('smoke: pages de jeu accessibles une fois une partie démarrée', () => {
  const routes = ['/mission-tree', '/campaign', '/campaign-score', '/inventory', '/bazar', '/settings']

  for (const route of routes) {
    test(route, async ({ page }) => {
      await startNewGame(page)

      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text())
      })

      const response = await page.goto(`${APP_BASE}${route}`)
      // .ok() exclut le 304 (Not Modified) que renvoie le serveur de dev Vite sur cache hit
      expect(response && response.status() < 400, `HTTP en erreur pour ${route}`).toBeTruthy()
      // pas de redirection silencieuse vers l'accueil (sauvegarde perdue, guard cassé, etc.)
      await expect(page).toHaveURL(new RegExp(`${APP_BASE}${route}$`))
      expect(errors, `Erreurs JS sur ${route}:\n${errors.join('\n')}`).toEqual([])
    })
  }
})

test('page de jeu sans sauvegarde: redirection propre vers l\'accueil', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(`${APP_BASE}/mission-tree`)

  await expect(page).toHaveURL(new RegExp(`${APP_BASE}/$`))
  await expect(page.locator('h1')).toHaveText('Novavian')
  expect(errors).toEqual([])
})

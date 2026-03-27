/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string
  readonly VITE_MAX_OFFLINE_MS: string
  readonly VITE_ENEMY_BASE_INFANTRY: string
  readonly VITE_ENEMY_STRONGHOLD_INFANTRY: string
  readonly VITE_SCOUT_MISSION_DURATION_MS: string
  readonly VITE_AUTOSAVE_INTERVAL_MS: string
  readonly VITE_PRODUCTION_INTERVAL_MS: string
  readonly VITE_DISABLE_FOG_OF_WAR: string
  readonly VITE_CHEAT_RESOURCES: string
  readonly VITE_CHEAT_VICTORY_POINTS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

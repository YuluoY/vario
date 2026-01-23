/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string
  readonly GITHUB_REPOSITORY?: string
  readonly VITE_GITHUB_REPOSITORY?: string
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

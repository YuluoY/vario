export type MaterialManifest = {
  name: string
  type?: string
  version: string
  props?: Record<string, unknown>
  events?: string[] | Readonly<Record<string, unknown>>
  slots?: string[] | Readonly<Record<string, unknown>>
  models?: string[] | Readonly<Record<string, unknown>>
  capabilities?: string[]
  migrations?: readonly unknown[]
}

export type CapabilityManifest = {
  name: string
  pure: boolean
  cost: number
  inputLimit: number
  allowInExpression: boolean
}

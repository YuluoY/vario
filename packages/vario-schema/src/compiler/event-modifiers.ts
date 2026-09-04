import { VarioError, ErrorCodes } from '@variojs/core'

export const EVENT_MODIFIERS = {
  event: ['stop', 'prevent', 'self', 'once', 'capture', 'passive', 'native'] as const,
  key: ['enter', 'tab', 'delete', 'esc', 'space', 'up', 'down', 'left', 'right'] as const,
  system: ['ctrl', 'alt', 'shift', 'meta', 'exact'] as const,
  mouse: ['left', 'right', 'middle'] as const
}

const ALLOWED = new Set<string>([
  ...EVENT_MODIFIERS.event,
  ...EVENT_MODIFIERS.key,
  ...EVENT_MODIFIERS.system,
  ...EVENT_MODIFIERS.mouse
])

export function assertSupportedModifiers(eventKey: string, path: string): void {
  const parts = eventKey.split('.')
  for (const mod of parts.slice(1)) {
    if (!ALLOWED.has(mod)) {
      throw new VarioError(
        `Unsupported event modifier ".${mod}" on "${eventKey}"`,
        ErrorCodes.UNSUPPORTED_EVENT_MODIFIER,
        { schemaPath: path, metadata: { modifier: mod, phase: 'prepare' } }
      )
    }
  }
}

export function isSupportedModifier(name: string): boolean {
  return ALLOWED.has(name)
}

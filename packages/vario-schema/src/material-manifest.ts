import type { MaterialManifest } from '@variojs/types'

export type { MaterialManifest }

export type ManifestIssue = { field: string; message: string }

export function validateMaterialManifest(value: unknown): { valid: boolean; errors: ManifestIssue[] } {
  const errors: ManifestIssue[] = []
  if (!value || typeof value !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'manifest must be an object' }] }
  }
  const rec = value as Record<string, unknown>
  const name = typeof rec.name === 'string' && rec.name
    ? rec.name
    : (typeof rec.type === 'string' ? rec.type : '')
  if (!name) errors.push({ field: 'name', message: 'name or type is required' })
  if (rec.type != null && typeof rec.type !== 'string') errors.push({ field: 'type', message: 'type must be a string' })
  if (typeof rec.version !== 'string' || !rec.version) errors.push({ field: 'version', message: 'version is required' })
  if (rec.props != null && (typeof rec.props !== 'object' || Array.isArray(rec.props))) {
    errors.push({ field: 'props', message: 'props must be an object' })
  }
  if (rec.events != null && !Array.isArray(rec.events) && (typeof rec.events !== 'object')) {
    errors.push({ field: 'events', message: 'events must be a string array or object' })
  }
  for (const field of ['slots', 'models'] as const) {
    if (rec[field] != null && !Array.isArray(rec[field]) && (typeof rec[field] !== 'object')) {
      errors.push({ field, message: `${field} must be a string array or object` })
    }
  }
  if (rec.capabilities != null && !Array.isArray(rec.capabilities)) {
    errors.push({ field: 'capabilities', message: 'capabilities must be a string array' })
  }
  return { valid: errors.length === 0, errors }
}

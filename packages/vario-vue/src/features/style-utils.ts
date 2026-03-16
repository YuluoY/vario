/**
 * 样式字符串 → 对象转换工具
 *
 * attrs-builder / vario-node / renderer 三处共用，消除重复代码。
 */

/**
 * 将 CSS 样式字符串解析为对象
 *
 * @param style  CSS 字符串，如 "color: red; font-size: 14px"
 * @param camelCase  是否将 kebab-case 转为 camelCase（默认 true）
 */
export function parseStyleString(
  style: string,
  camelCase = true
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rule of style.split(';')) {
    const colonIdx = rule.indexOf(':')
    if (colonIdx === -1) continue
    const key = rule.slice(0, colonIdx).trim()
    const value = rule.slice(colonIdx + 1).trim()
    if (!key || !value) continue
    const finalKey = camelCase
      ? key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
      : key
    result[finalKey] = value
  }
  return result
}

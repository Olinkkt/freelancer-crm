export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${Date.now()}-${rand}`
}

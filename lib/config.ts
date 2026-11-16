/**
 * Client-accessible configuration with sensible defaults.
 * Configured via NEXT_PUBLIC_* environment variables or fallback values.
 */

export interface OperatorConfig {
  name: string
  firstName: string
  email: string
  role: string
  currency: string
  currencySymbol: string
  locale: string
  appTitle: string
}

export const OPERATOR_CONFIG: OperatorConfig = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME || 'Alex Rivera',
  firstName: (process.env.NEXT_PUBLIC_OPERATOR_NAME || 'Alex Rivera').trim().split(' ')[0],
  email: process.env.NEXT_PUBLIC_OPERATOR_EMAIL || 'alex@example.com',
  role: process.env.NEXT_PUBLIC_OPERATOR_ROLE || 'Full-Stack & Product Engineer',
  currency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'USD',
  currencySymbol: process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$',
  locale: process.env.NEXT_PUBLIC_LOCALE || 'en-US',
  appTitle: process.env.NEXT_PUBLIC_APP_TITLE || 'Freelancer CRM',
}

/**
 * Formats a numeric currency amount using the configured currency and locale.
 */
export function formatMoney(
  amount: number,
  settings?: { currency?: string; currencySymbol?: string; locale?: string }
): string {
  const symbol = (settings?.currencySymbol || OPERATOR_CONFIG.currencySymbol || '$').trim()
  const locale = settings?.locale || OPERATOR_CONFIG.locale || 'en-US'
  const formatted = amount.toLocaleString(locale).replace(/\s/g, ' ')
  // Check if symbol goes before (e.g., $, €, £, ¥) or after (e.g., Kč, CHF)
  if (['$', '€', '£', '¥'].includes(symbol)) {
    return `${symbol}${formatted}`
  }
  return `${formatted} ${symbol}`
}

/**
 * Reads an amount someone typed ("25 000 Kč", "$1,500.50", "1.234,56") as a whole number.
 * Stripping every non-digit would turn 1500.50 into 150050, so the last separator
 * counts as a decimal point unless it is followed by exactly three digits.
 */
export function parseMoneyInput(text: string | number | null | undefined): number {
  if (typeof text === 'number') return Number.isFinite(text) ? Math.round(text) : 0
  const s = String(text ?? '').replace(/[^0-9.,]/g, '')
  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'))
  if (lastSep === -1) return parseInt(s, 10) || 0

  const sep = s[lastSep]
  const tail = s.slice(lastSep + 1)
  const sepCount = s.split(sep).length - 1
  const mixed = s.includes(sep === ',' ? '.' : ',')
  const isDecimal = sepCount === 1 && tail.length > 0 && (tail.length !== 3 || mixed)

  const whole = (isDecimal ? s.slice(0, lastSep) : s).replace(/[.,]/g, '')
  const amount = Number(isDecimal ? `${whole || '0'}.${tail}` : whole)
  return Number.isFinite(amount) ? Math.round(amount) : 0
}

/**
 * Formats a deal value (string or number) into standard localized currency.
 */
export function formatDealValue(
  value: string | number,
  settings?: { currency?: string; currencySymbol?: string; locale?: string }
): string {
  if (typeof value === 'number') return formatMoney(value, settings)
  const numeric = parseMoneyInput(value)
  if (numeric === 0) {
    const symbol = (settings?.currencySymbol || OPERATOR_CONFIG.currencySymbol || '$').trim()
    if (['$', '€', '£', '¥'].includes(symbol)) return `${symbol}0`
    return `0 ${symbol}`
  }
  return formatMoney(numeric, settings)
}


/**
 * Returns initials from full operator name (e.g. "Oliver Seidl" -> "OS")
 */
export function getOperatorInitials(name: string = OPERATOR_CONFIG.name): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return 'OP'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

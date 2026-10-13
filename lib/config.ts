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
 * Formats a deal value (string or number) into standard localized currency.
 */
export function formatDealValue(
  value: string | number,
  settings?: { currency?: string; currencySymbol?: string; locale?: string }
): string {
  if (typeof value === 'number') return formatMoney(value, settings)
  const numeric = parseInt(String(value).replace(/[^0-9]/g, ''), 10)
  if (isNaN(numeric) || numeric === 0) {
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

export type SqlDialect = 'sqlite' | 'postgres'

export function getDialect(url: string | undefined = process.env.DATABASE_URL): SqlDialect {
  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    return 'postgres'
  }
  return 'sqlite'
}

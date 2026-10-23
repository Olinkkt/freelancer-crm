export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DEAL_ALREADY_HAS_PROJECT'
  | 'STAGE_TRANSITION_NOT_ALLOWED'
  | 'USE_CLOSE_PROJECT'
  | 'USE_REOPEN_PROJECT'
  | 'ARCHIVE_NOT_ALLOWED'
  | 'INVOICES_UNRESOLVED'
  | 'INVOICE_TRANSITION_NOT_ALLOWED'
  | 'MILESTONE_TRANSITION_NOT_ALLOWED'
  | 'STAGE_IN_USE'
  | 'LAST_STAGE_IN_CATEGORY'
  | 'BUILTIN_TEMPLATE_READONLY'
  | 'SHORTCUT_CONFLICT'
  | 'SHORTCUT_LOCKED'
  | 'INTERNAL'

export class DomainError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

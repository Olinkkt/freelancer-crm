import type { ProjectStage, StageCategory } from './types'

export type StageChangePlan =
  | {
      ok: true
      patch: {
        stage_id: string
        stage_changed_at: string
        updated_at: string
        waiting_since_date?: string | null
        delivered_at?: string | null
      }
    }
  | {
      ok: false
      code: 'USE_CLOSE_PROJECT' | 'USE_REOPEN_PROJECT' | 'STAGE_TRANSITION_NOT_ALLOWED'
    }

export interface ProjectLikeForStageChange {
  id: string
  waiting_since_date?: string | null
  waitingSinceDate?: string | null
  delivered_at?: string | null
  deliveredAt?: string | null
}

/**
 * Plans a stage transition according to the table in §8.1
 */
export function planStageChange(
  project: ProjectLikeForStageChange,
  from: ProjectStage,
  to: ProjectStage,
  now: string,
  today: string
): StageChangePlan {
  const fromCat = from.category as StageCategory
  const toCat = to.category as StageCategory

  // T12: leaving closed is not allowed via moveProjectStageAction
  if (fromCat === 'closed' && toCat !== 'closed') {
    return { ok: false, code: 'USE_REOPEN_PROJECT' }
  }

  // T10: entering closed is not allowed via moveProjectStageAction
  if (toCat === 'closed' && fromCat !== 'closed') {
    return { ok: false, code: 'USE_CLOSE_PROJECT' }
  }

  // Same category: always allowed
  if (fromCat === toCat) {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
      },
    }
  }

  const waitingSince =
    project.waiting_since_date !== undefined
      ? project.waiting_since_date
      : project.waitingSinceDate ?? null

  const deliveredAt =
    project.delivered_at !== undefined
      ? project.delivered_at
      : project.deliveredAt ?? null

  // T2: planned -> active
  if (fromCat === 'planned' && toCat === 'active') {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
      },
    }
  }

  // T3: active -> review
  if (fromCat === 'active' && toCat === 'review') {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
        waiting_since_date: waitingSince ?? today,
      },
    }
  }

  // T4: review -> active
  if (fromCat === 'review' && toCat === 'active') {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
        waiting_since_date: null,
      },
    }
  }

  // T5: active / review -> delivered
  if ((fromCat === 'active' || fromCat === 'review') && toCat === 'delivered') {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
        delivered_at: deliveredAt ?? now,
        waiting_since_date: null,
      },
    }
  }

  // T6: delivered -> active / review
  if (fromCat === 'delivered' && toCat === 'active') {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
        delivered_at: null,
        waiting_since_date: null,
      },
    }
  }
  if (fromCat === 'delivered' && toCat === 'review') {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
        delivered_at: null,
        waiting_since_date: waitingSince ?? today,
      },
    }
  }

  // T7: planned -> review / delivered
  if (fromCat === 'planned' && toCat === 'review') {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
        waiting_since_date: waitingSince ?? today,
      },
    }
  }
  if (fromCat === 'planned' && toCat === 'delivered') {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
        delivered_at: deliveredAt ?? now,
        waiting_since_date: null,
      },
    }
  }

  // T8: review / delivered / active -> planned
  if ((fromCat === 'review' || fromCat === 'delivered' || fromCat === 'active') && toCat === 'planned') {
    return {
      ok: true,
      patch: {
        stage_id: to.id,
        stage_changed_at: now,
        updated_at: now,
        waiting_since_date: null,
        delivered_at: null,
      },
    }
  }

  return { ok: false, code: 'STAGE_TRANSITION_NOT_ALLOWED' }
}

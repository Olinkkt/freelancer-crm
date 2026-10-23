import { sql } from 'kysely'
import type { Migration } from './types'
import { convertLegacyDeal, type LegacyContext } from '@/lib/projects/legacy'
import { OPERATOR_CONFIG } from '@/lib/config'
import type { StageCategory } from '@/lib/projects/constants'

export const m003: Migration = {
  version: 3,
  name: '003-legacy-pm',
  up: async (trx, dialect) => {
    // 1. Get workspace settings for currency
    const settings = await trx
      .selectFrom('workspace_settings')
      .selectAll()
      .where('id', '=', 'current')
      .executeTakeFirst()

    const currency = settings?.currency || OPERATOR_CONFIG.currency

    // 2. Query stages to find first stage of each category
    const stages = await trx
      .selectFrom('project_stages')
      .selectAll()
      .orderBy('position', 'asc')
      .execute()

    const stageIds: Record<StageCategory, string> = {
      planned: 'stg-planned',
      active: 'stg-active',
      review: 'stg-review',
      delivered: 'stg-delivered',
      closed: 'stg-closed',
    }

    for (const stg of stages) {
      const cat = stg.category as StageCategory
      if (stg.id && (!stageIds[cat] || stageIds[cat] === `stg-${cat}`)) {
        stageIds[cat] = stg.id
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const ctx: LegacyContext = {
      today,
      currency,
      stageIds,
    }

    // 3. Process deals
    const deals = await trx.selectFrom('deals').selectAll().execute()

    for (const deal of deals) {
      const conversion = convertLegacyDeal(deal as any, ctx)

      if (conversion.project) {
        // Check if project exists by id or deal_id
        const existingProject = await trx
          .selectFrom('projects')
          .select(['id', 'deal_id'])
          .where((eb) =>
            eb.or([
              eb('id', '=', conversion.project!.id),
              eb('deal_id', '=', deal.id),
            ])
          )
          .executeTakeFirst()

        if (!existingProject) {
          // Insert project
          await trx.insertInto('projects').values(conversion.project).execute()

          // Insert milestones
          if (conversion.milestones.length > 0) {
            await trx.insertInto('project_milestones').values(conversion.milestones).execute()
          }

          // Insert tasks
          if (conversion.tasks.length > 0) {
            await trx.insertInto('project_tasks').values(conversion.tasks).execute()
          }

          // Insert invoices
          if (conversion.invoices.length > 0) {
            await trx.insertInto('invoices').values(conversion.invoices).execute()
          }
        }
      }

      // Apply deal patch if any
      if (conversion.dealPatch && Object.keys(conversion.dealPatch).length > 0) {
        await trx
          .updateTable('deals')
          .set(conversion.dealPatch)
          .where('id', '=', deal.id)
          .execute()
      }

      // Insert normalization activity if any
      if (conversion.activity) {
        const existingAct = await trx
          .selectFrom('activities')
          .select('id')
          .where('id', '=', conversion.activity.id)
          .executeTakeFirst()
        if (!existingAct) {
          await trx.insertInto('activities').values(conversion.activity).execute()
        }
      }
    }
  },
}

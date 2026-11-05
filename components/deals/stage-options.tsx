import React from 'react'
import { DEAL_STAGE_HINTS, OPEN_DEAL_STAGES, PM_STAGES } from '@/lib/crm-types'

/** <option>s for a stage <select>, grouped CRM (still winning it) / PM (signed) */
export function StageOptions() {
  return (
    <>
      <optgroup label="CRM">
        {OPEN_DEAL_STAGES.map((s) => (
          <option key={s} value={s} title={DEAL_STAGE_HINTS[s]}>
            {s}
          </option>
        ))}
      </optgroup>
      <optgroup label="PM">
        {PM_STAGES.map((s) => (
          <option key={s} value={s} title={DEAL_STAGE_HINTS[s]}>
            {s}
          </option>
        ))}
      </optgroup>
    </>
  )
}

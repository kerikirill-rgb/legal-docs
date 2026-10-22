const BASE = process.env.BITRIX_WEBHOOK_URL?.replace(/\/$/, '')

function requireWebhook() {
  if (!BASE) {
    throw new Error('BITRIX_WEBHOOK_URL is not configured')
  }
}

async function bitrixCall(method, body = {}) {
  requireWebhook()
  const url = `${BASE}/${method}.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) {
    const err = new Error(data.error_description || data.error)
    err.bitrix = data
    throw err
  }
  return data.result
}

/** @param {{ title: string, stageId?: string, comments?: string, contactPhone?: string }} p */
export async function createDeal(p) {
  const fields = {
    title: p.title,
    stageId: p.stageId || 'NEW',
    ...(p.comments ? { COMMENTS: p.comments } : {}),
  }
  return bitrixCall('crm.item.add', {
    entityTypeId: 2,
    fields,
  })
}

/** @param {{ title: string, description?: string, responsibleId?: number }} p */
export async function createTask(p) {
  return bitrixCall('tasks.task.add', {
    fields: {
      TITLE: p.title,
      ...(p.description ? { DESCRIPTION: p.description } : {}),
      ...(p.responsibleId ? { RESPONSIBLE_ID: p.responsibleId } : {}),
    },
  })
}

/** @param {{ ownerTypeId: number, ownerId: number, subject: string, description: string }} p */
export async function addTimelineComment(p) {
  return bitrixCall('crm.timeline.comment.add', {
    fields: {
      ENTITY_ID: p.ownerId,
      ENTITY_TYPE: p.ownerTypeId === 2 ? 'deal' : 'lead',
      COMMENT: p.description,
    },
  })
}

export async function applyActions(actions, contact) {
  const results = []
  for (const action of actions) {
    if (!action.approved) continue
    switch (action.type) {
      case 'crm_note': {
        const title = `[Звонок] ${contact.company || ''} ${contact.lastName} ${contact.firstName}`.trim()
        const dealId = await createDeal({
          title,
          comments: action.summary || action.body,
        })
        results.push({ type: action.type, dealId })
        break
      }
      case 'task': {
        const taskId = await createTask({
          title: action.title || `После звонка: ${contact.lastName}`,
          description: action.body,
        })
        results.push({ type: action.type, taskId })
        break
      }
      case 'email_draft':
        results.push({
          type: action.type,
          status: 'draft_only',
          to: action.to,
          subject: action.subject,
          body: action.body,
        })
        break
      case 'send_commercial_offer':
        results.push({
          type: action.type,
          status: 'manual',
          note: action.note || 'Отправьте КП по шаблону из CRM',
        })
        break
      default:
        results.push({ type: action.type, status: 'skipped' })
    }
  }
  return results
}

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

/** @param {string} phone */
export async function findLeadByPhone(phone) {
  const digits = phone.replace(/\D/g, '')
  try {
    const found = await bitrixCall('crm.duplicate.findbycomm', {
      type: 'PHONE',
      values: [phone, digits, `+${digits}`],
    })
    if (found?.LEAD?.length) return { entityTypeId: 1, id: found.LEAD[0] }
    if (found?.CONTACT?.length) return { entityTypeId: 3, id: found.CONTACT[0] }
    if (found?.COMPANY?.length) return { entityTypeId: 4, id: found.COMPANY[0] }
  } catch {
    /* duplicate search optional */
  }
  return null
}

/** @param {ContactLike} contact @param {{ summary?: string, stageId?: string }} extra */
export async function createLead(contact, extra = {}) {
  const title =
    extra.title ||
    `[Звонок] ${[contact.company, contact.lastName, contact.firstName].filter(Boolean).join(' ')}`.trim()
  const fields = {
    title,
    name: contact.firstName || '',
    lastName: contact.lastName || '',
    companyTitle: contact.company || '',
    ...(contact.email ? { email: [{ VALUE: contact.email, VALUE_TYPE: 'WORK' }] } : {}),
    ...(contact.phone
      ? { phone: [{ VALUE: contact.phone, VALUE_TYPE: 'WORK' }] }
      : {}),
    ...(extra.summary ? { comments: extra.summary } : {}),
    ...(extra.stageId || process.env.BITRIX_LEAD_STAGE_ID
      ? { stageId: extra.stageId || process.env.BITRIX_LEAD_STAGE_ID }
      : {}),
  }
  return bitrixCall('crm.item.add', { entityTypeId: 1, fields })
}

/** @param {number|string} id @param {string} stageId */
export async function updateLeadStage(id, stageId) {
  return bitrixCall('crm.item.update', {
    entityTypeId: 1,
    id,
    fields: { stageId },
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

/** @param {{ ownerTypeId: number, ownerId: number, description: string }} p */
export async function addTimelineComment(p) {
  const entityType =
    p.ownerTypeId === 2 ? 'deal' : p.ownerTypeId === 1 ? 'lead' : p.ownerTypeId === 3 ? 'contact' : 'company'
  return bitrixCall('crm.timeline.comment.add', {
    fields: {
      ENTITY_ID: p.ownerId,
      ENTITY_TYPE: entityType,
      COMMENT: p.description,
    },
  })
}

export async function applyActions(actions, contact) {
  const results = []
  let linked = await findLeadByPhone(contact.phone)

  for (const action of actions) {
    if (!action.approved) continue
    switch (action.type) {
      case 'crm_note':
      case 'lead': {
        if (linked?.entityTypeId === 1) {
          if (action.stageId) await updateLeadStage(linked.id, action.stageId)
          if (action.summary || action.body) {
            await addTimelineComment({
              ownerTypeId: 1,
              ownerId: linked.id,
              description: action.summary || action.body,
            })
          }
          results.push({ type: action.type, leadId: linked.id, updated: true })
        } else {
          const leadId = await createLead(contact, {
            summary: action.summary || action.body,
            stageId: action.stageId,
          })
          linked = { entityTypeId: 1, id: leadId }
          results.push({ type: action.type, leadId })
        }
        break
      }
      case 'task': {
        const taskId = await createTask({
          title: action.title || `После звонка: ${contact.lastName || contact.company}`,
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

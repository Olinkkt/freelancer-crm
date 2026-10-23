import test from 'node:test'
import assert from 'node:assert/strict'
import { GET as getProjects, POST as postProjects } from '@/app/api/projects/route'
import { GET as getProjectById } from '@/app/api/projects/[id]/route'
import { POST as postProjectTask } from '@/app/api/projects/[id]/tasks/route'
import { PATCH as patchInvoice } from '@/app/api/invoices/[id]/route'
import { ensureDbInitialized } from '@/lib/db/init'
import { db } from '@/lib/db/client'
import { createSessionToken } from '@/lib/auth/session'

test('Projects REST API Endpoints (§9.5)', async (t) => {
  await ensureDbInitialized()
  const secret = 'test-secret-projects-api-32chars!'
  process.env.AUTH_SECRET = secret

  t.after(() => {
    delete process.env.AUTH_SECRET
  })

  const token = createSessionToken()
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  const today = '2026-10-24'

  await t.test('GET /api/projects: auth and validation', async () => {
    // 401 when unauthenticated
    const unauthedReq = new Request('http://localhost:3000/api/projects?today=2026-10-24', {
      method: 'GET',
    })
    const unauthedRes = await getProjects(unauthedReq)
    assert.equal(unauthedRes.status, 401)

    // 400 when today is missing
    const missingTodayReq = new Request('http://localhost:3000/api/projects', {
      method: 'GET',
      headers: authHeaders,
    })
    const missingTodayRes = await getProjects(missingTodayReq)
    assert.equal(missingTodayRes.status, 400)
    const errData = await missingTodayRes.json()
    assert.equal(errData.error.code, 'VALIDATION')

    // 200 on valid request
    const validReq = new Request('http://localhost:3000/api/projects?today=2026-10-24&archived=0', {
      method: 'GET',
      headers: authHeaders,
    })
    const validRes = await getProjects(validReq)
    assert.equal(validRes.status, 200)
    const list = await validRes.json()
    assert.ok(Array.isArray(list))
  })

  await t.test('POST /api/projects: validation, conflict, and creation', async () => {
    // 400 on Zod validation failure
    const badBodyReq = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: '' }), // Invalid title
    })
    const badBodyRes = await postProjects(badBodyReq)
    assert.equal(badBodyRes.status, 400)
    const badBodyData = await badBodyRes.json()
    assert.equal(badBodyData.error.code, 'VALIDATION')

    // 201 on valid project creation
    const createReq = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'REST API Project',
        company: 'RestCorp',
        startDate: '2026-10-01',
        today,
      }),
    })
    const createRes = await postProjects(createReq)
    assert.equal(createRes.status, 201)
    const createdProject = await createRes.json()
    assert.ok(createdProject.project.id)
    assert.equal(createdProject.project.title, 'REST API Project')

    // 409 when deal already has a project
    const dealId = `deal-api-${Date.now()}`
    await db.insertInto('deals').values({
      id: dealId,
      title: 'Conflict Deal',
      company: 'Conflict Corp',
      value: '50 000 Kč',
      raw_amount: 50000,
      stage: 'Won',
      probability: '100%',
      next: 'Start',
      color: 'blue',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute()

    const p1Req = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Project Deal 1',
        company: 'Conflict Corp',
        dealId,
        startDate: '2026-10-01',
        today,
      }),
    })
    const p1Res = await postProjects(p1Req)
    assert.equal(p1Res.status, 201)

    // Second project with same dealId -> 409 Conflict
    const p2Req = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Project Deal 2',
        company: 'Conflict Corp',
        dealId,
        startDate: '2026-10-01',
        today,
      }),
    })
    const p2Res = await postProjects(p2Req)
    assert.equal(p2Res.status, 409)
    const conflictData = await p2Res.json()
    assert.equal(conflictData.error.code, 'DEAL_ALREADY_HAS_PROJECT')
  })

  await t.test('GET /api/projects/[id]: 404 and 200', async () => {
    // 404 when project not found
    const notFoundReq = new Request('http://localhost:3000/api/projects/prj-nonexistent?today=2026-10-24', {
      method: 'GET',
      headers: authHeaders,
    })
    const notFoundRes = await getProjectById(notFoundReq, { params: Promise.resolve({ id: 'prj-nonexistent' }) })
    assert.equal(notFoundRes.status, 404)

    // 201 create then 200 get
    const createReq = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Detail Fetch Project',
        company: 'DetailCorp',
        startDate: '2026-10-01',
        today,
      }),
    })
    const createRes = await postProjects(createReq)
    const detailCreated = await createRes.json()
    const projectId = detailCreated.project.id

    const getReq = new Request(`http://localhost:3000/api/projects/${projectId}?today=2026-10-24`, {
      method: 'GET',
      headers: authHeaders,
    })
    const getRes = await getProjectById(getReq, { params: Promise.resolve({ id: projectId }) })
    assert.equal(getRes.status, 200)
    const getDetail = await getRes.json()
    assert.equal(getDetail.project.id, projectId)
    assert.equal(getDetail.project.company, 'DetailCorp')
  })

  await t.test('POST /api/projects/[id]/tasks: 400, 404 and 201', async () => {
    // 404 when project does not exist
    const notFoundReq = new Request('http://localhost:3000/api/projects/prj-ghost/tasks', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: 'Ghost task' }),
    })
    const notFoundRes = await postProjectTask(notFoundReq, { params: Promise.resolve({ id: 'prj-ghost' }) })
    assert.equal(notFoundRes.status, 404)

    // Create real project
    const createReq = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Task Parent Project',
        company: 'ParentCorp',
        startDate: '2026-10-01',
        today,
      }),
    })
    const createRes = await postProjects(createReq)
    const detail = await createRes.json()
    const projectId = detail.project.id

    // 400 on empty title
    const badTaskReq = new Request(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: '' }),
    })
    const badTaskRes = await postProjectTask(badTaskReq, { params: Promise.resolve({ id: projectId }) })
    assert.equal(badTaskRes.status, 400)

    // 201 on valid task
    const validTaskReq = new Request(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: 'First API Task', dueDate: '2026-10-31' }),
    })
    const validTaskRes = await postProjectTask(validTaskReq, { params: Promise.resolve({ id: projectId }) })
    assert.equal(validTaskRes.status, 201)
    const taskData = await validTaskRes.json()
    assert.ok(taskData.id)
    assert.equal(taskData.title, 'First API Task')
  })

  await t.test('PATCH /api/invoices/[id]: 400, 404, 409 and 200', async () => {
    // 404 when invoice does not exist
    const notFoundReq = new Request('http://localhost:3000/api/invoices/inv-missing', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'sent', today }),
    })
    const notFoundRes = await patchInvoice(notFoundReq, { params: Promise.resolve({ id: 'inv-missing' }) })
    assert.equal(notFoundRes.status, 404)

    // Create project with website template (has invoices)
    const createReq = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Invoice API Project',
        company: 'InvCorp',
        templateId: 'tpl-website',
        budgetMinor: 100000,
        startDate: '2026-10-01',
        today,
      }),
    })
    const createRes = await postProjects(createReq)
    const detail = await createRes.json()
    const invoice = detail.invoices[0]
    assert.ok(invoice)
    const invoiceId = invoice.id

    // 409 on transition not allowed (draft -> draft)
    const illegalReq = new Request(`http://localhost:3000/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'draft', today }),
    })
    const illegalRes = await patchInvoice(illegalReq, { params: Promise.resolve({ id: invoiceId }) })
    assert.equal(illegalRes.status, 409)
    const illegalData = await illegalRes.json()
    assert.equal(illegalData.error.code, 'INVOICE_TRANSITION_NOT_ALLOWED')

    // 200 on transition draft -> sent
    const validReq = new Request(`http://localhost:3000/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'sent', today }),
    })
    const validRes = await patchInvoice(validReq, { params: Promise.resolve({ id: invoiceId }) })
    assert.equal(validRes.status, 200)
    const updatedInvoice = await validRes.json()
    assert.equal(updatedInvoice.status, 'sent')
    assert.equal(updatedInvoice.issueDate, today)
  })
})

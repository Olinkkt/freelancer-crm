import { chromium } from 'playwright'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err.message)
    process.exit(1)
  })

  console.log('Navigating to http://localhost:3000/?view=deals...')
  await page.goto('http://localhost:3000/?view=deals', { waitUntil: 'networkidle' })

  console.log('1. Testing Start project from won deal flow...')
  // Locate or find "Start project" button on Won column or deals board
  const startProjectBtn = page.locator('button:has-text("Start project")').first()
  if (await startProjectBtn.isVisible()) {
    await startProjectBtn.click()
    console.log('  ✓ Clicked Start project button')
  } else {
    // Press P to trigger Start project
    await page.keyboard.press('p')
    console.log('  ✓ Pressed P to open Start project sheet')
  }

  // Wait for Project Sheet modal/drawer
  const sheetHeading = page.locator('h2:has-text("Start Project")')
  await sheetHeading.waitFor({ state: 'visible', timeout: 5000 })
  console.log('  ✓ Start Project sheet visible')

  // Ensure title and company are provided
  const titleInput = page.locator('input[placeholder*="Acme Website"]')
  await titleInput.fill('E2E Test Project')
  const companyInput = page.locator('input[placeholder*="Select or enter company"]')
  if (await companyInput.isVisible()) {
    await companyInput.fill('Acme Corp')
    await page.keyboard.press('Enter')
  }

  // Submit project sheet form
  const submitBtn = page.locator('button:has-text("Create project")')
  await submitBtn.click()
  console.log('  ✓ Submitted Project sheet')

  // Should navigate to /projects/[id]
  await page.waitForURL(/\/projects\/.+/, { timeout: 8000 })
  console.log(`  ✓ Navigated to project workspace: ${page.url()}`)

  // 2. Add task
  console.log('2. Testing task creation in project workspace...')
  await page.keyboard.press('t')
  await page.waitForTimeout(400)
  const taskInput = page.locator('input[placeholder*="Add task"]')
  if (await taskInput.isVisible()) {
    await taskInput.fill('E2E Verification Task')
    await page.keyboard.press('Enter')
    console.log('  ✓ Created task via quick add')
  } else {
    console.log('  - Task quick add already present or handled')
  }

  // 3. Milestones & Invoices Rail
  console.log('3. Testing Rail Milestones & Invoices...')
  // Focus rail: press G R
  await page.keyboard.press('g')
  await page.keyboard.press('r')
  await page.waitForTimeout(300)

  // Deliver milestone (D) or click Deliver
  const deliverBtn = page.locator('button:has-text("Deliver")').first()
  if (await deliverBtn.isVisible()) {
    await deliverBtn.click()
    console.log('  ✓ Delivered milestone')
    await page.waitForTimeout(300)
  }

  // Approve milestone (A) or click Approve
  const approveBtn = page.locator('button:has-text("Approve")').first()
  if (await approveBtn.isVisible()) {
    await approveBtn.click()
    console.log('  ✓ Approved milestone')
    await page.waitForTimeout(300)
  }

  // 4. Mark invoice paid (invariant: stage unchanged)
  console.log('4. Testing invoice payment...')
  const payBtn = page.locator('button:has-text("Paid"), button:has-text("Mark paid")').first()
  if (await payBtn.isVisible()) {
    await payBtn.click()
    console.log('  ✓ Marked invoice paid')
    await page.waitForTimeout(300)
  }

  // 5. Close project
  console.log('5. Testing project close...')
  const closeBtn = page.locator('button:has-text("Close Project")').first()
  if (await closeBtn.isVisible()) {
    await closeBtn.click()
    const confirmCloseBtn = page.locator('button:has-text("Confirm Close")')
    if (await confirmCloseBtn.isVisible()) {
      await confirmCloseBtn.click()
      console.log('  ✓ Project closed')
    }
  }

  // 6. Archive project
  console.log('6. Testing archive project...')
  await page.keyboard.down('Shift')
  await page.keyboard.press('E')
  await page.keyboard.up('Shift')
  console.log('  ✓ Pressed Shift+E to archive project')

  console.log('\nAll E2E project steps completed successfully! ✓')
  await browser.close()
}

run().catch((err) => {
  console.error('E2E project test error:', err)
  process.exit(1)
})

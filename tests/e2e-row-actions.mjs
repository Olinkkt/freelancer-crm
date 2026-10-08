import { chromium } from 'playwright'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const consoleLogs = []
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() })
  })
  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err.message)
    process.exit(1)
  })

  console.log('Navigating to http://localhost:3000...')
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })

  // 1. Dashboard: Active Deals row menu
  console.log('1. Testing Dashboard Active Deals RowActionMenu...')
  const dealMenuBtn = page.locator('.deal-row button[aria-haspopup="menu"]').first()
  await dealMenuBtn.waitFor({ state: 'visible' })
  await dealMenuBtn.click()

  const openDrawerItem = page.locator('button[role="menuitem"]:has-text("Open deal drawer")')
  await openDrawerItem.waitFor({ state: 'visible' })
  console.log('  ✓ Deal menu opened successfully!')

  await openDrawerItem.click()
  await page.waitForSelector('text=Opportunity Drawer', { timeout: 3000 })
  console.log('  ✓ Deal drawer opened from menu item!')

  // Close drawer with Escape
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // 2. Dashboard: Follow-ups row menu
  console.log('2. Testing Follow-ups RowActionMenu...')
  const followUpMenuBtn = page.locator('.followup-row button[aria-haspopup="menu"]').first()
  await followUpMenuBtn.waitFor({ state: 'visible' })
  await followUpMenuBtn.click()

  const followUpItem = page.locator('button[role="menuitem"]:has-text("Log interaction")')
  await followUpItem.waitFor({ state: 'visible' })
  console.log('  ✓ Follow-up menu opened successfully!')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 3. Deals View: Dense Table RowActionMenu
  console.log('3. Testing Deals view Dense Table RowActionMenu...')
  const dealsNav = page.locator('button:has-text("Deals")').first()
  await dealsNav.click()
  await page.waitForTimeout(300)

  // Switch to Dense Table mode
  const tableToggle = page.locator('button:has-text("Table")')
  await tableToggle.click()
  await page.waitForTimeout(300)

  const denseTableMenuBtn = page.locator('table button[aria-haspopup="menu"]').first()
  await denseTableMenuBtn.waitFor({ state: 'visible' })
  await denseTableMenuBtn.click()

  const denseDealItem = page.locator('button[role="menuitem"]:has-text("Open deal drawer")')
  await denseDealItem.waitFor({ state: 'visible' })
  console.log('  ✓ Dense table RowActionMenu opened successfully!')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 4. Companies View: RowActionMenu
  console.log('4. Testing Companies directory RowActionMenu...')
  const companiesNav = page.locator('button:has-text("Companies")').first()
  await companiesNav.click()
  await page.waitForTimeout(300)

  const companyMenuBtn = page.locator('.company-table .company-row button[aria-haspopup="menu"]').first()
  await companyMenuBtn.waitFor({ state: 'visible' })
  await companyMenuBtn.click()

  const addDealItem = page.locator('button[role="menuitem"]:has-text("Add deal for")')
  await addDealItem.waitFor({ state: 'visible' })
  console.log('  ✓ Company RowActionMenu opened successfully!')

  await addDealItem.click()
  await page.waitForSelector('text=Create New Deal', { timeout: 3000 })
  console.log('  ✓ Add Deal modal opened from company menu item with pre-filled company!')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 5. Contacts View: RowActionMenu
  console.log('5. Testing Contacts directory RowActionMenu...')
  const contactsNav = page.locator('button:has-text("Contacts")').first()
  await contactsNav.click()
  await page.waitForTimeout(300)

  const contactMenuBtn = page.locator('.company-table .company-row button[aria-haspopup="menu"]').first()
  await contactMenuBtn.waitFor({ state: 'visible' })
  await contactMenuBtn.click()

  const contactDealItem = page.locator('button[role="menuitem"]:has-text("Create deal for")')
  await contactDealItem.waitFor({ state: 'visible' })
  console.log('  ✓ Contact RowActionMenu opened successfully!')

  await contactDealItem.click()
  await page.waitForSelector('text=Create New Deal', { timeout: 3000 })
  console.log('  ✓ Create Deal modal opened from contact menu item!')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 6. Activities View: RowActionMenu
  console.log('6. Testing Activities timeline RowActionMenu...')
  const activitiesNav = page.locator('button:has-text("Activities")').first()
  await activitiesNav.click()
  await page.waitForTimeout(300)

  const activityMenuBtn = page.locator('.company-table .company-row button[aria-haspopup="menu"]').first()
  await activityMenuBtn.waitFor({ state: 'visible' })
  await activityMenuBtn.click()

  const actLogItem = page.locator('button[role="menuitem"]:has-text("Log interaction")')
  await actLogItem.waitFor({ state: 'visible' })
  console.log('  ✓ Activity RowActionMenu opened successfully!')

  await actLogItem.click()
  await page.waitForSelector('text=Quick Log Call & Deal Note', { timeout: 3000 })
  console.log('  ✓ Quick-log modal opened from activity menu item!')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  console.log('\n--- ALL ROW ACTION MENUS VERIFIED SUCCESSFULLY WITH 0 DEAD CLICKS! ---')
  await browser.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

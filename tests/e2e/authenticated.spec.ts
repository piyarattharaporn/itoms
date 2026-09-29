import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function signInAsLocalAdmin(page: Page) {
  await page.goto('/')
  await page.getByLabel('อีเมล').fill('local.admin@example.test')
  await page.getByLabel('รหัสผ่าน').fill('LocalAdmin123!')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page.getByRole('button', { name: 'ออกจากระบบ', exact: true })).toBeVisible({ timeout: 15_000 })
}

test('signs in against the Firebase Emulator and reaches the portal shell', async ({ page }) => {
  await signInAsLocalAdmin(page)
  await expect(
    page.getByLabel('เลือก Property').locator('option').filter({ hasText: 'Local Test Property' }),
  ).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'ภาพรวม', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create Task', exact: true })).toBeVisible()
})

test('authenticated portal shell has no WCAG A/AA violations', async ({ page }) => {
  await signInAsLocalAdmin(page)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations).toEqual([])
})

test('authenticated portal shell has no horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInAsLocalAdmin(page)
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
})

test('representative operational pages have no WCAG A/AA violations', async ({ page }) => {
  await signInAsLocalAdmin(page)

  const scanCurrentPage = async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  }

  await page.getByRole('button', { name: 'Create Task', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'แจ้งงาน IT', exact: true })).toBeVisible()
  await scanCurrentPage()

  await page.getByRole('button', { name: 'ปฏิทินงาน', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ปฏิทินงานดูแล', exact: true })).toBeVisible()
  await scanCurrentPage()

  await page.getByRole('button', { name: 'ตั้งค่ารายการ', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ตั้งค่ารายการ', exact: true })).toBeVisible()
  await scanCurrentPage()
})

test('local Super Admin can open every visible portal page from grouped navigation', async ({ page }) => {
  await signInAsLocalAdmin(page)

  const visiblePages = [
    'ภาพรวม',
    'กระดานงาน',
    'Create Task',
    'ปฏิทินงาน',
    'RCA & Service Review',
    'บันทึกเหตุขัดข้อง',
    'กล้องวงจรปิด',
    'บำรุงรักษาเชิงป้องกัน',
    'อุปกรณ์และลิขสิทธิ์',
    'อุปกรณ์เสียหาย',
    'บันทึกกิจกรรม',
    'บันทึก Audit Log',
    'ตั้งค่า Property',
    'ตั้งค่ารายการ',
    'รายชื่อผู้แจ้งงาน',
    'รายชื่อผู้ใช้',
  ]

  for (const pageName of visiblePages) {
    const navigationButton = page.getByRole('button', { name: pageName, exact: true })
    await expect(navigationButton).toBeVisible()
    await navigationButton.click()
    await expect(page.getByRole('heading', { name: pageName, exact: true }).first()).toBeVisible()
    await expect(page.locator('main').first()).toBeVisible()
    if (pageName === 'กระดานงาน') {
      await expect(page.getByRole('heading', { name: 'งาน Task ที่ต้องดำเนินการ', exact: true })).toBeVisible()
    }
  }
})

test('CCTV check can save one NVR independently', async ({ page }) => {
  await signInAsLocalAdmin(page)
  await page.getByRole('button', { name: 'กล้องวงจรปิด', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'กล้องวงจรปิด', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '+ เพิ่ม NVR', exact: true }).click()
  await page.getByLabel('ชื่อ / รหัส NVR').fill('E2E-NVR-01')
  await page.getByLabel('Location / พื้นที่').fill('E2E Test Room')
  await page.getByLabel('จำนวนกล้องที่ติดตั้ง').fill('2')
  await page.getByLabel('เป้าหมายวันเก็บภาพ').fill('30')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).last().click()
  await expect(page.getByText('E2E-NVR-01', { exact: true }).first()).toBeVisible()

  const dailyCheckForm = page.locator('form').filter({ hasText: 'ตรวจสุขภาพรายวันแยกตาม NVR' })
  const nvrCheck = dailyCheckForm.locator('article').filter({ hasText: 'E2E-NVR-01' }).first()
  await expect(nvrCheck).toBeVisible()
  await nvrCheck.getByLabel('กล้อง Online').fill('1')
  await nvrCheck.getByRole('button', { name: 'บันทึก NVR นี้ E2E-NVR-01', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('บันทึกผลตรวจ NVR E2E-NVR-01 แล้ว')
  await expect(nvrCheck.getByText('บันทึกแล้ว', { exact: true })).toBeVisible()
})

test('catalog settings exposes responsive SLA navigation and fields', async ({ page }) => {
  await signInAsLocalAdmin(page)
  await page.getByRole('button', { name: 'ตั้งค่ารายการ', exact: true }).click()

  const sectionNavigation = page.getByRole('navigation', { name: 'ส่วนตั้งค่ารายการ', exact: true })
  await expect(sectionNavigation).toBeVisible()
  await sectionNavigation.getByRole('link', { name: 'SLA', exact: true }).click()
  await expect(page.locator('#catalog-sla')).toBeVisible()
  // Scope to the editor's stable field type so the assertion is independent of the selected UI language.
  const slaTargetInputs = page.locator('#catalog-sla input[type="number"]')
  await expect(slaTargetInputs).toHaveCount(8)
  await expect(slaTargetInputs.first()).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  await expect(slaTargetInputs.first()).toBeVisible()
})

test('dashboard follows the ITOMS operational hierarchy', async ({ page }) => {
  await signInAsLocalAdmin(page)

  await expect(page.getByRole('heading', { name: 'ภาพรวมงานบริการ IT', exact: true })).toBeVisible()
  const kpiRail = page.locator('main').locator('div.grid').filter({ hasText: 'งานที่ยังเปิดอยู่' }).first()
  await expect(kpiRail.getByText('เลยกำหนด', { exact: true }).first()).toBeVisible()
  await expect(kpiRail.getByText('ใกล้ครบกำหนด', { exact: true }).first()).toBeVisible()
  await expect(kpiRail.getByText('งาน Critical ที่ยังเปิด', { exact: true })).toBeVisible()
  await expect(kpiRail.getByText('งานที่ยังเปิดอยู่', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'งานที่ต้องติดตาม', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ติดตาม SLA', exact: true })).toBeVisible()
  await expect(
    page
      .getByText(/ยังประเมินไม่ได้|ประเมินได้|Response เกิน SLA|Not enough data to evaluate/, { exact: false })
      .first(),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'สุขภาพงานบริการและทรัพย์สิน', exact: true })).toBeVisible()

  const summaryDate = page.getByText('วันที่สรุป', { exact: true }).locator('..')
  const createTaskButton = page.getByRole('button', { name: 'สร้าง Task', exact: true }).first()
  const summaryDateBox = await summaryDate.boundingBox()
  const createTaskButtonBox = await createTaskButton.boundingBox()
  expect(summaryDateBox).not.toBeNull()
  expect(createTaskButtonBox).not.toBeNull()
  expect(createTaskButtonBox!.y).toBeGreaterThan(summaryDateBox!.y + summaryDateBox!.height)

  const details = page.locator('details').filter({ hasText: 'รายละเอียดเพิ่มเติม' })
  await expect(details).toBeVisible()
  await expect(details.locator('summary')).toBeVisible()
  await expect(details).toHaveAttribute('open', '')

  const statusSnapshot = details.locator('section').filter({ hasText: 'สถานะงาน' }).first()
  const taskTrend = details.locator('section').filter({ hasText: 'งานที่สร้างตามช่วงเวลา' }).first()
  const statusSnapshotBox = await statusSnapshot.boundingBox()
  const taskTrendBox = await taskTrend.boundingBox()
  expect(statusSnapshotBox).not.toBeNull()
  expect(taskTrendBox).not.toBeNull()
  expect(taskTrendBox!.width).toBeGreaterThan(statusSnapshotBox!.width)

  await details.locator('summary').click()
  await expect(details).not.toHaveAttribute('open', '')
  await details.locator('summary').click()
  await expect(details).toHaveAttribute('open', '')

  await page.getByRole('button', { name: 'สร้าง Task', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Create Task', exact: true })).toBeVisible()
})

test('task and calendar pages follow the ITOMS workspace hierarchy', async ({ page }) => {
  await signInAsLocalAdmin(page)

  await page.getByRole('button', { name: 'Create Task', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create Task', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'แจ้งงาน IT', exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const createDimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(createDimensions.documentWidth).toBeLessThanOrEqual(createDimensions.viewportWidth + 1)
  expect(createDimensions.bodyWidth).toBeLessThanOrEqual(createDimensions.viewportWidth + 1)

  await page.getByRole('button', { name: 'เมนูหลัก', exact: true }).click()
  await page.getByRole('button', { name: 'ปฏิทินงาน', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ปฏิทินงาน', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ปฏิทินงานดูแล', exact: true })).toBeVisible()

  const calendarDimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(calendarDimensions.documentWidth).toBeLessThanOrEqual(calendarDimensions.viewportWidth + 1)
  expect(calendarDimensions.bodyWidth).toBeLessThanOrEqual(calendarDimensions.viewportWidth + 1)
})

test('dashboard keeps every visible element inside a desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signInAsLocalAdmin(page)

  const overflow = await page.evaluate(() => {
    const rightEdge = window.innerWidth
    return [...document.querySelectorAll<HTMLElement>('*')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          text: (element.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 100),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })
      .filter((item) => item.width > 0 && (item.left < 0 || item.right > rightEdge + 1))
      .sort((a, b) => b.right - a.right)
      .slice(0, 20)
  })

  console.log(JSON.stringify({ viewport: await page.evaluate(() => window.innerWidth), overflow }))
  await expect(overflow, JSON.stringify(overflow, null, 2)).toEqual([])

  // Keep the structural assertion aligned with the current user-facing dashboard title.
  const licenseCard = page.locator('section').filter({ hasText: 'License ใกล้หมดอายุหรือหมดอายุแล้ว' }).first()
  const licenseAction = page.getByRole('button', { name: 'ดูรายละเอียดใน Asset & Licence', exact: true })
  const cardBox = await licenseCard.boundingBox()
  const actionBox = await licenseAction.boundingBox()
  expect(cardBox).not.toBeNull()
  expect(actionBox).not.toBeNull()
  expect(actionBox!.x).toBeGreaterThanOrEqual(cardBox!.x)
  expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width)
})

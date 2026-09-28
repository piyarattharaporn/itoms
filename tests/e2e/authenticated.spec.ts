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

test('catalog settings exposes responsive SLA navigation and fields', async ({ page }) => {
  await signInAsLocalAdmin(page)
  await page.getByRole('button', { name: 'ตั้งค่ารายการ', exact: true }).click()

  const sectionNavigation = page.getByRole('navigation', { name: 'ส่วนตั้งค่ารายการ', exact: true })
  await expect(sectionNavigation).toBeVisible()
  await sectionNavigation.getByRole('link', { name: 'SLA', exact: true }).click()
  await expect(page.locator('#catalog-sla')).toBeVisible()
  await expect(page.getByLabel('First Response Critical')).toBeVisible()
  await expect(page.getByLabel('Resolution Critical')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  await expect(page.getByLabel('First Response Critical')).toBeVisible()
})

test('dashboard follows the ITOMS operational hierarchy', async ({ page }) => {
  await signInAsLocalAdmin(page)

  await expect(page.getByRole('heading', { name: 'ภาพรวมงานบริการ IT', exact: true })).toBeVisible()
  const kpiRail = page.locator('main').locator('div.grid').filter({ hasText: 'งานที่ยังเปิดอยู่' }).first()
  await expect(kpiRail.getByText('เลยกำหนด', { exact: true })).toBeVisible()
  await expect(kpiRail.getByText('ใกล้ครบกำหนด', { exact: true }).first()).toBeVisible()
  await expect(kpiRail.getByText('งาน Critical ที่ยังเปิด', { exact: true })).toBeVisible()
  await expect(kpiRail.getByText('งานที่ยังเปิดอยู่', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'งานที่ต้องติดตาม', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ติดตาม SLA', exact: true })).toBeVisible()
  await expect(page.getByText(/ยังประเมินไม่ได้|Not enough data to evaluate/, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'สุขภาพงานบริการและทรัพย์สิน', exact: true })).toBeVisible()

  const details = page.locator('details').filter({ hasText: 'รายละเอียดเพิ่มเติม' })
  await expect(details).toBeVisible()
  await expect(details.locator('summary')).toBeVisible()
  await details.locator('summary').click()
  await expect(details).toHaveAttribute('open', '')

  await page.getByRole('button', { name: 'สร้าง Task', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Create Task', exact: true })).toBeVisible()
})

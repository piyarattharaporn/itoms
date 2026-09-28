import { expect, test, type Page } from '@playwright/test'

const snapshotTime = new Date('2026-09-28T09:00:00+07:00')

async function signInAsLocalAdmin(page: Page) {
  await page.clock.install({ time: snapshotTime })
  await page.goto('/')
  await page.getByLabel('อีเมล').fill('local.admin@example.test')
  await page.getByLabel('รหัสผ่าน').fill('LocalAdmin123!')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page.getByRole('button', { name: 'ออกจากระบบ', exact: true })).toBeVisible({ timeout: 15_000 })
}

test.describe('ITOMS representative page visual regression', () => {
  test('dashboard template', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signInAsLocalAdmin(page)
    await expect(page.getByRole('heading', { name: 'ภาพรวมงานบริการ IT', exact: true })).toBeVisible()
    await expect(page.locator('main')).toHaveScreenshot('dashboard-desktop.png', {
      animations: 'disabled',
      fullPage: true,
    })
  })

  test('task template at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInAsLocalAdmin(page)
    await page.getByRole('button', { name: 'เมนูหลัก', exact: true }).click()
    await page.getByRole('button', { name: 'Create Task', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'แจ้งงาน IT', exact: true })).toBeVisible()
    await expect(page.locator('main')).toHaveScreenshot('task-mobile.png', {
      animations: 'disabled',
      fullPage: true,
    })
  })

  test('calendar template at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInAsLocalAdmin(page)
    await page.getByRole('button', { name: 'เมนูหลัก', exact: true }).click()
    await page.getByRole('button', { name: 'ปฏิทินงาน', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'ปฏิทินงานดูแล', exact: true })).toBeVisible()
    await expect(page.locator('main')).toHaveScreenshot('calendar-mobile.png', {
      animations: 'disabled',
      fullPage: true,
    })
  })

  test('settings template at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signInAsLocalAdmin(page)
    await page.getByRole('button', { name: 'ตั้งค่ารายการ', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'ตั้งค่ารายการ', exact: true })).toBeVisible()
    await expect(page.locator('main')).toHaveScreenshot('settings-desktop.png', {
      animations: 'disabled',
      fullPage: true,
    })
  })
})

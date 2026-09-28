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
  await expect(page.getByText('Local Test Property', { exact: true })).toBeVisible()
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

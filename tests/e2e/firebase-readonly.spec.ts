import { expect, test } from '@playwright/test'

test('Firebase Hosting serves the public ITOMS sign-in shell', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' })
  expect(response?.status()).toBe(200)
  await expect(page.getByText('ระบบบริหารจัดการงาน IT Outsource (ITOMS)', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByLabel('อีเมล')).toBeVisible()
  await expect(page.getByLabel('รหัสผ่าน')).toBeVisible()
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true })).toBeVisible()
})

test('Firebase Hosting does not expose an authenticated portal without a session', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'ออกจากระบบ', exact: true })).not.toBeVisible()
})

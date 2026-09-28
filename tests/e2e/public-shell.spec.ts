import { expect, test } from '@playwright/test'

test('renders the unauthenticated sign-in shell with usable form controls', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /ITOMS/i })).toBeVisible()
  await expect(page.getByLabel('อีเมล')).toBeVisible()
  await expect(page.getByLabel('รหัสผ่าน')).toBeVisible()
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true })).toBeDisabled()
  await expect(page.getByRole('status')).toContainText('ยังไม่ได้ตั้งค่า Firebase')
})

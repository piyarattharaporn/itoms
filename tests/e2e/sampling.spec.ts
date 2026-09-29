import { expect, test, type Page } from '@playwright/test'

async function signInAsLocalAdmin(page: Page) {
  await page.goto('/')
  await page.getByLabel('อีเมล').fill('local.admin@example.test')
  await page.getByLabel('รหัสผ่าน').fill('LocalAdmin123!')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page.getByRole('button', { name: 'ออกจากระบบ', exact: true })).toBeVisible({ timeout: 15_000 })
}

async function openMenu(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click()
  await expect(page.locator('main').first()).toBeVisible()
}

test('sampling data covers every ITOMS menu and operational area', async ({ page }) => {
  await signInAsLocalAdmin(page)

  await expect(page.getByRole('heading', { name: 'ภาพรวมงานบริการ IT', exact: true })).toBeVisible()
  await expect(page.getByText('WiFi Front Office ไม่เสถียร', { exact: true })).toBeVisible()
  await expect(page.getByText('บันทึกเหตุขัดข้อง', { exact: true }).first()).toBeVisible()

  await openMenu(page, 'กระดานงาน')
  await expect(
    page.getByText('ระบบ WiFi บริเวณ Front Office ช้าผิดปกติ ต้องตรวจสอบ Access Point และ uplink', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'ตาราง', exact: true }).click()
  await expect(page.locator('table').first()).toBeVisible()

  await openMenu(page, 'Create Task')
  await expect(page.getByRole('heading', { name: 'แจ้งงาน IT', exact: true })).toBeVisible()

  await openMenu(page, 'ปฏิทินงาน')
  await expect(page.getByText('ตรวจห้องประชุมก่อนเริ่มงาน', { exact: true })).toBeVisible()

  await openMenu(page, 'RCA & Service Review')
  await expect(page.getByText('เครื่องพิมพ์สำนักงานพิมพ์งานช้าและมีเส้นบนกระดาษ', { exact: true })).toBeVisible()

  await openMenu(page, 'บันทึกเหตุขัดข้อง')
  await expect(page.getByText('WiFi Front Office ไม่เสถียร', { exact: true })).toBeVisible()
  await expect(page.getByText('กู้คืนแล้ว · เดือนที่เลือก', { exact: true })).toBeVisible()

  await openMenu(page, 'กล้องวงจรปิด')
  await expect(page.getByText('DVR-1', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('DVR-2', { exact: true }).first()).toBeVisible()

  await openMenu(page, 'บำรุงรักษาเชิงป้องกัน')
  await expect(page.getByText('ตรวจสุขภาพ DVR และห้อง Server', { exact: true })).toBeVisible()

  await openMenu(page, 'อุปกรณ์และลิขสิทธิ์')
  await expect(page.getByText('IT Support Laptop', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: /ไลเซนส์/ }).click()
  await expect(page.getByText('Microsoft 365 Business', { exact: true })).toBeVisible()

  await openMenu(page, 'อุปกรณ์เสียหาย')
  await expect(page.getByText('CCTV South Wing Floor 3', { exact: true })).toBeVisible()
  await expect(page.getByText('Office Printer Legacy', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ตาราง', exact: true }).click()
  await expect(page.locator('table').first()).toBeVisible()

  await openMenu(page, 'บันทึกกิจกรรม')
  await expect(page.getByText(/WiFi|CCTV/).first()).toBeVisible()
  await page.getByRole('button', { name: 'ตาราง', exact: true }).click()
  await expect(page.locator('table').first()).toBeVisible()

  await openMenu(page, 'บันทึก Audit Log')
  await expect(page.getByText('สร้าง Task ตัวอย่าง Network / WiFi', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ตาราง', exact: true }).click()
  await expect(page.locator('table').first()).toBeVisible()

  await openMenu(page, 'ตั้งค่า Property')
  await expect(page.getByText('Local Test Property', { exact: true })).toBeVisible()

  await openMenu(page, 'ตั้งค่ารายการ')
  await expect(page.getByRole('heading', { name: 'ตั้งค่ารายการ', exact: true })).toBeVisible()

  await openMenu(page, 'รายชื่อผู้แจ้งงาน')
  await expect(page.getByText('front-office@example.test', { exact: true })).toBeVisible()

  await openMenu(page, 'รายชื่อผู้ใช้')
  await expect(page.getByText('Narin Support Engineer', { exact: true })).toBeVisible()
})

test('sampling data supports status and property filters', async ({ page }) => {
  await signInAsLocalAdmin(page)

  await openMenu(page, 'อุปกรณ์เสียหาย')
  await page.getByRole('button', { name: /เลิกใช้งาน/ }).click()
  await expect(page.getByText('Office Printer Legacy', { exact: true })).toBeVisible()
  await expect(page.getByText('CCTV South Wing Floor 3', { exact: true })).not.toBeVisible()

  await openMenu(page, 'กระดานงาน')
  await page.getByLabel('ค้นหา Task').fill('WiFi')
  await expect(
    page.getByText('ระบบ WiFi บริเวณ Front Office ช้าผิดปกติ ต้องตรวจสอบ Access Point และ uplink', { exact: true }),
  ).toBeVisible()
})

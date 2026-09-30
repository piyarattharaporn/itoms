import { expect, test, type Page } from '@playwright/test'

async function signInAsLocalAdmin(page: Page) {
  await page.goto('/')
  await page.getByLabel('อีเมล').fill('local.admin@example.test')
  await page.getByLabel('รหัสผ่าน').fill('LocalAdmin123!')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page.getByRole('button', { name: 'เมนูผู้ใช้', exact: true })).toBeVisible({ timeout: 15_000 })
}

test('dashboard initial load stays within the local performance budget', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => performance.mark('phase4-dashboard-start'))
  await page.getByLabel('อีเมล').fill('local.admin@example.test')
  await page.getByLabel('รหัสผ่าน').fill('LocalAdmin123!')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ภาพรวมงานบริการ IT', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => performance.mark('phase4-dashboard-ready'))

  const timings = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const measure = performance.measure('phase4-dashboard-load', 'phase4-dashboard-start', 'phase4-dashboard-ready')
    return {
      dashboardReadyMs: Math.round(measure.duration),
      domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      loadEventMs: navigation ? Math.round(navigation.loadEventEnd) : null,
    }
  })

  console.log(JSON.stringify({ performanceBudget: timings }))
  expect(timings.dashboardReadyMs).toBeLessThan(7_000)
  expect(timings.domContentLoadedMs ?? 0).toBeLessThan(5_000)
  expect(timings.loadEventMs ?? 0).toBeLessThan(7_000)
})

test('dashboard stays responsive at the validation viewport sizes', async ({ page }) => {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await signInAsLocalAdmin(page)
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(dimensions.documentWidth, `${viewport.name} document overflow`).toBeLessThanOrEqual(
      dimensions.viewportWidth + 1,
    )
    expect(dimensions.bodyWidth, `${viewport.name} body overflow`).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
    await page.getByRole('button', { name: 'เมนูผู้ใช้', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'รายละเอียดผู้ใช้', exact: true })
      .getByRole('button', { name: 'ออกจากระบบ', exact: true })
      .click()
    await expect(page.getByLabel('อีเมล')).toBeVisible()
  }
})

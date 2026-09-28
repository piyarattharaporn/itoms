import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

for (const viewport of viewports) {
  test(`keeps the unauthenticated shell stable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
    }))
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
    expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
    await expect(page.getByRole('heading', { name: /ITOMS/i })).toBeVisible()
    await expect(page).toHaveScreenshot(`${viewport.name}.png`, { fullPage: true, animations: 'disabled' })
  })
}

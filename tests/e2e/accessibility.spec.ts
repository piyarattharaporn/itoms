import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('sign-in shell has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations).toEqual([])
})

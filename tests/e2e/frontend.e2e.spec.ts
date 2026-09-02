import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('unauthenticated visitor is sent to admin login', async ({ page }) => {
    await page.goto('http://localhost:3000')

    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.locator('#field-email')).toBeVisible()
  })
})

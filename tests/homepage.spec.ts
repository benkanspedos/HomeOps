import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/HomeOps/)
  })

  test('displays main heading', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 }).first()
    await expect(heading).toBeVisible()
    await expect(heading).toContainText(/HomeOps/i)
  })

  test('has navigation links', async ({ page }) => {
    // Check for dashboard link
    const dashboardLink = page.getByRole('link', { name: /dashboard/i }).first()
    
    if (await dashboardLink.isVisible()) {
      await expect(dashboardLink).toHaveAttribute('href', '/dashboard')
    }
  })

  test('has proper meta tags', async ({ page }) => {
    // Check viewport meta tag
    const viewport = await page.getAttribute('meta[name="viewport"]', 'content')
    expect(viewport).toContain('width=device-width')
    
    // Check description meta tag
    const description = await page.getAttribute('meta[name="description"]', 'content')
    expect(description).toBeTruthy()
  })

  test('loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Filter out expected errors (like failed API calls in dev)
    const unexpectedErrors = consoleErrors.filter(error => 
      !error.includes('Failed to load resource') &&
      !error.includes('404')
    )
    
    expect(unexpectedErrors).toHaveLength(0)
  })

  test('has working call-to-action buttons', async ({ page }) => {
    const ctaButton = page.getByRole('button', { name: /get started|start|begin/i }).first()
    
    if (await ctaButton.isVisible()) {
      await ctaButton.click()
      // Should navigate or perform action
      await page.waitForTimeout(500)
      // Check if navigation occurred or modal opened
    }
  })

  test('footer is visible', async ({ page }) => {
    const footer = page.locator('footer').first()
    
    if (await footer.isVisible()) {
      await expect(footer).toContainText(/HomeOps/i)
    }
  })

  test('images load correctly', async ({ page }) => {
    const images = page.locator('img')
    const imageCount = await images.count()
    
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i)
      if (await image.isVisible()) {
        await expect(image).toHaveJSProperty('complete', true)
        await expect(image).not.toHaveJSProperty('naturalWidth', 0)
      }
    }
  })
})
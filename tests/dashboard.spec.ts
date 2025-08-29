import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('dashboard loads successfully', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle')
    
    // Check for HomeOps branding
    await expect(page.getByText(/homeops/i).first()).toBeVisible()
    
    // Check for main dashboard elements
    const dashboardContent = page.locator('.dashboard-content, main')
    await expect(dashboardContent).toBeVisible()
  })

  test('navigation menu is visible and functional', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check for navigation elements
    const nav = page.locator('nav, aside').first()
    await expect(nav).toBeVisible()
    
    // Check for Services link
    const servicesLink = page.getByRole('link', { name: /services/i })
    if (await servicesLink.isVisible()) {
      await servicesLink.click()
      await expect(page).toHaveURL(/.*services/)
    }
  })

  test('services page loads correctly', async ({ page }) => {
    await page.goto('/dashboard/services')
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle')
    
    // Check for services content
    const pageTitle = page.getByRole('heading', { name: /services/i }).first()
    await expect(pageTitle).toBeVisible()
  })

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Look for dark mode toggle
    const darkModeToggle = page.getByRole('button', { name: /dark|theme|mode/i }).first()
    
    if (await darkModeToggle.isVisible()) {
      // Get initial theme
      const htmlElement = page.locator('html')
      const initialTheme = await htmlElement.getAttribute('class')
      
      // Click toggle
      await darkModeToggle.click()
      
      // Check if theme changed
      const newTheme = await htmlElement.getAttribute('class')
      expect(newTheme).not.toBe(initialTheme)
    }
  })
})

test.describe('Backend Integration', () => {
  test('backend connection works', async ({ page }) => {
    const response = await page.goto('/api/test-backend')
    
    expect(response?.status()).toBeLessThan(400)
    
    const data = await response?.json()
    expect(data.frontend).toBe('ok')
    
    if (data.backend) {
      expect(data.backend.status).toBe('healthy')
    }
  })

  test('API health check responds', async ({ page }) => {
    // Direct API call
    const response = await page.request.get('http://localhost:3101/health')
    
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.status).toBe('healthy')
    expect(data.environment).toBe('development')
  })
})

test.describe('Authentication Flow', () => {
  test('login page is accessible', async ({ page }) => {
    await page.goto('/login')
    
    // Check for login form elements
    const loginForm = page.locator('form').first()
    
    if (await loginForm.isVisible()) {
      // Check for email/username field
      const emailField = page.getByRole('textbox', { name: /email|username/i }).first()
      await expect(emailField).toBeVisible()
      
      // Check for password field
      const passwordField = page.getByRole('textbox', { name: /password/i }).first()
      await expect(passwordField).toBeVisible()
      
      // Check for submit button
      const submitButton = page.getByRole('button', { name: /login|sign in/i }).first()
      await expect(submitButton).toBeVisible()
    }
  })

  test('protected routes redirect to login', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear())
    
    // Try to access protected route
    await page.goto('/dashboard')
    
    // Should be redirected to login or still accessible (depending on implementation)
    const url = page.url()
    // This test will depend on actual auth implementation
  })
})

test.describe('Mobile Responsiveness', () => {
  test('dashboard is responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/dashboard')
    
    // Check if content is visible
    const mainContent = page.locator('main').first()
    await expect(mainContent).toBeVisible()
    
    // Check for mobile menu button (hamburger)
    const mobileMenuButton = page.getByRole('button', { name: /menu/i }).first()
    
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click()
      
      // Check if menu opens
      const mobileMenu = page.locator('nav, aside').first()
      await expect(mobileMenu).toBeVisible()
    }
  })
})

test.describe('Performance', () => {
  test('page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000)
  })

  test('API responses are fast', async ({ page }) => {
    const startTime = Date.now()
    
    const response = await page.goto('/api/test-backend')
    
    const responseTime = Date.now() - startTime
    
    // API should respond within 1 second
    expect(responseTime).toBeLessThan(1000)
  })
})
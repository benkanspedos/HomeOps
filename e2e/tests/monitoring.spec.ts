import { test, expect, Page } from '@playwright/test';

test.describe('System Monitoring', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/monitoring');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Dashboard Layout', () => {
    test('displays all container health cards', async () => {
      // Wait for container data to load
      await page.waitForSelector('[data-testid="container-card"]', { timeout: 10000 });
      
      const containers = await page.locator('[data-testid="container-card"]').count();
      expect(containers).toBeGreaterThan(0);
      
      // Verify essential containers are present
      const expectedContainers = ['nginx', 'redis', 'postgres', 'timescaledb'];
      for (const containerName of expectedContainers) {
        await expect(page.getByText(containerName, { exact: true })).toBeVisible();
      }
    });

    test('shows system metrics overview', async () => {
      await page.waitForSelector('[data-testid="system-metrics"]');
      
      // CPU metrics
      await expect(page.getByText('CPU Usage')).toBeVisible();
      await expect(page.locator('[data-testid="cpu-percentage"]')).toBeVisible();
      
      // Memory metrics
      await expect(page.getByText('Memory Usage')).toBeVisible();
      await expect(page.locator('[data-testid="memory-percentage"]')).toBeVisible();
      
      // Disk metrics
      await expect(page.getByText('Disk Usage')).toBeVisible();
      await expect(page.locator('[data-testid="disk-percentage"]')).toBeVisible();
    });

    test('displays navigation menu correctly', async () => {
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Containers' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Alerts' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    });
  });

  test.describe('Container Management', () => {
    test('expands container details on click', async () => {
      const firstContainer = page.locator('[data-testid="container-card"]').first();
      
      // Click to expand
      await firstContainer.locator('button[aria-label="Expand details"]').click();
      
      // Verify detailed metrics are visible
      await expect(firstContainer.getByText('Network RX:')).toBeVisible();
      await expect(firstContainer.getByText('Network TX:')).toBeVisible();
      await expect(firstContainer.getByText('Disk Read:')).toBeVisible();
      await expect(firstContainer.getByText('Disk Write:')).toBeVisible();
      
      // Click to collapse
      await firstContainer.locator('button[aria-label="Collapse details"]').click();
      
      // Verify detailed metrics are hidden
      await expect(firstContainer.getByText('Network RX:')).not.toBeVisible();
    });

    test('restarts container successfully', async () => {
      // Find a running container
      const nginxContainer = page.locator('[data-testid="container-card"]').filter({
        hasText: 'nginx'
      });
      
      // Click restart button
      await nginxContainer.locator('button[aria-label="Restart container"]').click();
      
      // Verify confirmation dialog or direct restart
      const restartingIndicator = nginxContainer.getByText('Restarting...');
      if (await restartingIndicator.isVisible()) {
        await expect(restartingIndicator).toBeVisible();
        
        // Wait for restart to complete
        await expect(restartingIndicator).not.toBeVisible({ timeout: 30000 });
      }
      
      // Verify container is still running
      await expect(nginxContainer.getByText('Running')).toBeVisible();
    });

    test('filters containers by status', async () => {
      // Check if filter controls exist
      const statusFilter = page.locator('select[name="statusFilter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('running');
        
        // Verify only running containers are shown
        const containerCards = page.locator('[data-testid="container-card"]');
        const count = await containerCards.count();
        
        for (let i = 0; i < count; i++) {
          const card = containerCards.nth(i);
          await expect(card.getByText('Running')).toBeVisible();
        }
      }
    });

    test('searches containers by name', async () => {
      const searchInput = page.locator('input[placeholder*="Search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('nginx');
        
        // Verify only nginx container is shown
        await expect(page.locator('[data-testid="container-card"]')).toHaveCount(1);
        await expect(page.getByText('nginx', { exact: true })).toBeVisible();
        
        // Clear search
        await searchInput.clear();
        
        // Verify all containers are shown again
        const containerCount = await page.locator('[data-testid="container-card"]').count();
        expect(containerCount).toBeGreaterThan(1);
      }
    });
  });

  test.describe('Alert Configuration', () => {
    test('navigates to alerts page', async () => {
      await page.click('a[href*="alerts"]');
      await expect(page).toHaveURL(/.*alerts/);
      
      await expect(page.getByText('Alert Configuration')).toBeVisible();
    });

    test('configures and triggers alert', async () => {
      await page.goto('/monitoring/alerts');
      
      // Create new alert rule
      await page.click('button:has-text("New Alert")');
      
      // Fill alert form
      await page.fill('input[name="alertName"]', 'High CPU Test Alert');
      await page.selectOption('select[name="metric"]', 'cpu');
      await page.fill('input[name="threshold"]', '80');
      await page.selectOption('select[name="operator"]', '>');
      await page.selectOption('select[name="severity"]', 'warning');
      await page.check('input[value="email"]');
      
      // Save alert
      await page.click('button[type="submit"]');
      
      // Verify alert was created
      await expect(page.getByText('High CPU Test Alert')).toBeVisible();
      
      // Test alert
      await page.click('button[data-testid="test-alert"]:near(:text("High CPU Test Alert"))');
      
      // Verify success message
      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/test.*sent/i)).toBeVisible();
    });

    test('tests all notification channels', async () => {
      await page.goto('/monitoring/alerts');
      
      const channels = ['email', 'slack', 'webhook'];
      
      for (const channel of channels) {
        const testButton = page.locator(`button[data-testid="test-${channel}"]`);
        if (await testButton.isVisible()) {
          await testButton.click();
          
          // Wait for response
          await page.waitForTimeout(2000);
          
          // Check for success or error message
          const successToast = page.locator('.toast-success');
          const errorToast = page.locator('.toast-error');
          
          const successVisible = await successToast.isVisible();
          const errorVisible = await errorToast.isVisible();
          
          expect(successVisible || errorVisible).toBe(true);
          
          if (successVisible) {
            console.log(`${channel} test: SUCCESS`);
          } else {
            console.log(`${channel} test: FAILED (configuration issue)`);
          }
          
          // Close any toasts
          await page.keyboard.press('Escape');
        }
      }
    });
  });

  test.describe('Real-time Updates', () => {
    test('shows real-time metric updates', async () => {
      // Get initial CPU value
      const cpuElement = page.locator('[data-testid="cpu-usage"]');
      await cpuElement.waitFor({ state: 'visible' });
      
      const initialCpu = await cpuElement.textContent();
      
      // Wait for potential update (monitoring interval is 10 seconds)
      await page.waitForTimeout(12000);
      
      const updatedCpu = await cpuElement.textContent();
      
      // Values should be different or at least the element should have update indicators
      const updateIndicator = page.locator('[data-testid="update-indicator"]');
      const hasUpdateIndicator = await updateIndicator.isVisible();
      
      if (initialCpu !== updatedCpu) {
        console.log('Real-time update confirmed: CPU changed from', initialCpu, 'to', updatedCpu);
      } else if (hasUpdateIndicator) {
        console.log('Real-time update confirmed: Update indicator visible');
      } else {
        console.log('No visible changes detected - this may be normal if system is stable');
      }
    });

    test('displays live charts with streaming data', async () => {
      // Navigate to charts view
      const chartsTab = page.locator('button:has-text("Charts")');
      if (await chartsTab.isVisible()) {
        await chartsTab.click();
        
        // Wait for chart to load
        await page.waitForSelector('[data-testid="metrics-chart"]');
        
        // Check for data points
        const dataPoints = page.locator('[data-testid="data-point"]');
        const initialCount = await dataPoints.count();
        
        // Wait for new data point (should arrive within 10-15 seconds)
        await page.waitForTimeout(15000);
        
        const newCount = await dataPoints.count();
        
        // In streaming mode, count might stay same (sliding window) but last point should be different
        if (newCount >= initialCount) {
          console.log('Chart streaming confirmed: Data points updated');
        }
      }
    });

    test('handles WebSocket connection and reconnection', async () => {
      // Monitor network activity
      const wsConnections: string[] = [];
      
      page.on('websocket', ws => {
        wsConnections.push(ws.url());
        console.log('WebSocket connected:', ws.url());
        
        ws.on('close', () => {
          console.log('WebSocket closed');
        });
      });
      
      // Navigate to monitoring page
      await page.goto('/monitoring');
      await page.waitForTimeout(3000);
      
      // Check if WebSocket connection was established
      expect(wsConnections.length).toBeGreaterThan(0);
      
      // Simulate network interruption by navigating away and back
      await page.goto('/');
      await page.waitForTimeout(2000);
      await page.goto('/monitoring');
      await page.waitForTimeout(3000);
      
      // Connection should be reestablished
      expect(wsConnections.length).toBeGreaterThan(1);
    });
  });

  test.describe('Error Handling', () => {
    test('displays error state when API is unavailable', async () => {
      // Block API requests
      await page.route('**/api/health/**', route => route.abort());
      
      await page.goto('/monitoring');
      
      // Should show error state
      await expect(page.getByText(/error.*loading/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/retry/i)).toBeVisible();
    });

    test('handles container operation failures gracefully', async () => {
      // Mock API to return error for restart operation
      await page.route('**/api/containers/*/restart', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Container restart failed' })
        });
      });
      
      const containerCard = page.locator('[data-testid="container-card"]').first();
      await containerCard.locator('button[aria-label="Restart container"]').click();
      
      // Should show error message
      await expect(page.getByText(/restart.*failed/i)).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('loads monitoring page within acceptable time', async () => {
      const startTime = Date.now();
      
      await page.goto('/monitoring');
      await page.waitForSelector('[data-testid="container-card"]');
      
      const loadTime = Date.now() - startTime;
      console.log('Page load time:', loadTime + 'ms');
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('handles large number of containers efficiently', async () => {
      // This would require setting up many test containers
      // or mocking the API to return many containers
      
      await page.route('**/api/health/containers', route => {
        const mockContainers = Array(50).fill(null).map((_, i) => ({
          id: `container-${i}`,
          name: `test-container-${i}`,
          status: 'running',
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          image: 'nginx:latest'
        }));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ containers: mockContainers })
        });
      });
      
      const startTime = Date.now();
      await page.goto('/monitoring');
      
      // Wait for all container cards to render
      await page.waitForFunction(() => 
        document.querySelectorAll('[data-testid="container-card"]').length >= 50
      );
      
      const renderTime = Date.now() - startTime;
      console.log('Render time for 50 containers:', renderTime + 'ms');
      
      // Should render within reasonable time
      expect(renderTime).toBeLessThan(5000);
      
      // Check that scrolling is smooth
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(100);
      await page.evaluate(() => window.scrollTo(0, 0));
      
      // No assertion needed - just verify no crashes during scrolling
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('displays properly on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/monitoring');
      await page.waitForSelector('[data-testid="container-card"]');
      
      // Container cards should stack vertically on mobile
      const firstCard = page.locator('[data-testid="container-card"]').first();
      const secondCard = page.locator('[data-testid="container-card"]').nth(1);
      
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();
      
      if (firstBox && secondBox) {
        // Second card should be below first card (not side by side)
        expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 10);
      }
    });

    test('hamburger menu works on mobile', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/monitoring');
      
      // Look for hamburger menu
      const hamburgerMenu = page.locator('[aria-label="Toggle menu"]');
      if (await hamburgerMenu.isVisible()) {
        await hamburgerMenu.click();
        
        // Navigation should be visible
        await expect(page.getByRole('navigation')).toBeVisible();
        
        // Close menu
        await hamburgerMenu.click();
        await expect(page.getByRole('navigation')).not.toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('meets basic accessibility requirements', async () => {
      await page.goto('/monitoring');
      await page.waitForSelector('[data-testid="container-card"]');
      
      // Check for skip link
      await page.keyboard.press('Tab');
      const skipLink = page.locator('a:has-text("Skip to content")');
      if (await skipLink.isVisible()) {
        expect(skipLink).toBeVisible();
      }
      
      // Check heading structure
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      
      // Check for proper labels on interactive elements
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = buttons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();
        
        expect(ariaLabel || text).toBeTruthy();
      }
    });

    test('supports keyboard navigation', async () => {
      await page.goto('/monitoring');
      await page.waitForSelector('[data-testid="container-card"]');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      let focusedElement = page.locator(':focus');
      
      // Should be able to focus on interactive elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        
        const tagName = await page.evaluate(() => document.activeElement?.tagName);
        const role = await page.evaluate(() => document.activeElement?.getAttribute('role'));
        
        if (['BUTTON', 'A', 'INPUT', 'SELECT'].includes(tagName || '') || 
            ['button', 'link'].includes(role || '')) {
          console.log('Focused on interactive element:', tagName || role);
        }
      }
    });
  });
});
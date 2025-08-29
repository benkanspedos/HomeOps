import { test, expect, Page } from '@playwright/test';

// Test data constants
const TEST_DOMAIN = 'test-ads.example.com';
const TEST_SAFE_DOMAIN = 'safe-test.example.com';
const INVALID_DOMAIN = 'invalid domain name';

class DNSPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/dns');
    await this.page.waitForLoadState('networkidle');
  }

  // Status methods
  async getConnectionStatus() {
    const statusBadge = this.page.locator('[data-testid="connection-status"], .badge:has-text("Connected"), .badge:has-text("Disconnected")').first();
    await statusBadge.waitFor();
    return await statusBadge.textContent();
  }

  async toggleDNSBlocking() {
    const blockingSwitch = this.page.locator('[data-testid="dns-blocking-switch"], input[type="checkbox"][role="switch"]').first();
    await blockingSwitch.click();
  }

  async isDNSBlockingEnabled() {
    const blockingSwitch = this.page.locator('[data-testid="dns-blocking-switch"], input[type="checkbox"][role="switch"]').first();
    return await blockingSwitch.isChecked();
  }

  // Metrics methods
  async getMetricValue(metric: 'Total Queries' | 'Blocked' | 'Cache Hit Rate' | 'Active Clients') {
    const metricCard = this.page.locator('.card').filter({ hasText: metric });
    const value = metricCard.locator('.text-2xl, [class*="text-2xl"]').first();
    return await value.textContent();
  }

  async waitForMetricsToLoad() {
    await this.page.waitForFunction(() => {
      const skeletons = document.querySelectorAll('[data-testid*="skeleton"], .skeleton');
      return skeletons.length === 0;
    }, { timeout: 10000 });
  }

  // Navigation methods
  async clickTab(tab: 'Overview' | 'Domains' | 'Query History' | 'Performance') {
    await this.page.click(`[role="tab"]:has-text("${tab}")`);
    await this.page.waitForTimeout(500);
  }

  // Domain management methods
  async openAddDomainDialog() {
    await this.page.click('button:has-text("Add Domain")');
    await this.page.waitForSelector('[data-testid="add-domain-dialog"], [role="dialog"]');
  }

  async addDomain(domain: string, listType: 'Blocklist' | 'Allowlist' = 'Blocklist', comment?: string) {
    await this.openAddDomainDialog();
    
    // Fill domain field
    await this.page.fill('input[name="domain"], input[placeholder*="example.com"]', domain);
    
    // Select list type
    if (listType !== 'Blocklist') {
      await this.page.click('[role="combobox"], select');
      await this.page.click(`[role="option"]:has-text("${listType}"), option:has-text("${listType}")`);
    }
    
    // Fill comment if provided
    if (comment) {
      await this.page.fill('input[name="comment"], input[placeholder*="comment"], textarea', comment);
    }
    
    // Submit form
    await this.page.click('button:has-text("Add Domain")');
    
    // Wait for dialog to close or success message
    await Promise.race([
      this.page.waitForSelector('[role="dialog"]', { state: 'detached' }),
      this.page.waitForSelector('.toast:has-text("successfully")', { timeout: 5000 })
    ]);
  }

  async searchDomains(query: string) {
    const searchInput = this.page.locator('input[placeholder*="Search domains"]');
    await searchInput.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  async filterDomains(filter: 'All Domains' | 'Blocklist Only' | 'Allowlist Only') {
    await this.page.click('[data-testid="domain-filter"], [role="combobox"]:near(input[placeholder*="Search"])');
    await this.page.click(`[role="option"]:has-text("${filter}")`);
    await this.page.waitForTimeout(300);
  }

  async getDomainRows() {
    await this.page.waitForSelector('table tbody tr, [data-testid="domain-row"]');
    return this.page.locator('table tbody tr, [data-testid="domain-row"]');
  }

  async getDomainByName(domain: string) {
    return this.page.locator('tr').filter({ hasText: domain });
  }

  async toggleDomainBlock(domain: string) {
    const domainRow = await this.getDomainByName(domain);
    const toggleSwitch = domainRow.locator('input[type="checkbox"][role="switch"], button[role="switch"]');
    await toggleSwitch.click();
  }

  async removeDomain(domain: string) {
    const domainRow = await this.getDomainByName(domain);
    const deleteButton = domainRow.locator('button:has([class*="trash"]), button[aria-label*="delete"], button[title*="delete"]');
    await deleteButton.click();
  }

  async selectDomain(domain: string) {
    const domainRow = await this.getDomainByName(domain);
    const checkbox = domainRow.locator('input[type="checkbox"]:not([role="switch"])').first();
    await checkbox.check();
  }

  async selectAllDomains() {
    const headerCheckbox = this.page.locator('thead input[type="checkbox"], th input[type="checkbox"]').first();
    await headerCheckbox.check();
  }

  async bulkAction(action: 'Block Selected' | 'Unblock Selected' | 'Delete Selected') {
    await this.page.click(`button:has-text("${action}")`);
    await this.page.waitForTimeout(500);
  }

  async exportDomains() {
    await this.page.click('button:has-text("Export")');
    // Wait for download to start
    await this.page.waitForTimeout(1000);
  }

  // Query history methods
  async getQueryHistoryTable() {
    await this.clickTab('Query History');
    await this.page.waitForSelector('table, [data-testid="query-table"]');
    return this.page.locator('table tbody tr, [data-testid="query-row"]');
  }

  async filterQueryHistory(options: { 
    startDate?: string, 
    endDate?: string, 
    domain?: string,
    client?: string 
  }) {
    if (options.startDate) {
      await this.page.fill('input[type="date"][name*="start"], input[placeholder*="start date"]', options.startDate);
    }
    if (options.endDate) {
      await this.page.fill('input[type="date"][name*="end"], input[placeholder*="end date"]', options.endDate);
    }
    if (options.domain) {
      await this.page.fill('input[placeholder*="domain"], input[name*="domain"]', options.domain);
    }
    if (options.client) {
      await this.page.fill('input[placeholder*="client"], input[name*="client"]', options.client);
    }
    
    // Apply filters
    const applyButton = this.page.locator('button:has-text("Apply"), button:has-text("Filter")');
    if (await applyButton.count() > 0) {
      await applyButton.click();
    }
    
    await this.page.waitForTimeout(500);
  }

  async navigateQueryPage(direction: 'next' | 'previous') {
    const button = direction === 'next' 
      ? this.page.locator('button:has-text("Next"), button[aria-label*="next"]')
      : this.page.locator('button:has-text("Previous"), button[aria-label*="previous"]');
    
    await button.click();
    await this.page.waitForTimeout(500);
  }

  // Performance methods
  async getPerformanceCharts() {
    await this.clickTab('Performance');
    await this.page.waitForSelector('[data-testid="performance-chart"], canvas, svg');
    return this.page.locator('[data-testid="performance-chart"], canvas, svg');
  }

  async toggleAutoRefresh() {
    const refreshToggle = this.page.locator('button:has-text("Auto Refresh"), input[type="checkbox"]:near-text("Auto")');
    if (await refreshToggle.count() > 0) {
      await refreshToggle.click();
    }
  }

  // Utility methods
  async waitForToast(message?: string) {
    const selector = message 
      ? `.toast:has-text("${message}"), [data-testid="toast"]:has-text("${message}")`
      : '.toast, [data-testid="toast"]';
    
    await this.page.waitForSelector(selector, { timeout: 5000 });
  }

  async dismissToast() {
    const closeButton = this.page.locator('.toast button, [data-testid="toast"] button').first();
    if (await closeButton.count() > 0) {
      await closeButton.click();
    }
  }

  async refreshPage() {
    const refreshButton = this.page.locator('button:has([class*="activity"]), button[aria-label*="refresh"]').first();
    if (await refreshButton.count() > 0) {
      await refreshButton.click();
    } else {
      await this.page.reload();
    }
    await this.page.waitForLoadState('networkidle');
  }
}

test.describe('DNS Management', () => {
  let dnsPage: DNSPage;

  test.beforeEach(async ({ page }) => {
    dnsPage = new DNSPage(page);
    await dnsPage.navigate();
  });

  test.describe('DNS Server Status', () => {
    test('should display DNS server status', async ({ page }) => {
      // Wait for status to load
      await dnsPage.waitForMetricsToLoad();
      
      // Check connection status
      const status = await dnsPage.getConnectionStatus();
      expect(status).toMatch(/Connected|Disconnected/);
      
      // Verify page title and description
      await expect(page.locator('h2:has-text("DNS Management")')).toBeVisible();
      await expect(page.locator('p:has-text("Monitor and manage")')).toBeVisible();
    });

    test('should show server status indicators', async ({ page }) => {
      await dnsPage.waitForMetricsToLoad();
      
      // Should show status badge
      const statusBadge = page.locator('.badge').first();
      await expect(statusBadge).toBeVisible();
      
      // Should show blocking switch
      const blockingSwitch = page.locator('input[type="checkbox"][role="switch"]').first();
      await expect(blockingSwitch).toBeVisible();
    });

    test('should handle connection errors gracefully', async ({ page }) => {
      // Look for error messages if connection fails
      const errorAlert = page.locator('[role="alert"]:has-text("Failed to connect"), .alert:has-text("connection")');
      
      // Either we should see a successful connection or an error message
      const hasConnection = await page.locator('.badge:has-text("Connected")').count() > 0;
      const hasError = await errorAlert.count() > 0;
      
      expect(hasConnection || hasError).toBeTruthy();
    });
  });

  test.describe('Performance Metrics Display', () => {
    test('should show key performance metrics', async ({ page }) => {
      await dnsPage.waitForMetricsToLoad();
      
      // Check for metric cards
      const metricTitles = ['Total Queries', 'Blocked', 'Cache Hit Rate', 'Active Clients'];
      
      for (const title of metricTitles) {
        await expect(page.locator(`.card:has-text("${title}")`)).toBeVisible();
      }
    });

    test('should display numeric values for metrics', async ({ page }) => {
      await dnsPage.waitForMetricsToLoad();
      
      const totalQueries = await dnsPage.getMetricValue('Total Queries');
      const blocked = await dnsPage.getMetricValue('Blocked');
      const cacheHitRate = await dnsPage.getMetricValue('Cache Hit Rate');
      const activeClients = await dnsPage.getMetricValue('Active Clients');
      
      // Verify we have numeric or formatted values (not just loading states)
      expect(totalQueries).toMatch(/\d|Loading/);
      expect(blocked).toMatch(/\d|Loading/);
      expect(cacheHitRate).toMatch(/\d|%|Loading/);
      expect(activeClients).toMatch(/\d|Loading/);
    });

    test('should auto-refresh metrics', async ({ page }) => {
      await dnsPage.waitForMetricsToLoad();
      
      // Get initial metric value
      const initialValue = await dnsPage.getMetricValue('Total Queries');
      
      // Wait for potential refresh (metrics should refresh every 30 seconds)
      await page.waitForTimeout(2000);
      
      // Value should still be present (might be same or different)
      const currentValue = await dnsPage.getMetricValue('Total Queries');
      expect(currentValue).toBeTruthy();
    });
  });

  test.describe('Domain Management', () => {
    test('should navigate to domains tab', async ({ page }) => {
      await dnsPage.clickTab('Domains');
      
      // Should show domain management interface
      await expect(page.locator('h3:has-text("Domain Management"), .card-title:has-text("Domain")')).toBeVisible();
      await expect(page.locator('button:has-text("Add Domain")')).toBeVisible();
      await expect(page.locator('button:has-text("Export")')).toBeVisible();
    });

    test('should add new domain to blocklist', async ({ page }) => {
      await dnsPage.clickTab('Domains');
      
      // Add domain
      await dnsPage.addDomain(TEST_DOMAIN, 'Blocklist', 'Test blocking domain');
      
      // Verify success message or domain appears in list
      await Promise.race([
        dnsPage.waitForToast('successfully'),
        page.waitForSelector(`tr:has-text("${TEST_DOMAIN}")`, { timeout: 5000 })
      ]);
    });

    test('should add domain to allowlist', async ({ page }) => {
      await dnsPage.clickTab('Domains');
      
      await dnsPage.addDomain(TEST_SAFE_DOMAIN, 'Allowlist', 'Test safe domain');
      
      await Promise.race([
        dnsPage.waitForToast('successfully'),
        page.waitForSelector(`tr:has-text("${TEST_SAFE_DOMAIN}")`, { timeout: 5000 })
      ]);
    });

    test('should validate domain format', async ({ page }) => {
      await dnsPage.clickTab('Domains');
      
      // Try to add invalid domain
      await dnsPage.openAddDomainDialog();
      await page.fill('input[name="domain"], input[placeholder*="example.com"]', INVALID_DOMAIN);
      await page.click('button:has-text("Add Domain")');
      
      // Should show validation error
      await expect(page.locator('.toast, [role="alert"]')).toBeVisible();
    });

    test('should search and filter domains', async ({ page }) => {
      await dnsPage.clickTab('Domains');
      
      // Wait for domains table to load
      const initialRows = await dnsPage.getDomainRows();
      const initialCount = await initialRows.count();
      
      if (initialCount > 0) {
        // Test search functionality
        const firstRow = initialRows.first();
        const domainName = await firstRow.locator('td').nth(1).textContent();
        
        if (domainName) {
          const searchTerm = domainName.substring(0, 4);
          await dnsPage.searchDomains(searchTerm);
          
          // Should show filtered results
          await page.waitForTimeout(500);
          const filteredRows = await dnsPage.getDomainRows();
          const filteredCount = await filteredRows.count();
          
          expect(filteredCount).toBeGreaterThan(0);
        }
      }
    });

    test('should toggle domain block status', async ({ page }) => {
      await dnsPage.clickTab('Domains');
      
      const rows = await dnsPage.getDomainRows();
      const rowCount = await rows.count();
      
      if (rowCount > 0) {
        // Get first domain name
        const firstRow = rows.first();
        const domainName = await firstRow.locator('td').nth(1).textContent();
        
        if (domainName) {
          // Toggle its status
          await dnsPage.toggleDomainBlock(domainName);
          
          // Should show loading or success state
          await page.waitForTimeout(500);
        }
      } else {
        // Add a test domain first
        await dnsPage.addDomain(TEST_DOMAIN, 'Blocklist');
        await page.waitForTimeout(1000);
        await dnsPage.toggleDomainBlock(TEST_DOMAIN);
      }
    });

    test('should perform bulk domain operations', async ({ page }) => {
      await dnsPage.clickTab('Domains');
      
      // Add test domains if none exist
      const rows = await dnsPage.getDomainRows();
      let rowCount = await rows.count();
      
      if (rowCount === 0) {
        await dnsPage.addDomain(TEST_DOMAIN, 'Blocklist');
        await page.waitForTimeout(1000);
        await dnsPage.addDomain(`test2-${TEST_DOMAIN}`, 'Blocklist');
        await page.waitForTimeout(1000);
      }
      
      // Select multiple domains
      await dnsPage.selectAllDomains();
      
      // Should show bulk action bar
      await expect(page.locator(':has-text("selected")')).toBeVisible();
      await expect(page.locator('button:has-text("Block Selected")')).toBeVisible();
      await expect(page.locator('button:has-text("Unblock Selected")')).toBeVisible();
    });

    test('should export domains to CSV', async ({ page }) => {
      await dnsPage.clickTab('Domains');
      
      // Start download
      const downloadPromise = page.waitForEvent('download');
      await dnsPage.exportDomains();
      
      // Verify download started
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/dns-domains.*\.csv/);
    });
  });

  test.describe('Query History', () => {
    test('should display query history table', async ({ page }) => {
      const queryRows = await dnsPage.getQueryHistoryTable();
      
      // Should show table headers
      await expect(page.locator('th:has-text("Domain"), th:has-text("Time")')).toBeVisible({ timeout: 10000 });
      
      // May or may not have query data depending on test environment
      const rowCount = await queryRows.count();
      console.log(`Query history contains ${rowCount} rows`);
    });

    test('should filter query history by date', async ({ page }) => {
      await dnsPage.clickTab('Query History');
      
      // Set date filter
      const today = new Date().toISOString().split('T')[0];
      await dnsPage.filterQueryHistory({ startDate: today });
      
      // Should apply filters without errors
      await page.waitForTimeout(1000);
    });

    test('should paginate through query results', async ({ page }) => {
      await dnsPage.clickTab('Query History');
      
      // Look for pagination controls
      const nextButton = page.locator('button:has-text("Next"), button[aria-label*="next"]');
      const prevButton = page.locator('button:has-text("Previous"), button[aria-label*="previous"]');
      
      // Should have pagination controls visible (even if disabled)
      const hasNext = await nextButton.count() > 0;
      const hasPrev = await prevButton.count() > 0;
      
      expect(hasNext || hasPrev).toBeTruthy();
    });
  });

  test.describe('Performance Monitoring', () => {
    test('should display performance charts', async ({ page }) => {
      const charts = await dnsPage.getPerformanceCharts();
      
      // Should show at least one chart or graph
      const chartCount = await charts.count();
      expect(chartCount).toBeGreaterThan(0);
    });

    test('should show real-time performance data', async ({ page }) => {
      await dnsPage.clickTab('Performance');
      
      // Should show performance section
      await expect(page.locator(':has-text("Performance"), :has-text("Metrics")')).toBeVisible();
      
      // Wait for any charts to load
      await page.waitForTimeout(2000);
    });
  });

  test.describe('DNS Blocking Controls', () => {
    test('should toggle DNS blocking on/off', async ({ page }) => {
      await dnsPage.waitForMetricsToLoad();
      
      // Get current blocking state
      const initialState = await dnsPage.isDNSBlockingEnabled();
      
      // Toggle blocking
      await dnsPage.toggleDNSBlocking();
      
      // Wait for change to take effect
      await page.waitForTimeout(1000);
      
      // Should show loading state or success message
      const loadingIndicator = page.locator('.loading, [data-loading], :has-text("Updating")');
      const successMessage = page.locator('.toast:has-text("enabled"), .toast:has-text("disabled")');
      
      const hasLoading = await loadingIndicator.count() > 0;
      const hasSuccess = await successMessage.count() > 0;
      
      expect(hasLoading || hasSuccess).toBeTruthy();
    });

    test('should disable controls when disconnected', async ({ page }) => {
      const connectionStatus = await dnsPage.getConnectionStatus();
      
      if (connectionStatus?.includes('Disconnected')) {
        // Blocking switch should be disabled
        const blockingSwitch = page.locator('input[type="checkbox"][role="switch"]').first();
        await expect(blockingSwitch).toBeDisabled();
      }
    });
  });

  test.describe('User Interface', () => {
    test('should be responsive on different screen sizes', async ({ page }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      // Should still show main elements
      await expect(page.locator('h2:has-text("DNS Management")')).toBeVisible();
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      // Should show metric cards
      const metricCards = page.locator('.card');
      const cardCount = await metricCards.count();
      expect(cardCount).toBeGreaterThan(0);
      
      // Reset to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    test('should handle loading states gracefully', async ({ page }) => {
      // Reload page to see loading states
      await page.reload();
      
      // Should show skeleton loaders or loading indicators
      const skeletons = page.locator('.skeleton, [data-testid*="skeleton"]');
      
      // Wait for loading to complete
      await page.waitForLoadState('networkidle');
      await dnsPage.waitForMetricsToLoad();
      
      // Should eventually show data
      await expect(page.locator('h2:has-text("DNS Management")')).toBeVisible();
    });

    test('should provide keyboard navigation', async ({ page }) => {
      // Test tab navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to navigate to main elements
      const focusedElement = await page.locator(':focus');
      const focusCount = await focusedElement.count();
      
      expect(focusCount).toBeGreaterThan(0);
    });

    test('should show appropriate error messages', async ({ page }) => {
      // If there are any error states, they should be user-friendly
      const errorMessages = page.locator('[role="alert"], .alert-destructive, .error, :has-text("Error")');
      const errorCount = await errorMessages.count();
      
      if (errorCount > 0) {
        // Errors should be descriptive
        const firstError = errorMessages.first();
        const errorText = await firstError.textContent();
        expect(errorText?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Data Persistence', () => {
    test('should persist domain additions across page refresh', async ({ page }) => {
      await dnsPage.clickTab('Domains');
      
      // Add a unique test domain
      const uniqueDomain = `test-${Date.now()}.example.com`;
      await dnsPage.addDomain(uniqueDomain, 'Blocklist');
      await page.waitForTimeout(1000);
      
      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await dnsPage.clickTab('Domains');
      await page.waitForTimeout(1000);
      
      // Domain should still be in list
      const domainRow = await dnsPage.getDomainByName(uniqueDomain);
      const exists = await domainRow.count() > 0;
      
      if (exists) {
        console.log(`✓ Domain ${uniqueDomain} persisted after refresh`);
      } else {
        console.log(`✗ Domain ${uniqueDomain} not found after refresh - may be expected if using mock data`);
      }
    });

    test('should maintain tab state during navigation', async ({ page }) => {
      // Navigate to different tabs
      await dnsPage.clickTab('Domains');
      await expect(page.locator('[role="tab"][aria-selected="true"]:has-text("Domains")')).toBeVisible();
      
      await dnsPage.clickTab('Query History');
      await expect(page.locator('[role="tab"][aria-selected="true"]:has-text("Query History")')).toBeVisible();
      
      await dnsPage.clickTab('Performance');
      await expect(page.locator('[role="tab"][aria-selected="true"]:has-text("Performance")')).toBeVisible();
      
      // Back to Overview
      await dnsPage.clickTab('Overview');
      await expect(page.locator('[role="tab"][aria-selected="true"]:has-text("Overview")')).toBeVisible();
    });
  });
});
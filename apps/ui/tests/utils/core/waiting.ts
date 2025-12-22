import { Page, Locator } from '@playwright/test';

/**
 * Wait for the page to load
 * Uses 'load' state instead of 'networkidle' because the app has persistent
 * connections (websockets/polling) that prevent network from ever being idle.
 * Tests should wait for specific elements to verify page is ready.
 */
export async function waitForNetworkIdle(page: Page): Promise<void> {
  await page.waitForLoadState('load');
}

/**
 * Wait for an element with a specific data-testid to appear
 */
export async function waitForElement(
  page: Page,
  testId: string,
  options?: { timeout?: number; state?: 'attached' | 'visible' | 'hidden' }
): Promise<Locator> {
  const element = page.locator(`[data-testid="${testId}"]`);
  await element.waitFor({
    timeout: options?.timeout ?? 5000,
    state: options?.state ?? 'visible',
  });
  return element;
}

/**
 * Wait for an element with a specific data-testid to be hidden
 */
export async function waitForElementHidden(
  page: Page,
  testId: string,
  options?: { timeout?: number }
): Promise<void> {
  const element = page.locator(`[data-testid="${testId}"]`);
  await element.waitFor({
    timeout: options?.timeout ?? 5000,
    state: 'hidden',
  });
}

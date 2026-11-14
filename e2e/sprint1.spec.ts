import { test, expect } from '@playwright/test';

test.describe('TEST-12 (AC-12, NFR-04, NFR-05): End-to-End User Journey', () => {
  const syntheticCreator = {
    email: 'creator1@example.com',
    password: 'Password123!',
  };

  const syntheticRespondent = {
    email: 'respondent1@example.com',
    password: 'Password123!',
  };

  test('System Readiness Check (NFR-05)', async ({ request }) => {
    // Check GET /api/ready returns 200 with live DB connection
    const res = await request.get('/api/ready');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
  });

  test('Full User Journey: Creator & Respondent Flow with Theme & Error Validation', async ({ page }) => {
    // 1. Visit application and check Pastel Pink theme on header
    await page.goto('/');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Verify brand theme background color (#fadadd)
    const headerBgColor = await header.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // #fadadd in rgb is rgb(250, 218, 221)
    expect(headerBgColor).toContain('250, 218, 221');

    // 2. Creator Login Flow
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', syntheticCreator.email);
    await page.fill('input[type="password"], input[name="password"]', syntheticCreator.password);
    await page.click('button[type="submit"]');

    // Should navigate to campaigns dashboard
    await expect(page).toHaveURL(/\/campaigns/);

    // 3. Creator creates a new campaign
    await page.goto('/campaigns/new');
    const campaignTitle = `E2E Review Survey ${Date.now()}`;
    await page.fill('input[name="title"]', campaignTitle);
    await page.fill('textarea[name="description"]', 'E2E automated survey description');
    
    // Add question
    if (await page.locator('button:has-text("Add Question")').isVisible()) {
      await page.click('button:has-text("Add Question")');
    }
    await page.fill('input[name="questions[0].prompt"], input[placeholder*="prompt" i]', 'Overall rating');
    await page.click('button[type="submit"]:has-text("Publish"), button[type="submit"]:has-text("Create")');

    // Confirm campaign listed on dashboard
    await expect(page.locator(`text=${campaignTitle}`)).toBeVisible();

    // 4. Creator logs out
    await page.click('button:has-text("Log out"), button:has-text("Logout"), a:has-text("Logout")');
    await expect(page).toHaveURL(/\/login/);

    // 5. Respondent Login Flow
    await page.fill('input[type="email"], input[name="email"]', syntheticRespondent.email);
    await page.fill('input[type="password"], input[name="password"]', syntheticRespondent.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/campaigns/);

    // 6. Respondent fills and submits the campaign
    await page.click(`text=${campaignTitle}`);
    // Select rating 5
    await page.click('button[data-rating="5"], input[value="5"], button:has-text("5")');
    // Submit response
    await page.click('button[type="submit"]:has-text("Submit")');

    // Confirm success message
    await expect(page.locator('text=/submitted|thank you|success/i')).toBeVisible();

    // 7. Duplicate submission attempt (BR-01)
    await page.goto('/campaigns');
    await page.click(`text=${campaignTitle}`);
    if (await page.locator('button[type="submit"]:has-text("Submit")').isVisible()) {
      await page.click('button[data-rating="5"], input[value="5"], button:has-text("5")');
      await page.click('button[type="submit"]:has-text("Submit")');
    }

    // Must show crimson red (#dc2626) duplicate submission alert
    const errorAlert = page.locator('[role="alert"], .error-banner, .alert-error');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/already submitted|duplicate/i);

    const errorColor = await errorAlert.evaluate((el) => {
      return window.getComputedStyle(el).color || window.getComputedStyle(el).borderColor;
    });
    // #dc2626 in rgb is rgb(220, 38, 38)
    expect(errorColor).toContain('220, 38, 38');

    // 8. Respondent logs out
    await page.click('button:has-text("Log out"), button:has-text("Logout"), a:has-text("Logout")');

    // 9. Creator logs back in to view persisted results (AC-10)
    await page.fill('input[type="email"], input[name="email"]', syntheticCreator.email);
    await page.fill('input[type="password"], input[name="password"]', syntheticCreator.password);
    await page.click('button[type="submit"]');

    // View campaign results
    await page.click(`text=${campaignTitle}`);
    await page.click('a:has-text("Results"), button:has-text("Results")');

    // Results dashboard shows KPI summary on white card surface
    const resultsCard = page.locator('.results-card, main > div');
    await expect(resultsCard).toBeVisible();
    await expect(page.locator('text=/Total Submissions|Responses/i')).toBeVisible();
  });
});

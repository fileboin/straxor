import type {
  BrowserAdapter,
  BrowserCheckResult,
  BrowserVerificationRequest,
  BrowserVerificationResult,
  ScreenshotEntry,
  FormInteraction,
} from "./adapter.js";

const PLAYWRIGHT_SCRIPT = `
const { chromium } = require('playwright');

(async () => {
  const config = JSON.parse(process.argv[2] || '{}');
  const { url, checks, viewport, waitFor, forms, screenshotNames } = config;

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: viewport || { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];
  const screenshots = [];
  const checkResults = [];

  // Collect console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  // Collect network errors
  page.on('response', response => {
    if (response.status() >= 500) {
      networkErrors.push(\`\${response.status()} \${response.url()}\`);
    }
  });

  page.on('requestfailed', request => {
    networkErrors.push(\`FAILED \${request.url()} \${request.failure()?.errorText || ''}\`);
  });

  const enabledChecks = checks || ['page_load', 'no_js_errors', 'no_5xx', 'screenshot'];

  // --- page_load ---
  if (enabledChecks.includes('page_load')) {
    const start = Date.now();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const status = response?.status() || 0;
      const duration = Date.now() - start;
      checkResults.push({
        name: 'page_load',
        passed: status >= 200 && status < 400,
        evidence: \`Stranica učitana: HTTP \${status} (\${duration}ms)\`,
        duration,
      });
    } catch (err) {
      checkResults.push({
        name: 'page_load',
        passed: false,
        evidence: \`Greška pri učitavanju: \${err.message}\`,
        duration: Date.now() - start,
      });
    }
  }

  // Wait for dynamic content
  if (waitFor) {
    await page.waitForTimeout(waitFor);
  } else {
    await page.waitForTimeout(1000);
  }

  // --- forms_work ---
  if (enabledChecks.includes('forms_work') && forms && forms.length > 0) {
    const start = Date.now();
    let allPassed = true;
    const evidence = [];

    for (const form of forms) {
      try {
        const el = await page.$(form.selector);
        if (!el) {
          allPassed = false;
          evidence.push(\`❌ Selector nije pronađen: \${form.selector}\`);
          continue;
        }
        await el.fill(form.value);
        evidence.push(\`✅ \${form.selector} = "\${form.value}"\`);

        if (form.submit) {
          const formEl = await el.evaluateHandle(e => e.closest('form'));
          if (formEl) {
            await Promise.all([
              page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
              formEl.asElement()?.evaluate((f: any) => f.submit()),
            ]);
            evidence.push(\`✅ Forma submitana\`);
          }
        }
      } catch (err) {
        allPassed = false;
        evidence.push(\`❌ \${form.selector}: \${err.message}\`);
      }
    }

    checkResults.push({
      name: 'forms_work',
      passed: allPassed,
      evidence: evidence.join('\\n'),
      duration: Date.now() - start,
    });
  }

  // --- screenshot ---
  if (enabledChecks.includes('screenshot')) {
    const names = screenshotNames || ['full-page'];
    for (const name of names) {
      try {
        const buffer = await page.screenshot({
          fullPage: name === 'full-page' || name === 'fullpage',
          type: 'png',
        });
        screenshots.push({
          name,
          data: buffer.toString('base64'),
          timestamp: new Date().toISOString(),
          viewport: viewport || { width: 1280, height: 720 },
        });
      } catch (err) {
        screenshots.push({
          name,
          data: '',
          timestamp: new Date().toISOString(),
        });
      }
    }

    checkResults.push({
      name: 'screenshot',
      passed: screenshots.some(s => s.data),
      evidence: \`Screenshotovi: \${screenshots.filter(s => s.data).length}/\${names.length}\`,
    });
  }

  // --- no_js_errors (must run after page load) ---
  if (enabledChecks.includes('no_js_errors')) {
    checkResults.push({
      name: 'no_js_errors',
      passed: consoleErrors.length === 0,
      evidence: consoleErrors.length === 0
        ? 'Nema JS grešaka u konzoli'
        : \`\${consoleErrors.length} JS grešaka:\\n\${consoleErrors.slice(0, 5).join('\\n')}\`,
      consoleErrors,
    });
  }

  // --- no_5xx (must run after all requests) ---
  if (enabledChecks.includes('no_5xx')) {
    checkResults.push({
      name: 'no_5xx',
      passed: networkErrors.length === 0,
      evidence: networkErrors.length === 0
        ? 'Nema 5xx grešaka'
        : \`\${networkErrors.length} serverskih grešaka:\\n\${networkErrors.slice(0, 5).join('\\n')}\`,
      networkErrors,
    });
  }

  await browser.close();

  // Output as JSON
  const result = {
    checks: checkResults,
    screenshots,
    consoleErrors,
    networkErrors,
  };

  process.stdout.write(JSON.stringify(result));
})();
`;

export function createPlaywrightBrowserAdapter(
  executeCommand: (machineId: string, cmd: string) => Promise<string>
): BrowserAdapter {
  async function ensurePlaywright(machineId: string): Promise<void> {
    try {
      await executeCommand(
        machineId,
        'node -e "require(\'playwright\')" 2>/dev/null'
      );
    } catch {
      // Install playwright
      await executeCommand(
        machineId,
        'npm install -g playwright 2>/dev/null && npx playwright install chromium --with-deps 2>/dev/null || true'
      );
    }
  }

  async function runPlaywrightScript(
    machineId: string,
    config: Record<string, unknown>
  ): Promise<{
    checks: BrowserCheckResult[];
    screenshots: ScreenshotEntry[];
    consoleErrors: string[];
    networkErrors: string[];
  }> {
    await ensurePlaywright(machineId);

    // Write the script to VPS
    const escapedScript = PLAYWRIGHT_SCRIPT.replace(/'/g, "'\\''");
    const escapedConfig = JSON.stringify(config).replace(/'/g, "'\\''");

    const output = await executeCommand(
      machineId,
      `node -e '${escapedScript}' '${escapedConfig}' 2>/dev/null`
    );

    try {
      return JSON.parse(output.trim());
    } catch {
      throw new Error(`Playwright output parse failed: ${output.slice(0, 500)}`);
    }
  }

  return {
    async verify(req: BrowserVerificationRequest): Promise<BrowserVerificationResult> {
      const { machineId, url, checks, viewport, waitFor, forms, screenshotNames } = req;
      const startTime = Date.now();

      const result = await runPlaywrightScript(machineId, {
        url,
        checks,
        viewport,
        waitFor,
        forms,
        screenshotNames,
      });

      return {
        id: `browser-${Date.now()}`,
        url,
        checks: result.checks,
        screenshots: result.screenshots,
        overallPassed: result.checks.every((c) => c.passed),
        timestamp: new Date().toISOString(),
      };
    },

    async checkPageLoad(
      machineId: string,
      url: string,
      timeout = 30000
    ): Promise<BrowserCheckResult> {
      const result = await runPlaywrightScript(machineId, {
        url,
        checks: ["page_load"],
      });
      return (
        result.checks.find((c) => c.name === "page_load") || {
          name: "page_load",
          passed: false,
          evidence: "Check nije vraćen",
        }
      );
    },

    async checkJsErrors(
      machineId: string,
      url: string,
      waitFor?: number
    ): Promise<BrowserCheckResult> {
      const result = await runPlaywrightScript(machineId, {
        url,
        checks: ["no_js_errors"],
        waitFor,
      });
      return (
        result.checks.find((c) => c.name === "no_js_errors") || {
          name: "no_js_errors",
          passed: false,
          evidence: "Check nije vraćen",
        }
      );
    },

    async checkNetworkErrors(
      machineId: string,
      url: string
    ): Promise<BrowserCheckResult> {
      const result = await runPlaywrightScript(machineId, {
        url,
        checks: ["no_5xx"],
      });
      return (
        result.checks.find((c) => c.name === "no_5xx") || {
          name: "no_5xx",
          passed: false,
          evidence: "Check nije vraćen",
        }
      );
    },

    async checkForms(
      machineId: string,
      url: string,
      forms: FormInteraction[]
    ): Promise<BrowserCheckResult> {
      const result = await runPlaywrightScript(machineId, {
        url,
        checks: ["forms_work"],
        forms,
      });
      return (
        result.checks.find((c) => c.name === "forms_work") || {
          name: "forms_work",
          passed: false,
          evidence: "Check nije vraćen",
        }
      );
    },

    async takeScreenshot(
      machineId: string,
      url: string,
      name: string,
      viewport?: { width: number; height: number }
    ): Promise<ScreenshotEntry> {
      const result = await runPlaywrightScript(machineId, {
        url,
        checks: ["screenshot"],
        viewport,
        screenshotNames: [name],
      });
      return (
        result.screenshots[0] || {
          name,
          data: "",
          timestamp: new Date().toISOString(),
        }
      );
    },
  };
}

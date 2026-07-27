export type BrowserCheckName =
  | "page_load"
  | "no_js_errors"
  | "no_5xx"
  | "forms_work"
  | "screenshot";

export interface BrowserCheckResult {
  name: BrowserCheckName;
  passed: boolean;
  evidence: string;
  screenshot?: string;
  consoleErrors?: string[];
  networkErrors?: string[];
  duration?: number;
}

export interface ScreenshotEntry {
  name: string;
  data: string;
  timestamp: string;
  viewport?: { width: number; height: number };
}

export interface BrowserVerificationResult {
  id: string;
  url: string;
  checks: BrowserCheckResult[];
  screenshots: ScreenshotEntry[];
  overallPassed: boolean;
  timestamp: string;
}

export interface BrowserVerificationRequest {
  machineId: string;
  url: string;
  checks?: BrowserCheckName[];
  viewport?: { width: number; height: number };
  waitFor?: number;
  forms?: FormInteraction[];
  screenshotNames?: string[];
}

export interface FormInteraction {
  selector: string;
  value: string;
  submit?: boolean;
}

export interface BrowserAdapter {
  verify(req: BrowserVerificationRequest): Promise<BrowserVerificationResult>;
  checkPageLoad(
    machineId: string,
    url: string,
    timeout?: number
  ): Promise<BrowserCheckResult>;
  checkJsErrors(
    machineId: string,
    url: string,
    waitFor?: number
  ): Promise<BrowserCheckResult>;
  checkNetworkErrors(
    machineId: string,
    url: string
  ): Promise<BrowserCheckResult>;
  checkForms(
    machineId: string,
    url: string,
    forms: FormInteraction[]
  ): Promise<BrowserCheckResult>;
  takeScreenshot(
    machineId: string,
    url: string,
    name: string,
    viewport?: { width: number; height: number }
  ): Promise<ScreenshotEntry>;
}

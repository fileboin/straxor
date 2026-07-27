export type CheckName = "build" | "tests" | "diff" | "errors" | "files";

export interface CheckResult {
  name: CheckName;
  passed: boolean;
  evidence: string;
  duration?: number;
}

export interface VerificationResult {
  id: string;
  stepId: string;
  machineId: string;
  sessionId: string;
  overallPassed: boolean;
  checks: CheckResult[];
  timestamp: string;
}

export interface VerificationRequest {
  machineId: string;
  sessionId: string;
  stepId: string;
  checks?: CheckName[];
  projectPath?: string;
  filePatterns?: string[];
}

export interface VerifierAdapter {
  verify(req: VerificationRequest): Promise<VerificationResult>;
  verifyBuild(machineId: string, projectPath?: string): Promise<CheckResult>;
  verifyTests(machineId: string, projectPath?: string): Promise<CheckResult>;
  verifyDiff(machineId: string, sessionId: string): Promise<CheckResult>;
  verifyErrors(machineId: string, sessionId: string): Promise<CheckResult>;
  verifyFiles(machineId: string, patterns: string[]): Promise<CheckResult>;
}

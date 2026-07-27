const ONBOARDING_KEY = "straxor_onboarding_complete";

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function completeOnboarding(): void {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_KEY);
}

export type OnboardingStep = "ai-key" | "vps" | "git" | "project";

export const ONBOARDING_STEPS: { id: OnboardingStep; label: string; tagline: string }[] = [
  { id: "ai-key", label: "AI Ključ", tagline: "Moji ključevi" },
  { id: "vps", label: "VPS", tagline: "Moja infrastruktura" },
  { id: "git", label: "Git", tagline: "Moj kod" },
  { id: "project", label: "Projekt", tagline: "Moji projekti" },
];

import type { StratTab, StrategyOutput, MediaPlanResult } from "./orchestrationTypes";

const STORAGE_KEY = "bv_orchestration_plans";

export interface SavedOrchestration {
  id: string;
  savedAt: string;
  productName: string;
  productCategory: string;
  productDescription: string;
  businessObjective: string;
  audienceLabel: string;
  audienceCount: number;
  outputs: Partial<Record<StratTab, StrategyOutput>>;
  mediaPlan?: MediaPlanResult;
  rationale?: string;
}

export function loadSavedPlans(): SavedOrchestration[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOrchestrationPlan(
  plan: Omit<SavedOrchestration, "id" | "savedAt">,
): SavedOrchestration {
  const saved: SavedOrchestration = {
    ...plan,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const existing = loadSavedPlans();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...existing]));
  return saved;
}

export function deleteSavedPlan(id: string): void {
  const remaining = loadSavedPlans().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

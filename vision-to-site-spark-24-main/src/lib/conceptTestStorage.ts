import type { ConceptType, ConceptResult } from "./conceptTestTypes";

const STORAGE_KEY = "bv_concept_tests";

export interface SavedConceptTest {
  id: string;
  savedAt: string;
  conceptType: ConceptType;
  conceptName: string;
  category: string;
  description: string;
  activeDims: string[];
  audienceLabel: string;
  audienceCount: number;
  result: ConceptResult;
}

export function loadSavedTests(): SavedConceptTest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveConceptTest(
  test: Omit<SavedConceptTest, "id" | "savedAt">,
): SavedConceptTest {
  const saved: SavedConceptTest = {
    ...test,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const existing = loadSavedTests();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...existing]));
  return saved;
}

export function deleteSavedTest(id: string): void {
  const remaining = loadSavedTests().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

import type { SavedSurvey, SurveyQuestion, SurveyResults } from "./surveySimulatorTypes";

const STORAGE_KEY = "bv_saved_surveys";

export function loadSavedSurveys(): SavedSurvey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSurvey[]) : [];
  } catch {
    return [];
  }
}

export function saveSurvey(
  context: string,
  sampleSize: number,
  questions: SurveyQuestion[],
  results: SurveyResults
): SavedSurvey {
  const saved: SavedSurvey = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    context,
    sampleSize,
    questions,
    results,
  };
  const existing = loadSavedSurveys();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...existing]));
  return saved;
}

export function deleteSavedSurvey(id: string): void {
  const existing = loadSavedSurveys().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

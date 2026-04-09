import type { MonitorSource, MonitorResult } from "./monitorTypes";

const STORAGE_KEY = "bv_brand_monitors";

export interface SavedMonitor {
  id: string;
  savedAt: string;
  brand: string;
  competitors: string;
  topics: string;
  sources: MonitorSource[];
  audienceLabel: string;
  audienceCount: number;
  result: MonitorResult;
}

export function loadSavedMonitors(): SavedMonitor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMonitor(
  monitor: Omit<SavedMonitor, "id" | "savedAt">,
): SavedMonitor {
  const saved: SavedMonitor = {
    ...monitor,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const existing = loadSavedMonitors();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...existing]));
  return saved;
}

export function deleteSavedMonitor(id: string): void {
  const remaining = loadSavedMonitors().filter((m) => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

import type { DiscussionType, Participant, Message, SessionSummary } from "./focusGroupTypes";

const STORAGE_KEY = "bv_focus_groups";

export interface SavedFocusGroup {
  id: string;
  savedAt: string;
  discussionType: DiscussionType;
  topic: string;
  audienceLabel: string;
  audienceCount: number;
  participantCount: number;
  participants: Participant[];
  messages: Message[];
  summary?: SessionSummary;
}

export function loadSavedFocusGroups(): SavedFocusGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFocusGroup(
  session: Omit<SavedFocusGroup, "id" | "savedAt">,
): SavedFocusGroup {
  const saved: SavedFocusGroup = {
    ...session,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const existing = loadSavedFocusGroups();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...existing]));
  return saved;
}

export function deleteSavedFocusGroup(id: string): void {
  const remaining = loadSavedFocusGroups().filter((g) => g.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

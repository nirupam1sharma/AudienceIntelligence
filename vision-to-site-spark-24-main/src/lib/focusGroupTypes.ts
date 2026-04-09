export type DiscussionType = "concept-reaction" | "message-testing" | "category-exploration" | "brand-perception";

export interface Participant {
  id: string;
  name: string;
  initials: string;
  color: string;
  gender: string;
  age_group: string;
  profile: string;
}

export interface Message {
  id: string;
  role: "moderator" | "participant" | "system";
  participantId?: string;
  participantName?: string;
  color?: string;
  content: string;
  timestamp: string;
}

export interface SessionSummary {
  keyThemes: string[];
  keyQuotes: { quote: string; participant: string }[];
  overallSentiment: string;
  recommendations: string[];
}

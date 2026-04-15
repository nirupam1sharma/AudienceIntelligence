// ─── Survey Simulator Types ──────────────────────────────────────

export type QuestionType = "multiple_choice" | "rating" | "yes_no" | "open_ended";

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[]; // multiple_choice only
}

export interface RespondentAnswer {
  respondent_id: string;
  [key: string]: string | number;
}

export interface MCOption {
  option: string;
  count: number;
  pct: number;
}

export interface QuestionResult {
  questionId: string;
  questionText: string;
  type: QuestionType;
  // multiple_choice
  distribution?: MCOption[];
  // rating
  average?: number;
  ratingDistribution?: { value: number; count: number }[];
  // yes_no
  yesPct?: number;
  noPct?: number;
  yesCount?: number;
  noCount?: number;
  // open_ended
  verbatims?: string[];
}

export interface SurveyResults {
  n: number;
  questions: SurveyQuestion[];
  questionResults: QuestionResult[];
  fieldedAt: string;
  context: string;
  rawResponses: RespondentAnswer[];
}

export interface SavedSurvey {
  id: string;
  savedAt: string;
  context: string;
  sampleSize: number;
  questions: SurveyQuestion[];
  results: SurveyResults;
}

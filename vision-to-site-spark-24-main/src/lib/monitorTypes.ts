export type MonitorSource = "reddit" | "news" | "reviews" | "twitter";

export interface MonitorScorecard {
  awareness: number;
  sentiment: number;
  reputation: number;
  shareOfVoice: number;
}

export interface Verbatim {
  quote: string;
  source: MonitorSource;
  sentiment: "positive" | "negative" | "neutral";
}

export interface WatchItem {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
}

export interface MonitorResult {
  scorecard: MonitorScorecard;
  sentimentLabel: "positive" | "neutral" | "negative";
  sentimentSummary: string;
  keyThemes: string[];
  competitivePositioning: string;
  audienceAlignment: string;
  verbatims: Verbatim[];
  watchItems: WatchItem[];
}

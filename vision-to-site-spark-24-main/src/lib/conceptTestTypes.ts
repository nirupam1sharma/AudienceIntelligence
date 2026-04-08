export type ConceptType = "ad" | "product" | "message" | "brand";

export interface DimensionResult {
  name: string;
  score: number;
  rationale: string;
}

export interface Verbatim {
  quote: string;
  persona: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface SegmentReaction {
  segment: string;
  reaction: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface ConceptResult {
  overall_score: number;
  verdict_label: string;
  verdict_text: string;
  positive_pct: number;
  negative_pct: number;
  dimensions: DimensionResult[];
  strengths: string[];
  weaknesses: string[];
  segment_reactions: SegmentReaction[];
  verbatims: Verbatim[];
  recommendations: string[];
}

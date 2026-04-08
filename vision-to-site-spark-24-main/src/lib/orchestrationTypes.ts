export type StratTab = "brand" | "comms" | "ads" | "media";

export interface StrategySection { title: string; body: string; bullets: string[] }
export interface StrategyOutput { headline: string; summary: string; sections: StrategySection[] }

export interface PlatformPlanRow {
  id: string;
  platform: string;
  icon: string;
  color: string;
  allocationPct: number;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  clicks: number;
  cpc: number;
}

export interface MonthBudget { month: string; total: number; [key: string]: number | string }

export interface MediaPlanResult {
  totalBudget: number;
  totalImpressions: number;
  addressableReach: number;
  avgFrequency: number;
  blendedCpm: number;
  platforms: PlatformPlanRow[];
  monthlyFlighting: MonthBudget[];
}

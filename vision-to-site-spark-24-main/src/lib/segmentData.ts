import type { AudienceRecord } from "./audienceData";

// ─── Types ───────────────────────────────────────────────────────

export type SegFilterOp = "in" | "is_true" | "is_false";

export interface SegmentFilter {
  field: keyof AudienceRecord;
  op: SegFilterOp;
  values: string[];
}

export type SegmentMethod = "rules" | "nl";

export interface Segment {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  method: SegmentMethod;
  filters: SegmentFilter[];
  nlText?: string;
}

// ─── Refinement options (layered on top of a segment) ───────────

export interface RefinementState {
  gender: string[];   // [] = all
  age: string[];
  income: string[];
}

export const GENDER_OPTIONS = [
  { label: "All", values: [] },
  { label: "Male", values: ["Male"] },
  { label: "Female", values: ["Female"] },
  { label: "Non-binary", values: ["Non-binary"] },
];

export const AGE_OPTIONS = [
  { label: "All", values: [] },
  { label: "18–34", values: ["18-24", "25-34"] },
  { label: "25–54", values: ["25-34", "35-44", "45-54"] },
  { label: "45+", values: ["45-54", "55-64", "65+"] },
  { label: "55+", values: ["55-64", "65+"] },
];

export const INCOME_OPTIONS = [
  { label: "All", values: [] },
  { label: "Under $100k", values: ["Under $25K", "$25K-$49K", "$50K-$74K", "$75K-$99K"] },
  { label: "$100k+", values: ["$100K-$149K", "$150K+"] },
  { label: "$150k+", values: ["$150K+"] },
];

// ─── Rule builder column definitions ────────────────────────────

export interface RuleColumnOption {
  field: keyof AudienceRecord;
  label: string;
  type: "cat" | "bool";
  values?: { v: string; l: string }[];
}

export const RULE_COLUMNS: RuleColumnOption[] = [
  {
    field: "gender", label: "Gender", type: "cat",
    values: [{ v: "Male", l: "Male" }, { v: "Female", l: "Female" }, { v: "Non-binary", l: "Non-binary" }],
  },
  {
    field: "age_group", label: "Age Group", type: "cat",
    values: [
      { v: "18-24", l: "18–24" }, { v: "25-34", l: "25–34" }, { v: "35-44", l: "35–44" },
      { v: "45-54", l: "45–54" }, { v: "55-64", l: "55–64" }, { v: "65+", l: "65+" },
    ],
  },
  {
    field: "household_income_bracket", label: "Income", type: "cat",
    values: [
      { v: "Under $25K", l: "Under $25K" }, { v: "$25K-$49K", l: "$25K–$49K" },
      { v: "$50K-$74K", l: "$50K–$74K" }, { v: "$75K-$99K", l: "$75K–$99K" },
      { v: "$100K-$149K", l: "$100K–$149K" }, { v: "$150K+", l: "$150K+" },
    ],
  },
  {
    field: "race_ethnicity", label: "Race / Ethnicity", type: "cat",
    values: [
      { v: "White", l: "White" }, { v: "Black", l: "Black" },
      { v: "Hispanic", l: "Hispanic" }, { v: "Asian", l: "Asian" }, { v: "Other", l: "Other" },
    ],
  },
  { field: "facebook_usage", label: "Uses Facebook", type: "bool" },
  { field: "instagram_usage", label: "Uses Instagram", type: "bool" },
  { field: "tiktok_usage", label: "Uses TikTok", type: "bool" },
  { field: "youtube_usage", label: "Uses YouTube", type: "bool" },
  { field: "twitter_usage", label: "Uses Twitter/X", type: "bool" },
  { field: "linkedin_usage", label: "Uses LinkedIn", type: "bool" },
  { field: "reddit_usage", label: "Uses Reddit", type: "bool" },
  { field: "interest_fitness", label: "Interest: Fitness", type: "bool" },
  { field: "interest_travel", label: "Interest: Travel", type: "bool" },
  { field: "interest_technology", label: "Interest: Technology", type: "bool" },
  { field: "interest_health_wellness", label: "Interest: Health & Wellness", type: "bool" },
  { field: "interest_sports", label: "Interest: Sports", type: "bool" },
  { field: "interest_finance", label: "Interest: Finance", type: "bool" },
  { field: "interest_music", label: "Interest: Music", type: "bool" },
  { field: "interest_cooking", label: "Interest: Cooking", type: "bool" },
  { field: "interest_movies", label: "Interest: Movies", type: "bool" },
  { field: "interest_fashion", label: "Interest: Fashion", type: "bool" },
  { field: "interest_games", label: "Interest: Gaming", type: "bool" },
  { field: "is_high_income", label: "High Income ($100k+)", type: "bool" },
  { field: "is_social_active_daily", label: "Socially Active Daily", type: "bool" },
  { field: "uses_tv", label: "Watches TV", type: "bool" },
  { field: "uses_podcasts", label: "Listens to Podcasts", type: "bool" },
  { field: "uses_radio", label: "Listens to Radio", type: "bool" },
];

// ─── Filter logic ────────────────────────────────────────────────

export function applySegmentFilters(
  data: AudienceRecord[],
  filters: SegmentFilter[],
  refinement: RefinementState
): number[] {
  const indices: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    let pass = true;

    // Segment filters
    for (const f of filters) {
      const val = r[f.field];
      if (f.op === "in") {
        if (!f.values.includes(String(val))) { pass = false; break; }
      } else if (f.op === "is_true") {
        if (!val) { pass = false; break; }
      } else if (f.op === "is_false") {
        if (val) { pass = false; break; }
      }
    }
    if (!pass) continue;

    // Refinement layers
    if (refinement.gender.length && !refinement.gender.includes(r.gender)) continue;
    if (refinement.age.length && !refinement.age.includes(r.age_group)) continue;
    if (refinement.income.length && !refinement.income.includes(r.household_income_bracket)) continue;

    indices.push(i);
  }

  return indices;
}

// ─── NL → filters (simple local parser, same approach as audienceData) ──

export function parseSegmentNL(text: string): SegmentFilter[] {
  const filters: SegmentFilter[] = [];
  const t = text.toLowerCase();

  // Gender
  if (/\bwomen\b|\bfemale\b/.test(t)) filters.push({ field: "gender", op: "in", values: ["Female"] });
  else if (/\bmen\b|\bmale\b/.test(t)) filters.push({ field: "gender", op: "in", values: ["Male"] });

  // Age
  const ageValues: string[] = [];
  if (/\byoung\b|\bgen.?z\b|\b18.?24\b/.test(t)) ageValues.push("18-24");
  if (/\bmillennial\b|\b25.?34\b/.test(t)) ageValues.push("25-34");
  if (/\b35.?44\b|\bmiddle.?age/.test(t)) ageValues.push("35-44");
  if (/\b45.?54\b/.test(t)) ageValues.push("45-54");
  if (/\bolder\b|\bsenior\b|\b55.?64\b/.test(t)) ageValues.push("55-64");
  if (/\b65\+/.test(t)) ageValues.push("65+");
  if (ageValues.length) filters.push({ field: "age_group", op: "in", values: ageValues });

  // Income
  if (/\bhigh.?income\b|\baffluent\b|\bwealthy\b|\b100k\+/.test(t)) filters.push({ field: "is_high_income", op: "is_true", values: [] });

  // Social media
  if (/\binstagram\b/.test(t)) filters.push({ field: "instagram_usage", op: "is_true", values: [] });
  if (/\btiktok\b/.test(t)) filters.push({ field: "tiktok_usage", op: "is_true", values: [] });
  if (/\bfacebook\b/.test(t)) filters.push({ field: "facebook_usage", op: "is_true", values: [] });
  if (/\byoutube\b/.test(t)) filters.push({ field: "youtube_usage", op: "is_true", values: [] });
  if (/\blinkedin\b/.test(t)) filters.push({ field: "linkedin_usage", op: "is_true", values: [] });
  if (/\breddit\b/.test(t)) filters.push({ field: "reddit_usage", op: "is_true", values: [] });

  // Interests
  if (/\bfitness\b|\bgym\b|\bworkout\b/.test(t)) filters.push({ field: "interest_fitness", op: "is_true", values: [] });
  if (/\btravel\b/.test(t)) filters.push({ field: "interest_travel", op: "is_true", values: [] });
  if (/\btech\b|\btechnology\b/.test(t)) filters.push({ field: "interest_technology", op: "is_true", values: [] });
  if (/\bhealth\b|\bwellness\b/.test(t)) filters.push({ field: "interest_health_wellness", op: "is_true", values: [] });
  if (/\bsports?\b/.test(t)) filters.push({ field: "interest_sports", op: "is_true", values: [] });
  if (/\bfinance\b|\binvest/.test(t)) filters.push({ field: "interest_finance", op: "is_true", values: [] });
  if (/\bmusic\b/.test(t)) filters.push({ field: "interest_music", op: "is_true", values: [] });
  if (/\bcooking\b|\bfood\b/.test(t)) filters.push({ field: "interest_cooking", op: "is_true", values: [] });
  if (/\bgam(e|ing|er)\b/.test(t)) filters.push({ field: "interest_games", op: "is_true", values: [] });
  if (/\bfashion\b/.test(t)) filters.push({ field: "interest_fashion", op: "is_true", values: [] });

  return filters;
}

// ─── Persistence ─────────────────────────────────────────────────

const STORAGE_KEY = "bv_segments";

export function loadSegments(): Segment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSegments(segments: Segment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
  } catch {}
}

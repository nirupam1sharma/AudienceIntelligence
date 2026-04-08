import Papa from "papaparse";

export interface AudienceRecord {
  respondent_id: string;
  age: number;
  age_group: string;
  gender: string;
  household_income_bracket: string;
  race_ethnicity: string;
  facebook_usage: boolean;
  youtube_usage: boolean;
  instagram_usage: boolean;
  twitter_usage: boolean;
  linkedin_usage: boolean;
  snapchat_usage: boolean;
  reddit_usage: boolean;
  tiktok_usage: boolean;
  interest_live_sports: boolean;
  interest_news: boolean;
  interest_crime: boolean;
  interest_drama: boolean;
  interest_documentary: boolean;
  interest_comedy: boolean;
  interest_scifi: boolean;
  interest_reality: boolean;
  interest_talkshows: boolean;
  uses_tv: boolean;
  uses_podcasts: boolean;
  uses_radio: boolean;
  uses_magazines: boolean;
  uses_newspapers: boolean;
  interest_sports: boolean;
  interest_health_wellness: boolean;
  interest_music: boolean;
  interest_travel: boolean;
  interest_movies: boolean;
  interest_nature: boolean;
  interest_reading: boolean;
  interest_cooking: boolean;
  interest_shopping: boolean;
  interest_fitness: boolean;
  interest_technology: boolean;
  interest_finance: boolean;
  interest_games: boolean;
  interest_art: boolean;
  interest_fashion: boolean;
  value_family: number;
  value_working_hard: number;
  value_financial_responsibility: number;
  value_enjoying_life: number;
  value_healthy_lifestyle: number;
  value_self_improvement: number;
  value_honesty: number;
  value_environment: number;
  value_looking_good: number;
  value_wealth: number;
  is_social_active_daily: boolean;
  is_high_income: boolean;
}

const toBool = (v: string) => v === "1" || v === "Yes";
const toInt = (v: string) => parseInt(v, 10) || 0;

let cachedData: AudienceRecord[] | null = null;

// In development, invalidate the cache when this module is hot-replaced so
// stale data doesn't persist across HMR reloads.
if (import.meta.hot) {
  import.meta.hot.dispose(() => { cachedData = null; });
}

export async function loadAudienceData(): Promise<AudienceRecord[]> {
  if (cachedData) return cachedData;
  const res = await fetch("/data/audience_sample.csv");
  const text = await res.text();

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        cachedData = results.data.map((r: any) => ({
          respondent_id: r.respondent_id,
          age: toInt(r.age),
          age_group: r.age_group,
          gender: r.gender,
          household_income_bracket: r.household_income_bracket,
          race_ethnicity: r.race_ethnicity,
          facebook_usage: toBool(r.facebook_usage),
          youtube_usage: toBool(r.youtube_usage),
          instagram_usage: toBool(r.instagram_usage),
          twitter_usage: toBool(r.twitter_usage),
          linkedin_usage: toBool(r.linkedin_usage),
          snapchat_usage: toBool(r.snapchat_usage),
          reddit_usage: toBool(r.reddit_usage),
          tiktok_usage: toBool(r.tiktok_usage),
          interest_live_sports: toBool(r.interest_live_sports),
          interest_news: toBool(r.interest_news),
          interest_crime: toBool(r.interest_crime),
          interest_drama: toBool(r.interest_drama),
          interest_documentary: toBool(r.interest_documentary),
          interest_comedy: toBool(r.interest_comedy),
          interest_scifi: toBool(r.interest_scifi),
          interest_reality: toBool(r.interest_reality),
          interest_talkshows: toBool(r.interest_talkshows),
          uses_tv: toBool(r.uses_tv),
          uses_podcasts: toBool(r.uses_podcasts),
          uses_radio: toBool(r.uses_radio),
          uses_magazines: toBool(r.uses_magazines),
          uses_newspapers: toBool(r.uses_newspapers),
          interest_sports: toBool(r.interest_sports),
          interest_health_wellness: toBool(r.interest_health_wellness),
          interest_music: toBool(r.interest_music),
          interest_travel: toBool(r.interest_travel),
          interest_movies: toBool(r.interest_movies),
          interest_nature: toBool(r.interest_nature),
          interest_reading: toBool(r.interest_reading),
          interest_cooking: toBool(r.interest_cooking),
          interest_shopping: toBool(r.interest_shopping),
          interest_fitness: toBool(r.interest_fitness),
          interest_technology: toBool(r.interest_technology),
          interest_finance: toBool(r.interest_finance),
          interest_games: toBool(r.interest_games),
          interest_art: toBool(r.interest_art),
          interest_fashion: toBool(r.interest_fashion),
          value_family: toInt(r.value_family),
          value_working_hard: toInt(r.value_working_hard),
          value_financial_responsibility: toInt(r.value_financial_responsibility),
          value_enjoying_life: toInt(r.value_enjoying_life),
          value_healthy_lifestyle: toInt(r.value_healthy_lifestyle),
          value_self_improvement: toInt(r.value_self_improvement),
          value_honesty: toInt(r.value_honesty),
          value_environment: toInt(r.value_environment),
          value_looking_good: toInt(r.value_looking_good),
          value_wealth: toInt(r.value_wealth),
          is_social_active_daily: toBool(r.is_social_active_daily),
          is_high_income: toBool(r.is_high_income),
        }));
        resolve(cachedData!);
      },
      error: reject,
    });
  });
}

// Binary toggle filters: "any" = no filter, "yes" = must be true, "no" = must be false
export type ToggleValue = "any" | "yes" | "no";

export interface AudienceFilters {
  // Demographics (multi-select)
  ageGroups: string[];
  genders: string[];
  incomeBrackets: string[];
  raceEthnicities: string[];
  // Social media (toggle)
  facebook: ToggleValue;
  youtube: ToggleValue;
  instagram: ToggleValue;
  twitter: ToggleValue;
  linkedin: ToggleValue;
  snapchat: ToggleValue;
  reddit: ToggleValue;
  tiktok: ToggleValue;
  // TV Genres (toggle)
  tvLiveSports: ToggleValue;
  tvNews: ToggleValue;
  tvCrime: ToggleValue;
  tvDrama: ToggleValue;
  tvDocumentary: ToggleValue;
  tvComedy: ToggleValue;
  tvSciFi: ToggleValue;
  tvReality: ToggleValue;
  tvTalkShows: ToggleValue;
  // Media Channels (toggle)
  usesTV: ToggleValue;
  usesPodcasts: ToggleValue;
  usesRadio: ToggleValue;
  usesMagazines: ToggleValue;
  usesNewspapers: ToggleValue;
  // Interests (toggle)
  intSports: ToggleValue;
  intHealthWellness: ToggleValue;
  intMusic: ToggleValue;
  intTravel: ToggleValue;
  intMovies: ToggleValue;
  intNature: ToggleValue;
  intReading: ToggleValue;
  intCooking: ToggleValue;
  intShopping: ToggleValue;
  intFitness: ToggleValue;
  intTechnology: ToggleValue;
  intFinance: ToggleValue;
  intGames: ToggleValue;
  intArt: ToggleValue;
  intFashion: ToggleValue;
  // Derived
  isSocialActiveDaily: ToggleValue;
  isHighIncome: ToggleValue;
  // Search
  searchQuery: string;
}

export const DEFAULT_FILTERS: AudienceFilters = {
  ageGroups: [], genders: [], incomeBrackets: [], raceEthnicities: [],
  facebook: "any", youtube: "any", instagram: "any", twitter: "any",
  linkedin: "any", snapchat: "any", reddit: "any", tiktok: "any",
  tvLiveSports: "any", tvNews: "any", tvCrime: "any", tvDrama: "any",
  tvDocumentary: "any", tvComedy: "any", tvSciFi: "any", tvReality: "any", tvTalkShows: "any",
  usesTV: "any", usesPodcasts: "any", usesRadio: "any", usesMagazines: "any", usesNewspapers: "any",
  intSports: "any", intHealthWellness: "any", intMusic: "any", intTravel: "any",
  intMovies: "any", intNature: "any", intReading: "any", intCooking: "any",
  intShopping: "any", intFitness: "any", intTechnology: "any", intFinance: "any",
  intGames: "any", intArt: "any", intFashion: "any",
  isSocialActiveDaily: "any", isHighIncome: "any",
  searchQuery: "",
};

// Map filter keys to record keys for binary toggles
const TOGGLE_MAP: { filterKey: keyof AudienceFilters; recordKey: keyof AudienceRecord }[] = [
  { filterKey: "facebook", recordKey: "facebook_usage" },
  { filterKey: "youtube", recordKey: "youtube_usage" },
  { filterKey: "instagram", recordKey: "instagram_usage" },
  { filterKey: "twitter", recordKey: "twitter_usage" },
  { filterKey: "linkedin", recordKey: "linkedin_usage" },
  { filterKey: "snapchat", recordKey: "snapchat_usage" },
  { filterKey: "reddit", recordKey: "reddit_usage" },
  { filterKey: "tiktok", recordKey: "tiktok_usage" },
  { filterKey: "tvLiveSports", recordKey: "interest_live_sports" },
  { filterKey: "tvNews", recordKey: "interest_news" },
  { filterKey: "tvCrime", recordKey: "interest_crime" },
  { filterKey: "tvDrama", recordKey: "interest_drama" },
  { filterKey: "tvDocumentary", recordKey: "interest_documentary" },
  { filterKey: "tvComedy", recordKey: "interest_comedy" },
  { filterKey: "tvSciFi", recordKey: "interest_scifi" },
  { filterKey: "tvReality", recordKey: "interest_reality" },
  { filterKey: "tvTalkShows", recordKey: "interest_talkshows" },
  { filterKey: "usesTV", recordKey: "uses_tv" },
  { filterKey: "usesPodcasts", recordKey: "uses_podcasts" },
  { filterKey: "usesRadio", recordKey: "uses_radio" },
  { filterKey: "usesMagazines", recordKey: "uses_magazines" },
  { filterKey: "usesNewspapers", recordKey: "uses_newspapers" },
  { filterKey: "intSports", recordKey: "interest_sports" },
  { filterKey: "intHealthWellness", recordKey: "interest_health_wellness" },
  { filterKey: "intMusic", recordKey: "interest_music" },
  { filterKey: "intTravel", recordKey: "interest_travel" },
  { filterKey: "intMovies", recordKey: "interest_movies" },
  { filterKey: "intNature", recordKey: "interest_nature" },
  { filterKey: "intReading", recordKey: "interest_reading" },
  { filterKey: "intCooking", recordKey: "interest_cooking" },
  { filterKey: "intShopping", recordKey: "interest_shopping" },
  { filterKey: "intFitness", recordKey: "interest_fitness" },
  { filterKey: "intTechnology", recordKey: "interest_technology" },
  { filterKey: "intFinance", recordKey: "interest_finance" },
  { filterKey: "intGames", recordKey: "interest_games" },
  { filterKey: "intArt", recordKey: "interest_art" },
  { filterKey: "intFashion", recordKey: "interest_fashion" },
  { filterKey: "isSocialActiveDaily", recordKey: "is_social_active_daily" },
  { filterKey: "isHighIncome", recordKey: "is_high_income" },
];

function checkToggle(value: ToggleValue, recordVal: boolean): boolean {
  if (value === "any") return true;
  return value === "yes" ? recordVal : !recordVal;
}

export function applyFilters(data: AudienceRecord[], filters: AudienceFilters): AudienceRecord[] {
  return data.filter((r) => {
    if (filters.ageGroups.length > 0 && !filters.ageGroups.includes(r.age_group)) return false;
    if (filters.genders.length > 0 && !filters.genders.includes(r.gender)) return false;
    if (filters.incomeBrackets.length > 0 && !filters.incomeBrackets.includes(r.household_income_bracket)) return false;
    if (filters.raceEthnicities.length > 0 && !filters.raceEthnicities.includes(r.race_ethnicity)) return false;

    for (const { filterKey, recordKey } of TOGGLE_MAP) {
      if (!checkToggle(filters[filterKey] as ToggleValue, r[recordKey] as boolean)) return false;
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const searchable = `${r.respondent_id} ${r.gender} ${r.age_group} ${r.household_income_bracket} ${r.race_ethnicity}`.toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });
}

export function getUniqueValues(data: AudienceRecord[], key: keyof AudienceRecord): string[] {
  const values = new Set(data.map((r) => String(r[key])));
  return Array.from(values).sort();
}

// ─── NLP Query Parser ───────────────────────────────────────────
// Client-side keyword matching that interprets natural language and returns filter overrides

interface NlpRule {
  patterns: RegExp[];
  override: Partial<AudienceFilters> | ((current: Partial<AudienceFilters>) => Partial<AudienceFilters>);
}

const NLP_RULES: NlpRule[] = [
  // Demographics
  { patterns: [/\bmale\b/i, /\bmen\b/i], override: (f) => ({ genders: [...new Set([...(f.genders ?? []), "Male"])] }) },
  { patterns: [/\bfemale\b/i, /\bwomen\b/i], override: (f) => ({ genders: [...new Set([...(f.genders ?? []), "Female"])] }) },
  { patterns: [/\bnon.?binary\b/i], override: (f) => ({ genders: [...new Set([...(f.genders ?? []), "Non-binary"])] }) },
  { patterns: [/\byoung\b/i, /\byouth\b/i, /\bgen.?z\b/i, /\b18.?24\b/], override: (f) => ({ ageGroups: [...new Set([...(f.ageGroups ?? []), "18-24"])] }) },
  { patterns: [/\bmillennial/i, /\b25.?34\b/], override: (f) => ({ ageGroups: [...new Set([...(f.ageGroups ?? []), "25-34"])] }) },
  { patterns: [/\bmiddle.?age/i, /\b35.?44\b/], override: (f) => ({ ageGroups: [...new Set([...(f.ageGroups ?? []), "35-44"])] }) },
  { patterns: [/\b45.?54\b/], override: (f) => ({ ageGroups: [...new Set([...(f.ageGroups ?? []), "45-54"])] }) },
  { patterns: [/\bolder\b/i, /\bsenior/i, /\b55.?64\b/], override: (f) => ({ ageGroups: [...new Set([...(f.ageGroups ?? []), "55-64"])] }) },
  { patterns: [/\b65\+/i, /\b65\s*and\s*over/i, /\bretired\b/i], override: (f) => ({ ageGroups: [...new Set([...(f.ageGroups ?? []), "65+"])] }) },
  { patterns: [/\bhigh.?income\b/i, /\bwealthy\b/i, /\baffluent\b/i, /\brich\b/i, /\b100k\+/i], override: { isHighIncome: "yes" } },
  { patterns: [/\blow.?income\b/i], override: { isHighIncome: "no" } },
  // Social media
  { patterns: [/\bfacebook\b/i, /\bfb\b/i], override: { facebook: "yes" } },
  { patterns: [/\byoutube\b/i, /\byt\b/i], override: { youtube: "yes" } },
  { patterns: [/\binstagram\b/i, /\binsta\b/i, /\big\b/], override: { instagram: "yes" } },
  { patterns: [/\btwitter\b/i, /\bx\.com\b/i], override: { twitter: "yes" } },
  { patterns: [/\blinkedin\b/i], override: { linkedin: "yes" } },
  { patterns: [/\bsnapchat\b/i, /\bsnap\b/i], override: { snapchat: "yes" } },
  { patterns: [/\breddit\b/i], override: { reddit: "yes" } },
  { patterns: [/\btiktok\b/i, /\btik.?tok\b/i], override: { tiktok: "yes" } },
  { patterns: [/\bsocial.?active\b/i, /\bdaily.?social\b/i], override: { isSocialActiveDaily: "yes" } },
  // TV genres
  { patterns: [/\blive.?sports?\b/i], override: { tvLiveSports: "yes" } },
  { patterns: [/\bnews\b/i], override: { tvNews: "yes" } },
  { patterns: [/\bcrime\b/i, /\bdetective\b/i], override: { tvCrime: "yes" } },
  { patterns: [/\bdrama\b/i], override: { tvDrama: "yes" } },
  { patterns: [/\bdocumentar/i], override: { tvDocumentary: "yes" } },
  { patterns: [/\bcomedy\b/i, /\bfunny\b/i], override: { tvComedy: "yes" } },
  { patterns: [/\bsci.?fi\b/i, /\bscience.?fiction\b/i], override: { tvSciFi: "yes" } },
  { patterns: [/\breality\b/i, /\breality.?tv\b/i], override: { tvReality: "yes" } },
  { patterns: [/\btalk.?show/i], override: { tvTalkShows: "yes" } },
  // Media channels
  { patterns: [/\btelevision\b/i, /\btv\b/i], override: { usesTV: "yes" } },
  { patterns: [/\bpodcast/i], override: { usesPodcasts: "yes" } },
  { patterns: [/\bradio\b/i], override: { usesRadio: "yes" } },
  { patterns: [/\bmagazine/i], override: { usesMagazines: "yes" } },
  { patterns: [/\bnewspaper/i], override: { usesNewspapers: "yes" } },
  // Interests
  { patterns: [/\bsports?\b/i, /\bathletic/i], override: { intSports: "yes" } },
  { patterns: [/\bhealth\b/i, /\bwellness\b/i], override: { intHealthWellness: "yes" } },
  { patterns: [/\bmusic\b/i], override: { intMusic: "yes" } },
  { patterns: [/\btravel/i], override: { intTravel: "yes" } },
  { patterns: [/\bmovie/i, /\bfilm/i, /\bcinema/i], override: { intMovies: "yes" } },
  { patterns: [/\bnature\b/i, /\boutdoor/i], override: { intNature: "yes" } },
  { patterns: [/\bread(?:ing|er)/i, /\bbook/i], override: { intReading: "yes" } },
  { patterns: [/\bcook(?:ing)?\b/i, /\bfood\b/i, /\bculinar/i], override: { intCooking: "yes" } },
  { patterns: [/\bshopp(?:ing|er)/i], override: { intShopping: "yes" } },
  { patterns: [/\bfitness\b/i, /\bgym\b/i, /\bworkout/i, /\bexercis/i], override: { intFitness: "yes" } },
  { patterns: [/\btech(?:nology)?\b/i, /\bgadget/i], override: { intTechnology: "yes" } },
  { patterns: [/\bfinance\b/i, /\binvest/i, /\bstock/i], override: { intFinance: "yes" } },
  { patterns: [/\bgam(?:e|ing|er)/i], override: { intGames: "yes" } },
  { patterns: [/\bart\b/i, /\bartist/i, /\bpainting/i], override: { intArt: "yes" } },
  { patterns: [/\bfashion\b/i, /\bstyle\b/i], override: { intFashion: "yes" } },
];

export function parseNlpQuery(query: string): Partial<AudienceFilters> | null {
  if (!query || query.length < 3) return null;

  let partial: Partial<AudienceFilters> = {};
  let matched = false;

  for (const rule of NLP_RULES) {
    if (rule.patterns.some((p) => p.test(query))) {
      const patch = typeof rule.override === "function" ? rule.override(partial) : rule.override;
      partial = { ...partial, ...patch };
      matched = true;
    }
  }

  return matched ? partial : null;
}

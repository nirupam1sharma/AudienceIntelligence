import type { AudienceFilters } from "./audienceData";
import type { SegmentFilter } from "./segmentData";

const STORAGE_KEY = "anthropic_api_key";

export function getAnthropicKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setAnthropicKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export function deleteAnthropicKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

const FILTER_SCHEMA = `You are a filter parser for an audience intelligence dataset. Given a natural language query, return a JSON object with ONLY the filter keys that should be changed from their defaults.

Available filter keys and their types:

MULTI-SELECT (value = array of strings):
- ageGroups: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
- genders: ["Male", "Female", "Non-binary"]
- incomeBrackets: ["Under $25K", "$25K-$49K", "$50K-$74K", "$75K-$99K", "$100K-$149K", "$150K+"]
- raceEthnicities: ["White", "Black", "Hispanic", "Asian", "Other"]

TOGGLE (value = "yes" or "no", omit if "any"):
Social Media: facebook, youtube, instagram, twitter, linkedin, snapchat, reddit, tiktok
TV Genres: tvLiveSports, tvNews, tvCrime, tvDrama, tvDocumentary, tvComedy, tvSciFi, tvReality, tvTalkShows
Media: usesTV, usesPodcasts, usesRadio, usesMagazines, usesNewspapers
Interests: intSports, intHealthWellness, intMusic, intTravel, intMovies, intNature, intReading, intCooking, intShopping, intFitness, intTechnology, intFinance, intGames, intArt, intFashion
Derived: isSocialActiveDaily, isHighIncome

Return ONLY valid JSON. No explanation. Example:
Query: "young women who use Instagram and like fitness"
Response: {"ageGroups":["18-24"],"genders":["Female"],"instagram":"yes","intFitness":"yes"}`;

const SEGMENT_FILTER_SCHEMA = `You are a filter parser for an audience survey dataset. Given a natural language audience description, return a JSON array of segment filter objects.

CATEGORICAL fields (op must be "in", values must be an array of valid strings):
- "gender": valid values ["Male","Female","Non-binary"]
- "age_group": valid values ["18-24","25-34","35-44","45-54","55-64","65+"]
- "household_income_bracket": valid values ["Under $25K","$25K-$49K","$50K-$74K","$75K-$99K","$100K-$149K","$150K+"]
- "race_ethnicity": valid values ["White","Black","Hispanic","Asian","Other"]

BOOLEAN fields (op must be "is_true" or "is_false", values must be []):
Social media: facebook_usage, instagram_usage, tiktok_usage, youtube_usage, twitter_usage, linkedin_usage, reddit_usage
Interests: interest_fitness, interest_travel, interest_technology, interest_health_wellness, interest_sports, interest_finance, interest_music, interest_cooking, interest_movies, interest_fashion, interest_games
Other: is_high_income, is_social_active_daily, uses_tv, uses_podcasts, uses_radio

Return ONLY a valid JSON array, no explanation. Example:
Input: "young women on Instagram who like fitness"
Output: [{"field":"gender","op":"in","values":["Female"]},{"field":"age_group","op":"in","values":["18-24","25-34"]},{"field":"instagram_usage","op":"is_true","values":[]},{"field":"interest_fitness","op":"is_true","values":[]}]`;

export async function parseSegmentWithAnthropic(
  text: string,
  apiKey: string
): Promise<SegmentFilter[] | null> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: SEGMENT_FILTER_SCHEMA,
        messages: [{ role: "user", content: `Input: "${text}"` }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      if (response.status === 401) throw new Error("Invalid API key. Please check your Anthropic API key.");
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text?.trim();
    if (!rawText) return null;

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as SegmentFilter[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (err) {
    console.error("Anthropic segment parse error:", err);
    throw err;
  }
}

export async function parseWithAnthropic(
  query: string,
  apiKey: string
): Promise<Partial<AudienceFilters> | null> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: FILTER_SCHEMA,
        messages: [
          {
            role: "user",
            content: `Query: "${query}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      if (response.status === 401) {
        throw new Error("Invalid API key. Please check your Anthropic API key.");
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text) return null;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<AudienceFilters>;
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch (err) {
    console.error("Anthropic NLP parse error:", err);
    throw err;
  }
}

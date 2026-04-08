import type { AudienceRecord } from "@/lib/audienceData";
import type { Segment } from "@/lib/segmentData";
import DemographicCharts from "./DemographicCharts";
import HorizontalBarPanel from "./HorizontalBarPanel";
import StackedBarChart from "./StackedBarChart";
import CrosstabPanel from "./CrosstabPanel";

const SOCIAL_ITEMS = [
  { label: "Facebook", key: "facebook_usage" as keyof AudienceRecord },
  { label: "YouTube", key: "youtube_usage" as keyof AudienceRecord },
  { label: "Instagram", key: "instagram_usage" as keyof AudienceRecord },
  { label: "Twitter/X", key: "twitter_usage" as keyof AudienceRecord },
  { label: "LinkedIn", key: "linkedin_usage" as keyof AudienceRecord },
  { label: "Snapchat", key: "snapchat_usage" as keyof AudienceRecord },
  { label: "Reddit", key: "reddit_usage" as keyof AudienceRecord },
  { label: "TikTok", key: "tiktok_usage" as keyof AudienceRecord },
];

const INTEREST_ITEMS = [
  { label: "Sports", key: "interest_sports" as keyof AudienceRecord },
  { label: "Health/Wellness", key: "interest_health_wellness" as keyof AudienceRecord },
  { label: "Music", key: "interest_music" as keyof AudienceRecord },
  { label: "Travel", key: "interest_travel" as keyof AudienceRecord },
  { label: "Movies", key: "interest_movies" as keyof AudienceRecord },
  { label: "Nature", key: "interest_nature" as keyof AudienceRecord },
  { label: "Reading", key: "interest_reading" as keyof AudienceRecord },
  { label: "Cooking", key: "interest_cooking" as keyof AudienceRecord },
  { label: "Shopping", key: "interest_shopping" as keyof AudienceRecord },
  { label: "Fitness", key: "interest_fitness" as keyof AudienceRecord },
  { label: "Technology", key: "interest_technology" as keyof AudienceRecord },
  { label: "Finance", key: "interest_finance" as keyof AudienceRecord },
  { label: "Games", key: "interest_games" as keyof AudienceRecord },
  { label: "Art", key: "interest_art" as keyof AudienceRecord },
  { label: "Fashion", key: "interest_fashion" as keyof AudienceRecord },
];

const TV_ITEMS = [
  { label: "Live Sports", key: "interest_live_sports" as keyof AudienceRecord },
  { label: "News", key: "interest_news" as keyof AudienceRecord },
  { label: "Crime/Detective", key: "interest_crime" as keyof AudienceRecord },
  { label: "Drama", key: "interest_drama" as keyof AudienceRecord },
  { label: "Documentary", key: "interest_documentary" as keyof AudienceRecord },
  { label: "Comedy", key: "interest_comedy" as keyof AudienceRecord },
  { label: "Sci-Fi", key: "interest_scifi" as keyof AudienceRecord },
  { label: "Reality", key: "interest_reality" as keyof AudienceRecord },
  { label: "Talk Shows", key: "interest_talkshows" as keyof AudienceRecord },
];

const MEDIA_ITEMS = [
  { label: "Television", key: "uses_tv" as keyof AudienceRecord },
  { label: "Podcasts", key: "uses_podcasts" as keyof AudienceRecord },
  { label: "Radio", key: "uses_radio" as keyof AudienceRecord },
  { label: "Magazines", key: "uses_magazines" as keyof AudienceRecord },
  { label: "Newspaper", key: "uses_newspapers" as keyof AudienceRecord },
];

const VALUE_ITEMS = [
  { label: "Family", key: "value_family" as keyof AudienceRecord },
  { label: "Working Hard", key: "value_working_hard" as keyof AudienceRecord },
  { label: "Financial Resp.", key: "value_financial_responsibility" as keyof AudienceRecord },
  { label: "Enjoying Life", key: "value_enjoying_life" as keyof AudienceRecord },
  { label: "Healthy Lifestyle", key: "value_healthy_lifestyle" as keyof AudienceRecord },
  { label: "Self-improvement", key: "value_self_improvement" as keyof AudienceRecord },
  { label: "Honesty", key: "value_honesty" as keyof AudienceRecord },
  { label: "Environment", key: "value_environment" as keyof AudienceRecord },
  { label: "Looking Good", key: "value_looking_good" as keyof AudienceRecord },
  { label: "Wealth", key: "value_wealth" as keyof AudienceRecord },
];

interface Props {
  data: AudienceRecord[];
  allData?: AudienceRecord[];
  segments?: Segment[];
}

const AudienceReporting = ({ data, allData, segments }: Props) => {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-surface-card-border bg-surface-card p-8 text-center text-hero-muted text-sm">
        No data to report. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DemographicCharts data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HorizontalBarPanel title="Top Interests & Hobbies" items={INTEREST_ITEMS} data={data} />
        <HorizontalBarPanel title="Social Media Usage" items={SOCIAL_ITEMS} data={data} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HorizontalBarPanel title="TV Genre Preferences" items={TV_ITEMS} data={data} />
        <HorizontalBarPanel title="Media Channel Usage" items={MEDIA_ITEMS} data={data} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HorizontalBarPanel title="Core Values" items={VALUE_ITEMS} data={data} booleanMode={false} />
      </div>

      <StackedBarChart data={data} allData={allData} segments={segments} />
      <CrosstabPanel data={data} allData={allData} segments={segments} />
    </div>
  );
};

export default AudienceReporting;

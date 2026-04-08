import { useMemo } from "react";
import { Users, UserCheck, Calendar, DollarSign, Smartphone } from "lucide-react";
import type { AudienceRecord } from "@/lib/audienceData";

interface InsightsProps {
  data: AudienceRecord[];
  total: number;
}

const AudienceInsights = ({ data, total }: InsightsProps) => {
  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const n = data.length;
    const femalePct = Math.round((data.filter((r) => r.gender === "Female").length / n) * 100);

    // Find the most common age group
    const ageCounts: Record<string, number> = {};
    data.forEach((r) => { ageCounts[r.age_group] = (ageCounts[r.age_group] || 0) + 1; });
    const medianAgeGroup = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    const highIncomePct = Math.round((data.filter((r) => r.is_high_income).length / n) * 100);
    const socialActivePct = Math.round((data.filter((r) => r.is_social_active_daily).length / n) * 100);

    return { femalePct, medianAgeGroup, highIncomePct, socialActivePct };
  }, [data]);

  if (!stats) {
    return (
      <div className="text-center py-12 text-hero-muted">
        No matching respondents. Adjust your filters.
      </div>
    );
  }

  const cards = [
    { icon: Users, label: "Audience Size", value: data.length.toLocaleString(), sub: `${((data.length / total) * 100).toFixed(1)}% of universe` },
    { icon: UserCheck, label: "Female", value: `${stats.femalePct}%`, sub: "Gender split" },
    { icon: Calendar, label: "Top Age Group", value: stats.medianAgeGroup, sub: "Most common" },
    { icon: DollarSign, label: "$100K+ Income", value: `${stats.highIncomePct}%`, sub: "High earners" },
    { icon: Smartphone, label: "Social Active", value: `${stats.socialActivePct}%`, sub: "Daily+ SM usage" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="p-4 rounded-xl bg-surface-card border border-surface-card-border hover:border-glow transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <card.icon className="h-4 w-4 text-glow-accent" />
            <span className="text-xs text-hero-muted uppercase tracking-wider">{card.label}</span>
          </div>
          <div className="text-xl font-bold text-hero-foreground">{card.value}</div>
          <div className="text-xs text-hero-muted mt-1">{card.sub}</div>
        </div>
      ))}
    </div>
  );
};

export default AudienceInsights;

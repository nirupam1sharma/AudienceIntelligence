import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import type { AudienceRecord } from "@/lib/audienceData";

const AGE_ORDER = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const INCOME_ORDER = ["<50K", "50-74K", "75-99K", "100-149K", "150-199K", "200K+"];
const PIE_COLORS = ["hsl(45, 90%, 55%)", "hsl(210, 100%, 55%)", "hsl(160, 70%, 50%)", "hsl(25, 85%, 55%)", "hsl(280, 60%, 60%)", "hsl(330, 70%, 55%)"];
const BAR_FILL = "hsl(160, 60%, 45%)";

const chartTooltipStyle = {
  backgroundColor: "hsl(222, 35%, 12%)",
  border: "1px solid hsl(222, 25%, 18%)",
  borderRadius: "8px",
  color: "hsl(210, 40%, 98%)",
  fontSize: 12,
};

interface Props {
  data: AudienceRecord[];
}

function countByField(data: AudienceRecord[], key: keyof AudienceRecord, order?: string[]) {
  const counts: Record<string, number> = {};
  data.forEach((r) => { const v = String(r[key]); counts[v] = (counts[v] || 0) + 1; });
  const entries = Object.entries(counts).map(([name, count]) => ({
    name, count, pct: Math.round((count / data.length) * 100),
  }));
  if (order) {
    return order.map((name) => entries.find((e) => e.name === name) || { name, count: 0, pct: 0 });
  }
  return entries.sort((a, b) => b.count - a.count);
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }: any) => {
  if (pct < 5) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{pct}%</text>;
};

const DemographicCharts = ({ data }: Props) => {
  const ageData = useMemo(() => countByField(data, "age_group", AGE_ORDER), [data]);
  const genderData = useMemo(() => countByField(data, "gender"), [data]);
  const incomeData = useMemo(() => countByField(data, "household_income_bracket", INCOME_ORDER), [data]);
  const raceData = useMemo(() => countByField(data, "race_ethnicity"), [data]);

  if (data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Age Distribution */}
      <div className="rounded-xl bg-surface-card border border-surface-card-border p-6">
        <h3 className="text-sm font-semibold text-hero-foreground uppercase tracking-wider mb-4">Age Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 18%)" />
              <XAxis dataKey="name" tick={{ fill: "hsl(220, 15%, 65%)", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(220, 15%, 65%)", fontSize: 11 }} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number, _: string, p: any) => [`${v} (${p.payload.pct}%)`, "Count"]} />
              <Bar dataKey="count" fill={BAR_FILL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gender Split */}
      <div className="rounded-xl bg-surface-card border border-surface-card-border p-6">
        <h3 className="text-sm font-semibold text-hero-foreground uppercase tracking-wider mb-4">Gender Split</h3>
        <div className="h-64 flex items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={genderData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={renderCustomLabel} labelLine={false}>
                {genderData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number, name: string) => [`${v} (${Math.round((v / data.length) * 100)}%)`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2 ml-2 flex-shrink-0">
            {genderData.map((g, i) => (
              <div key={g.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-xs text-hero-foreground whitespace-nowrap">{g.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Household Income */}
      <div className="rounded-xl bg-surface-card border border-surface-card-border p-6">
        <h3 className="text-sm font-semibold text-hero-foreground uppercase tracking-wider mb-4">Household Income</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 18%)" />
              <XAxis dataKey="name" tick={{ fill: "hsl(220, 15%, 65%)", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(220, 15%, 65%)", fontSize: 11 }} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number, _: string, p: any) => [`${v} (${p.payload.pct}%)`, "Count"]} />
              <Bar dataKey="count" fill={BAR_FILL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Race / Ethnicity */}
      <div className="rounded-xl bg-surface-card border border-surface-card-border p-6">
        <h3 className="text-sm font-semibold text-hero-foreground uppercase tracking-wider mb-4">Race / Ethnicity</h3>
        <div className="h-64 flex items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={raceData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={renderCustomLabel} labelLine={false}>
                {raceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number, name: string) => [`${v} (${Math.round((v / data.length) * 100)}%)`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2 ml-2 flex-shrink-0">
            {raceData.map((g, i) => (
              <div key={g.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-xs text-hero-foreground whitespace-nowrap">{g.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemographicCharts;

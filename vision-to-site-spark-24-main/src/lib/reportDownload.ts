import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AudienceRecord } from "./audienceData";
import type { Segment } from "./segmentData";
import type { ConceptResult, ConceptType } from "./conceptTestTypes";
import type { StrategyOutput, MediaPlanResult } from "./orchestrationTypes";
import type { Participant, Message, SessionSummary, DiscussionType } from "./focusGroupTypes";
import type { MonitorSource, MonitorResult } from "./monitorTypes";

// Brand colour
const BRAND = "#004638";
const BRAND_LIGHT = "#e6f0ec";
const GREY_DARK = "#1a1a1a";
const GREY_MID = "#555555";
const GREY_LIGHT = "#dddddd";
const WHITE = "#ffffff";

// ─── Helpers ───────────────────────────────────────────────────────

/** Strip emoji and any character outside Latin-1 (0x00-0xFF) so jsPDF Helvetica renders cleanly */
function sanitize(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")   // emoji block (most pictographs)
    .replace(/[\u2600-\u27BF]/g, "")            // misc symbols, dingbats
    .replace(/[^\x00-\xFF]/g, "")               // anything else outside Latin-1
    .replace(/\s+/g, " ")                        // collapse any double-spaces left behind
    .trim();
}

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

function countBy(data: AudienceRecord[], key: keyof AudienceRecord): Record<string, number> {
  const out: Record<string, number> = {};
  data.forEach((r) => {
    const v = String(r[key]);
    out[v] = (out[v] || 0) + 1;
  });
  return out;
}

function countBoolean(data: AudienceRecord[], key: keyof AudienceRecord): number {
  return data.filter((r) => r[key] === true).length;
}

function countNumericHigh(data: AudienceRecord[], key: keyof AudienceRecord): number {
  return data.filter((r) => (r[key] as number) >= 4).length;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b] as [number, number, number];
}

// ─── Drawing primitives ────────────────────────────────────────────

function setFill(doc: jsPDF, hex: string) {
  doc.setFillColor(...hexToRgb(hex));
}

function setDraw(doc: jsPDF, hex: string) {
  doc.setDrawColor(...hexToRgb(hex));
}

function setTextColor(doc: jsPDF, hex: string) {
  doc.setTextColor(...hexToRgb(hex));
}

function pageW(doc: jsPDF) { return doc.internal.pageSize.getWidth(); }
function pageH(doc: jsPDF) { return doc.internal.pageSize.getHeight(); }

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  const safeTitle    = sanitize(title);
  const safeSubtitle = sanitize(subtitle);
  setFill(doc, BRAND);
  doc.rect(0, 0, pageW(doc), 22, "F");
  setTextColor(doc, WHITE);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("BIG VILLAGE", 14, 10);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("AUDIENCE INTELLIGENCE", 14, 15);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const titleX = pageW(doc) / 2;
  doc.text(safeTitle, titleX, 9, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(safeSubtitle, titleX, 15, { align: "center" });
  // date top-right
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.text(dateStr, pageW(doc) - 14, 15, { align: "right" });
}

function addFooter(doc: jsPDF, pageNum: number) {
  const y = pageH(doc) - 8;
  setFill(doc, BRAND);
  doc.rect(0, pageH(doc) - 12, pageW(doc), 12, "F");
  setTextColor(doc, WHITE);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("© Big Village Audience Intelligence — Confidential", 14, y);
  doc.text(`Page ${pageNum}`, pageW(doc) - 14, y, { align: "right" });
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  setTextColor(doc, BRAND);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(text.toUpperCase(), 14, y);
  setDraw(doc, BRAND);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1.5, pageW(doc) - 14, y + 1.5);
  return y + 7;
}

/** Draw a single horizontal bar row */
function drawBarRow(
  doc: jsPDF,
  label: string,
  value: number,
  total: number,
  y: number,
  barMaxW: number,
  barX: number,
  barH = 4,
) {
  const fraction = total > 0 ? value / total : 0;
  const pctVal = Math.round(fraction * 100);
  const barW = fraction * barMaxW;

  // Label
  setTextColor(doc, GREY_MID);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(label, barX - 2, y + barH * 0.75, { align: "right" });

  // Background bar
  setFill(doc, GREY_LIGHT);
  doc.rect(barX, y, barMaxW, barH, "F");

  // Value bar
  setFill(doc, BRAND);
  if (barW > 0) doc.rect(barX, y, barW, barH, "F");

  // Percentage text
  setTextColor(doc, GREY_DARK);
  doc.setFontSize(7);
  doc.text(`${pctVal}%`, barX + barMaxW + 2, y + barH * 0.75);

  return y + barH + 2;
}

/** Draw a two-column grid of bar charts */
function drawBarGrid(
  doc: jsPDF,
  items: { label: string; count: number }[],
  total: number,
  startY: number,
  title: string,
  colX: number,
  colW: number,
): number {
  const labelW = 36;
  const barMaxW = colW - labelW - 14;
  const barX = colX + labelW;

  let y = sectionTitle(doc, title, startY);
  items.forEach((item) => {
    y = drawBarRow(doc, item.label, item.count, total, y, barMaxW, barX);
  });
  return y + 4;
}

// ─── KPI Summary Box ──────────────────────────────────────────────

function addKpiRow(
  doc: jsPDF,
  stats: { label: string; value: string; sub: string }[],
  y: number,
) {
  const n = stats.length;
  const totalW = pageW(doc) - 28;
  const boxW = totalW / n;
  stats.forEach((s, i) => {
    const x = 14 + i * boxW;
    setFill(doc, BRAND_LIGHT);
    setDraw(doc, GREY_LIGHT);
    doc.roundedRect(x, y, boxW - 2, 18, 1.5, 1.5, "FD");
    setTextColor(doc, BRAND);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(s.value, x + (boxW - 2) / 2, y + 8, { align: "center" });
    setTextColor(doc, GREY_MID);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(s.label, x + (boxW - 2) / 2, y + 13, { align: "center" });
    doc.text(s.sub, x + (boxW - 2) / 2, y + 16.5, { align: "center" });
  });
  return y + 24;
}

// ─── Main export ──────────────────────────────────────────────────

export interface ReportOptions {
  data: AudienceRecord[];
  allData: AudienceRecord[];
  audienceLabel: string;
  activeSegment?: Segment | null;
  appliedQuery?: string | null;
  /** Optional pre-computed crosstab (from CrosstabPanel state) */
  crosstab?: {
    rowLabel: string;
    colLabel: string;
    rows: string[];
    cols: string[];
    counts: Record<string, Record<string, number>>;
    rowTotals: Record<string, number>;
    colTotals: Record<string, number>;
    grand: number;
  } | null;
}

export function downloadReport(opts: ReportOptions) {
  const { data, allData, appliedQuery, crosstab } = opts;
  const audienceLabel = sanitize(opts.audienceLabel); // strip emoji/non-Latin-1 for jsPDF
  const n = data.length;
  const total = allData.length;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let page = 1;

  // ── Page 1: Cover + Summary ──────────────────────────────────────
  addHeader(doc, "Intelligence Report", `Audience: ${audienceLabel}`);

  let y = 30;

  // Description box
  setFill(doc, BRAND_LIGHT);
  setDraw(doc, BRAND);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, pageW(doc) - 28, 14, 2, 2, "FD");
  setTextColor(doc, BRAND);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Audience Description", 18, y + 5);
  setTextColor(doc, GREY_DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const descLines: string[] = [];
  descLines.push(`Selected audience: ${audienceLabel}  ·  n = ${n.toLocaleString()} respondents  ·  ${pct(n, total)}% of total universe (${total.toLocaleString()})`);
  if (appliedQuery) descLines.push(`AI/NL query applied: "${appliedQuery}"`);
  descLines.forEach((line, li) => doc.text(line, 18, y + 9.5 + li * 4));
  y += 20;

  // KPI cards
  const femalePct = pct(data.filter((r) => r.gender === "Female").length, n);
  const ageCounts = countBy(data, "age_group");
  const topAgeGroup = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const highIncomePct = pct(countBoolean(data, "is_high_income"), n);
  const socialActivePct = pct(countBoolean(data, "is_social_active_daily"), n);

  y = addKpiRow(doc, [
    { label: "Audience Size", value: n.toLocaleString(), sub: `${pct(n, total)}% of universe` },
    { label: "Female", value: `${femalePct}%`, sub: "Gender split" },
    { label: "Top Age Group", value: topAgeGroup, sub: "Most common" },
    { label: "$100K+ Income", value: `${highIncomePct}%`, sub: "High earners" },
    { label: "Daily Social", value: `${socialActivePct}%`, sub: "Active SM users" },
  ], y);

  // ── Demographics ─────────────────────────────────────────────────
  y = sectionTitle(doc, "Demographics", y);

  const midX = pageW(doc) / 2;
  const colW = midX - 14;

  // Gender
  const genderCounts = countBy(data, "gender");
  const genderItems = Object.entries(genderCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const incomeItems = Object.entries(countBy(data, "household_income_bracket"))
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const ageItems = Object.entries(ageCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));

  const raceItems = Object.entries(countBy(data, "race_ethnicity"))
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const labelW = 36;
  // Left: gender + income; Right: age + race
  const leftBarX = 14 + labelW;
  const leftBarMaxW = colW - labelW - 8;
  const rightBarX = midX + labelW;
  const rightBarMaxW = colW - labelW - 8;

  // Left: Gender
  setTextColor(doc, BRAND);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Gender", leftBarX - 2, y, { align: "right" });

  // Right: Age Group
  doc.text("Age Group", rightBarX - 2, y, { align: "right" });
  y += 3;

  const maxLeftRows = Math.max(genderItems.length, incomeItems.length);
  const maxRightRows = Math.max(ageItems.length, raceItems.length);
  let leftY = y;
  let rightY = y;

  genderItems.forEach((item) => {
    leftY = drawBarRow(doc, item.label, item.count, n, leftY, leftBarMaxW, leftBarX);
  });
  ageItems.forEach((item) => {
    rightY = drawBarRow(doc, item.label, item.count, n, rightY, rightBarMaxW, rightBarX);
  });
  y = Math.max(leftY, rightY) + 4;

  // Left: Income; Right: Race/Ethnicity
  leftY = y; rightY = y;
  setTextColor(doc, BRAND);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Household Income", leftBarX - 2, y, { align: "right" });
  doc.text("Race / Ethnicity", rightBarX - 2, y, { align: "right" });
  y += 3;
  leftY = y; rightY = y;

  incomeItems.forEach((item) => {
    leftY = drawBarRow(doc, item.label, item.count, n, leftY, leftBarMaxW, leftBarX);
  });
  raceItems.forEach((item) => {
    rightY = drawBarRow(doc, item.label, item.count, n, rightY, rightBarMaxW, rightBarX);
  });
  y = Math.max(leftY, rightY) + 6;

  // ── Page 2: Social, Interests, TV, Media, Values ──────────────────
  if (y > 190) {
    addFooter(doc, page++);
    doc.addPage();
    addHeader(doc, "Intelligence Report", `Audience: ${audienceLabel}`);
    y = 30;
  }

  const SOCIAL = [
    { label: "Facebook", key: "facebook_usage" as keyof AudienceRecord },
    { label: "YouTube", key: "youtube_usage" as keyof AudienceRecord },
    { label: "Instagram", key: "instagram_usage" as keyof AudienceRecord },
    { label: "Twitter/X", key: "twitter_usage" as keyof AudienceRecord },
    { label: "LinkedIn", key: "linkedin_usage" as keyof AudienceRecord },
    { label: "Snapchat", key: "snapchat_usage" as keyof AudienceRecord },
    { label: "Reddit", key: "reddit_usage" as keyof AudienceRecord },
    { label: "TikTok", key: "tiktok_usage" as keyof AudienceRecord },
  ];
  const INTERESTS = [
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
  const TV = [
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
  const MEDIA = [
    { label: "Television", key: "uses_tv" as keyof AudienceRecord },
    { label: "Podcasts", key: "uses_podcasts" as keyof AudienceRecord },
    { label: "Radio", key: "uses_radio" as keyof AudienceRecord },
    { label: "Magazines", key: "uses_magazines" as keyof AudienceRecord },
    { label: "Newspapers", key: "uses_newspapers" as keyof AudienceRecord },
  ];
  const VALUES = [
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

  // Helper to build boolean items list sorted desc
  const toItems = (arr: { label: string; key: keyof AudienceRecord }[]) =>
    arr.map(({ label, key }) => ({ label, count: countBoolean(data, key) }))
       .sort((a, b) => b.count - a.count);

  // Two-column layout for charts
  const renderTwoCol = (
    leftTitle: string,
    leftItems: { label: string; count: number }[],
    rightTitle: string,
    rightItems: { label: string; count: number }[],
  ) => {
    if (y > 230) {
      addFooter(doc, page++);
      doc.addPage();
      addHeader(doc, "Intelligence Report", `Audience: ${audienceLabel}`);
      y = 30;
    }
    y = sectionTitle(doc, `${leftTitle}  ·  ${rightTitle}`, y);
    let leftColY = y;
    let rightColY = y;

    setTextColor(doc, BRAND);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(leftTitle, leftBarX - 2, y - 2, { align: "right" });
    doc.text(rightTitle, rightBarX - 2, y - 2, { align: "right" });

    leftItems.forEach((item) => {
      leftColY = drawBarRow(doc, item.label, item.count, n, leftColY, leftBarMaxW, leftBarX);
    });
    rightItems.forEach((item) => {
      rightColY = drawBarRow(doc, item.label, item.count, n, rightColY, rightBarMaxW, rightBarX);
    });
    y = Math.max(leftColY, rightColY) + 6;
  };

  renderTwoCol("Top Interests & Hobbies", toItems(INTERESTS), "Social Media Usage", toItems(SOCIAL));
  renderTwoCol("TV Genre Preferences", toItems(TV), "Media Channel Usage", toItems(MEDIA));

  if (y > 230) {
    addFooter(doc, page++);
    doc.addPage();
    addHeader(doc, "Intelligence Report", `Audience: ${audienceLabel}`);
    y = 30;
  }

  // Core values — single column (full width) — numeric scale 1-5, count >= 4
  y = sectionTitle(doc, "Core Values (rated 4 or 5 out of 5)", y);
  const valueItems = VALUES
    .map(({ label, key }) => ({ label, count: countNumericHigh(data, key) }))
    .sort((a, b) => b.count - a.count);
  const fullBarX = 14 + 46;
  const fullBarMaxW = pageW(doc) - 28 - 46 - 14;
  valueItems.forEach((item) => {
    y = drawBarRow(doc, item.label, item.count, n, y, fullBarMaxW, fullBarX, 5);
  });
  y += 6;

  // ── Crosstab page ─────────────────────────────────────────────────
  if (crosstab && crosstab.rows.length > 0) {
    addFooter(doc, page++);
    doc.addPage();
    addHeader(doc, "Cross-Tabulation", `${crosstab.rowLabel} × ${crosstab.colLabel}`);
    y = 30;

    y = sectionTitle(doc, `${crosstab.rowLabel} × ${crosstab.colLabel}`, y);

    const head: string[] = [
      `${crosstab.rowLabel} \\ ${crosstab.colLabel}`,
      ...crosstab.cols,
      "Total",
    ];

    const body: (string | number)[][] = crosstab.rows.map((row) => [
      row,
      ...crosstab.cols.map((col) => {
        const val = crosstab.counts[row]?.[col] || 0;
        const p = crosstab.rowTotals[row] ? Math.round((val / crosstab.rowTotals[row]) * 100) : 0;
        return `${val} (${p}%)`;
      }),
      crosstab.rowTotals[row] ?? 0,
    ]);

    // Totals row
    body.push([
      "Total",
      ...crosstab.cols.map((col) => crosstab.colTotals[col] ?? 0),
      crosstab.grand,
    ]);

    autoTable(doc, {
      head: [head],
      body,
      startY: y,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: GREY_LIGHT, lineWidth: 0.2 },
      headStyles: {
        fillColor: hexToRgb(BRAND),
        textColor: hexToRgb(WHITE),
        fontStyle: "bold",
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: hexToRgb(BRAND_LIGHT) },
      foot: [],
      didDrawCell: (hookData) => {
        // Highlight totals row
        if (hookData.row.index === body.length - 1) {
          doc.setFillColor(...hexToRgb(BRAND));
          doc.rect(hookData.cell.x, hookData.cell.y, hookData.cell.width, hookData.cell.height, "F");
          doc.setTextColor(...hexToRgb(WHITE));
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.text(
            String(hookData.cell.raw ?? ""),
            hookData.cell.x + hookData.cell.width / 2,
            hookData.cell.y + hookData.cell.height / 2 + 1,
            { align: "center" },
          );
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY + 6 || y + 20;
  }

  // Final footer
  addFooter(doc, page);

  // Save
  const dateTag = new Date().toISOString().slice(0, 10);
  const slug = audienceLabel.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`BigVillage_Report_${slug}_${dateTag}.pdf`);
}

// ─── Shared crosstab data type (exported for CrosstabCard) ─────────

export interface CrosstabExportData {
  rowLabel: string;
  colLabel: string;
  rows: string[];
  cols: string[];
  counts: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grand: number;
}

// ─── Crosstab-only PDF ─────────────────────────────────────────────

export function downloadCrosstabPdf(opts: {
  crosstab: CrosstabExportData;
  audienceLabel: string;
  title?: string;
}) {
  const { crosstab, audienceLabel, title = "Cross-Tabulation" } = opts;

  const landscape = crosstab.cols.length > 5;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  addHeader(doc, title, `${crosstab.rowLabel} × ${crosstab.colLabel}`);

  let y = 28;
  // Audience info bar
  setFill(doc, BRAND_LIGHT);
  setDraw(doc, BRAND);
  doc.setLineWidth(0.2);
  doc.roundedRect(14, y, pageW(doc) - 28, 8, 1, 1, "FD");
  setTextColor(doc, BRAND);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Audience: ${audienceLabel}  ·  n = ${crosstab.grand.toLocaleString()} respondents`,
    18,
    y + 5,
  );
  y += 13;

  const head = [
    [`${crosstab.rowLabel} \\ ${crosstab.colLabel}`, ...crosstab.cols, "Total"],
  ];
  const body: (string | number)[][] = crosstab.rows.map((row) => [
    row,
    ...crosstab.cols.map((col) => {
      const val = crosstab.counts[row]?.[col] || 0;
      const p = crosstab.rowTotals[row]
        ? Math.round((val / crosstab.rowTotals[row]) * 100)
        : 0;
      return `${val} (${p}%)`;
    }),
    crosstab.rowTotals[row] ?? 0,
  ]);
  body.push([
    "Total",
    ...crosstab.cols.map((col) => crosstab.colTotals[col] ?? 0),
    crosstab.grand,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3, lineColor: GREY_LIGHT, lineWidth: 0.2 },
    headStyles: {
      fillColor: hexToRgb(BRAND),
      textColor: hexToRgb(WHITE),
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: hexToRgb(BRAND_LIGHT) },
    foot: [],
    didDrawCell: (hookData) => {
      if (hookData.row.index === body.length - 1) {
        doc.setFillColor(...hexToRgb(BRAND));
        doc.rect(hookData.cell.x, hookData.cell.y, hookData.cell.width, hookData.cell.height, "F");
        doc.setTextColor(...hexToRgb(WHITE));
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(
          String(hookData.cell.raw ?? ""),
          hookData.cell.x + hookData.cell.width / 2,
          hookData.cell.y + hookData.cell.height / 2 + 1,
          { align: "center" },
        );
      }
    },
  });

  addFooter(doc, 1);
  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`CrossTab_${crosstab.rowLabel}_x_${crosstab.colLabel}_${dateTag}.pdf`.replace(/[^a-z0-9._-]/gi, "_"));
}

// ─── Crosstab CSV ──────────────────────────────────────────────────

export function downloadCrosstabCsv(opts: {
  crosstab: CrosstabExportData;
  audienceLabel: string;
}) {
  const { crosstab, audienceLabel } = opts;
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const lines: string[] = [];
  lines.push(`"Audience","${audienceLabel.replace(/"/g, '""')}"`);
  lines.push(`"n","${crosstab.grand}"`);
  lines.push("");

  // Header
  lines.push(
    [escape(`${crosstab.rowLabel} \\ ${crosstab.colLabel}`), ...crosstab.cols.map(escape), escape("Total")].join(","),
  );

  // Data rows
  crosstab.rows.forEach((row) => {
    lines.push(
      [
        escape(row),
        ...crosstab.cols.map((col) => {
          const val = crosstab.counts[row]?.[col] || 0;
          const p = crosstab.rowTotals[row]
            ? Math.round((val / crosstab.rowTotals[row]) * 100)
            : 0;
          return escape(`${val} (${p}%)`);
        }),
        escape(String(crosstab.rowTotals[row] ?? 0)),
      ].join(","),
    );
  });

  // Totals row
  lines.push(
    [
      escape("Total"),
      ...crosstab.cols.map((col) => escape(String(crosstab.colTotals[col] ?? 0))),
      escape(String(crosstab.grand)),
    ].join(","),
  );

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CrossTab_${crosstab.rowLabel}_x_${crosstab.colLabel}_${new Date().toISOString().slice(0, 10)}.csv`.replace(/[^a-z0-9._-]/gi, "_");
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Concept Test PDF ──────────────────────────────────────────────

const CONCEPT_TYPE_LABELS: Record<ConceptType, string> = {
  ad: "Ad / Campaign",
  product: "Product",
  message: "Message",
  brand: "Brand Idea",
};

export function downloadConceptTestPdf(opts: {
  conceptType: ConceptType;
  conceptName: string;
  category: string;
  description: string;
  audienceLabel: string;
  audienceCount: number;
  savedAt?: string;
  result: ConceptResult;
}) {
  const { conceptType, conceptName, category, description, audienceLabel, audienceCount, savedAt, result } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let page = 1;

  const title = conceptName || "Untitled Concept";
  const dateStr = savedAt
    ? new Date(savedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ── Page 1 ────────────────────────────────────────────────────────
  addHeader(doc, "Concept Test Report", title);
  addFooter(doc, page);
  let y = 28;

  // Concept info box
  setFill(doc, BRAND_LIGHT);
  setDraw(doc, BRAND);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, pageW(doc) - 28, 22, 2, 2, "FD");

  setTextColor(doc, BRAND);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("CONCEPT TYPE", 18, y + 5);
  doc.text("AUDIENCE", 75, y + 5);
  doc.text("DATE", 145, y + 5);

  setTextColor(doc, GREY_DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(CONCEPT_TYPE_LABELS[conceptType], 18, y + 10);
  doc.text(`${audienceLabel}  (n=${audienceCount.toLocaleString()})`, 75, y + 10);
  doc.text(dateStr, 145, y + 10);

  if (category) {
    setTextColor(doc, GREY_MID);
    doc.setFontSize(7);
    doc.text(`Category: ${category}`, 18, y + 16);
  }

  // Description (truncated)
  setTextColor(doc, GREY_MID);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  const descLines = doc.splitTextToSize(description, pageW(doc) - 36);
  const shownLines = descLines.slice(0, 2);
  if (descLines.length > 2) shownLines[1] = shownLines[1].replace(/\s*$/, "…");
  doc.text(shownLines, 18, y + 20);
  y += 28;

  // Overall score banner
  const scoreCol = result.overall_score >= 70 ? "#22c55e" : result.overall_score >= 50 ? "#eab308" : "#ef4444";
  setFill(doc, scoreCol);
  doc.roundedRect(14, y, 44, 28, 2, 2, "F");
  setTextColor(doc, WHITE);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(String(result.overall_score), 36, y + 16, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("/ 100", 36, y + 22, { align: "center" });

  setFill(doc, BRAND_LIGHT);
  doc.roundedRect(62, y, pageW(doc) - 76, 28, 2, 2, "F");
  setTextColor(doc, BRAND);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(result.verdict_label, 68, y + 9);
  setTextColor(doc, GREY_DARK);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  const verdictLines = doc.splitTextToSize(result.verdict_text, pageW(doc) - 80);
  doc.text(verdictLines.slice(0, 2), 68, y + 16);

  // Sentiment
  doc.setFontSize(7);
  setTextColor(doc, "#22c55e");
  doc.text(`● ${result.positive_pct}% likely to engage`, 68, y + 25);
  setTextColor(doc, "#ef4444");
  doc.text(`● ${result.negative_pct}% unlikely to engage`, 120, y + 25);
  y += 34;

  // Dimension scores table
  y = sectionTitle(doc, "Dimension Scores", y);
  autoTable(doc, {
    head: [["Dimension", "Score", "Rationale"]],
    body: result.dimensions.map((d) => [d.name, `${d.score} / 100`, d.rationale]),
    startY: y,
    margin: { left: 14, right: 14 },
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 22, halign: "center" }, 2: { cellWidth: "auto" } },
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: GREY_LIGHT, lineWidth: 0.2 },
    headStyles: { fillColor: hexToRgb(BRAND), textColor: hexToRgb(WHITE), fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: hexToRgb(BRAND_LIGHT) },
    didDrawCell: (hook) => {
      // Colour the score cell
      if (hook.column.index === 1 && hook.row.index >= 0 && hook.section === "body") {
        const score = result.dimensions[hook.row.index]?.score ?? 0;
        const col = score >= 70 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
        doc.setTextColor(...hexToRgb(col));
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(
          `${score}`,
          hook.cell.x + hook.cell.width / 2,
          hook.cell.y + hook.cell.height / 2 + 1,
          { align: "center" },
        );
      }
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;

  // ── Page 2 ────────────────────────────────────────────────────────
  addFooter(doc, page++);
  doc.addPage();
  addHeader(doc, "Concept Test Report", title);
  y = 28;

  // Strengths & Weaknesses side by side
  const halfW = (pageW(doc) - 34) / 2;
  y = sectionTitle(doc, "Strengths & Weaknesses", y);

  const strengthRows = result.strengths.map((s) => ["✓", s]);
  const weaknessRows = result.weaknesses.map((w) => ["✗", w]);

  autoTable(doc, {
    head: [["", "Strengths"]],
    body: strengthRows,
    startY: y,
    margin: { left: 14, right: pageW(doc) / 2 + 2 },
    columnStyles: { 0: { cellWidth: 6, halign: "center" } },
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: GREY_LIGHT, lineWidth: 0.2 },
    headStyles: { fillColor: [34, 197, 94] as [number, number, number], textColor: hexToRgb(WHITE), fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 253, 244] as [number, number, number] },
  });

  autoTable(doc, {
    head: [["", "Weaknesses / Risks"]],
    body: weaknessRows,
    startY: y,
    margin: { left: pageW(doc) / 2 + 2, right: 14 },
    columnStyles: { 0: { cellWidth: 6, halign: "center" } },
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: GREY_LIGHT, lineWidth: 0.2 },
    headStyles: { fillColor: [234, 179, 8] as [number, number, number], textColor: hexToRgb(WHITE), fontStyle: "bold" },
    alternateRowStyles: { fillColor: [254, 252, 232] as [number, number, number] },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = Math.max((doc as any).lastAutoTable?.finalY ?? y, y) + 8;

  // Segment reactions
  y = sectionTitle(doc, "Segment Reactions", y);
  autoTable(doc, {
    head: [["Sub-group", "Reaction", "Sentiment"]],
    body: result.segment_reactions.map((sr) => [sr.segment, sr.reaction, sr.sentiment.toUpperCase()]),
    startY: y,
    margin: { left: 14, right: 14 },
    columnStyles: { 0: { cellWidth: 40 }, 2: { cellWidth: 22, halign: "center" } },
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: GREY_LIGHT, lineWidth: 0.2 },
    headStyles: { fillColor: hexToRgb(BRAND), textColor: hexToRgb(WHITE), fontStyle: "bold" },
    alternateRowStyles: { fillColor: hexToRgb(BRAND_LIGHT) },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY + 8 || y + 30;

  // Consumer Verbatims
  if (y > 200) {
    addFooter(doc, page++);
    doc.addPage();
    addHeader(doc, "Concept Test Report", title);
    y = 28;
  }
  y = sectionTitle(doc, "Consumer Verbatims", y);
  autoTable(doc, {
    head: [["Quote", "Persona", "Sentiment"]],
    body: result.verbatims.map((v) => [`"${v.quote}"`, v.persona, v.sentiment.toUpperCase()]),
    startY: y,
    margin: { left: 14, right: 14 },
    columnStyles: { 0: { fontStyle: "italic" }, 1: { cellWidth: 40 }, 2: { cellWidth: 22, halign: "center" } },
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: GREY_LIGHT, lineWidth: 0.2 },
    headStyles: { fillColor: hexToRgb(BRAND), textColor: hexToRgb(WHITE), fontStyle: "bold" },
    alternateRowStyles: { fillColor: hexToRgb(BRAND_LIGHT) },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;

  // Recommendations
  if (y > 210) {
    addFooter(doc, page++);
    doc.addPage();
    addHeader(doc, "Concept Test Report", title);
    y = 28;
  }
  y = sectionTitle(doc, "Optimization Recommendations", y);
  result.recommendations.forEach((rec, i) => {
    // Number badge
    setFill(doc, BRAND);
    doc.circle(18, y + 2.5, 3, "F");
    setTextColor(doc, WHITE);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(String(i + 1), 18, y + 3.5, { align: "center" });

    setTextColor(doc, GREY_DARK);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(rec, pageW(doc) - 42);
    doc.text(lines, 24, y + 3);
    y += lines.length * 5 + 4;
  });

  addFooter(doc, page);
  const dateTag = new Date().toISOString().slice(0, 10);
  const slug = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`ConceptTest_${slug}_${dateTag}.pdf`);
}

// ─── Orchestration PDF ─────────────────────────────────────────────

export interface OrchestrationExportOpts {
  productName: string;
  productCategory: string;
  productDescription: string;
  businessObjective: string;
  audienceLabel: string;
  audienceCount: number;
  outputs: Partial<Record<string, StrategyOutput>>;
  mediaPlan?: MediaPlanResult;
  rationale?: string;
}

function fmt$(n: number) {
  return "$" + (n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + "M" : n >= 1_000 ? (n / 1_000).toFixed(1) + "K" : n.toFixed(2));
}
function fmtN(n: number) {
  return n >= 1_000_000_000 ? (n / 1_000_000_000).toFixed(1) + "B"
    : n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000 ? (n / 1_000).toFixed(0) + "K"
    : Math.round(n).toLocaleString();
}

export function downloadOrchestrationPdf(opts: OrchestrationExportOpts) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = pageW(doc);
  let page = 1;

  const TAB_LABELS: Record<string, string> = {
    brand: "Brand Strategy",
    comms: "Communications",
    ads: "Ad Tactics",
  };

  const addStrategyOutput = (type: string, output: StrategyOutput) => {
    if (page > 1) doc.addPage();
    addHeader(doc, opts.productName || "Orchestration Report", TAB_LABELS[type] || type);
    addFooter(doc, page);
    let y = 30;

    // Headline banner — height adapts to wrapped summary text
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const sumLines = doc.splitTextToSize(output.summary, W - 36);
    const lineH = 4.5;
    const bannerH = 14 + sumLines.length * lineH;   // 14 = headline row + top/bottom padding
    setFill(doc, BRAND_LIGHT);
    doc.roundedRect(14, y, W - 28, bannerH, 2, 2, "F");
    setTextColor(doc, BRAND);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(output.headline, W / 2, y + 7, { align: "center" });
    setTextColor(doc, GREY_DARK);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(sumLines, W / 2, y + 13, { align: "center" });
    y += bannerH + 6;

    // Sections in 2-col grid
    const colW = (W - 28 - 4) / 2;
    let col = 0;
    let colY = [y, y];

    output.sections.forEach((sec) => {
      const x = 14 + col * (colW + 4);
      let sy = colY[col];

      // Section card background
      setFill(doc, "#f9f9f9");
      doc.roundedRect(x, sy, colW, 2, 1, 1, "F"); // placeholder height, will adjust

      setTextColor(doc, BRAND);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text(sec.title.toUpperCase(), x + 3, sy + 5);
      sy += 9;

      setTextColor(doc, GREY_MID);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const bodyLines = doc.splitTextToSize(sec.body, colW - 6);
      doc.text(bodyLines, x + 3, sy);
      sy += bodyLines.length * 4 + 2;

      if (sec.bullets?.length) {
        sec.bullets.forEach((b) => {
          const bLines = doc.splitTextToSize(`- ${sanitize(b)}`, colW - 9);
          // page overflow check
          if (sy + bLines.length * 4 > pageH(doc) - 20) {
            page++;
            doc.addPage();
            addHeader(doc, opts.productName || "Orchestration Report", TAB_LABELS[type] || type);
            addFooter(doc, page);
            sy = 30;
            colY = [sy, sy];
          }
          setTextColor(doc, GREY_DARK);
          doc.setFontSize(7);
          doc.text(bLines, x + 5, sy);
          sy += bLines.length * 4 + 1;
        });
      }
      sy += 4;
      colY[col] = sy;
      col = col === 0 ? 1 : 0;
    });

    page++;
  };

  // Page 1: Cover / Brief
  addHeader(doc, opts.productName || "Orchestration Report", "Audience Intelligence Report");
  addFooter(doc, page);
  let y = 30;

  // Brief card
  setFill(doc, BRAND_LIGHT);
  doc.roundedRect(14, y, W - 28, 40, 3, 3, "F");
  setTextColor(doc, BRAND);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PRODUCT BRIEF", 20, y + 7);
  setTextColor(doc, GREY_DARK);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(opts.productName || "(Untitled)", 20, y + 14);
  setTextColor(doc, GREY_MID);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  if (opts.productCategory) doc.text(`Category: ${opts.productCategory}`, 20, y + 20);
  if (opts.businessObjective) {
    const objLines = doc.splitTextToSize(`Objective: ${opts.businessObjective}`, W - 48);
    doc.text(objLines, 20, y + 26);
  }
  // Audience badge
  setFill(doc, BRAND);
  doc.roundedRect(W - 80, y + 6, 66, 12, 2, 2, "F");
  setTextColor(doc, WHITE);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(sanitize(opts.audienceLabel), W - 47, y + 11, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`n = ${opts.audienceCount.toLocaleString()}`, W - 47, y + 15.5, { align: "center" });
  y += 48;

  // Description
  if (opts.productDescription) {
    y = sectionTitle(doc, "Description", y);
    setTextColor(doc, GREY_DARK);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(opts.productDescription, W - 28);
    doc.text(descLines, 14, y);
    y += descLines.length * 5 + 8;
  }

  // Summary of what was generated
  const generatedTabs = Object.keys(opts.outputs).filter((k) => opts.outputs[k]);
  if (generatedTabs.length || opts.mediaPlan) {
    y = sectionTitle(doc, "Generated Outputs", y);
    const tabNames = [
      ...generatedTabs.map((t) => TAB_LABELS[t] || t),
      ...(opts.mediaPlan ? ["Media Plan"] : []),
    ];
    tabNames.forEach((name) => {
      setFill(doc, BRAND);
      doc.roundedRect(14, y, W - 28, 6, 1, 1, "F");
      setTextColor(doc, WHITE);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(`+  ${sanitize(name)}`, 20, y + 4.2);
      y += 8;
    });
  }

  page++;

  // Strategy pages
  for (const [type, output] of Object.entries(opts.outputs)) {
    if (output) addStrategyOutput(type, output);
  }

  // Media Plan page
  if (opts.mediaPlan) {
    doc.addPage();
    addHeader(doc, opts.productName || "Orchestration Report", "Media Plan");
    addFooter(doc, page);
    let my = 30;

    // KPI row
    const kpis = [
      { label: "Total Budget", value: fmt$(opts.mediaPlan.totalBudget) },
      { label: "Impressions", value: fmtN(opts.mediaPlan.totalImpressions) },
      { label: "Reach", value: fmtN(opts.mediaPlan.addressableReach) },
      { label: "Avg Frequency", value: opts.mediaPlan.avgFrequency.toFixed(1) + "×" },
      { label: "Blended CPM", value: fmt$(opts.mediaPlan.blendedCpm) },
    ];
    const kpiW = (W - 28) / kpis.length;
    kpis.forEach((k, i) => {
      const kx = 14 + i * kpiW;
      setFill(doc, BRAND_LIGHT);
      doc.roundedRect(kx, my, kpiW - 2, 14, 2, 2, "F");
      setTextColor(doc, BRAND);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(k.value, kx + kpiW / 2 - 1, my + 7, { align: "center" });
      setTextColor(doc, GREY_MID);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(k.label.toUpperCase(), kx + kpiW / 2 - 1, my + 12, { align: "center" });
    });
    my += 22;

    // Platform allocation table
    my = sectionTitle(doc, "Platform Allocation", my);
    autoTable(doc, {
      startY: my,
      head: [["Platform", "Alloc %", "Budget", "Impressions", "Reach", "Freq", "CPM", "Clicks", "CPC"]],
      body: opts.mediaPlan.platforms.map((p) => [
        p.platform,
        p.allocationPct.toFixed(1) + "%",
        fmt$(p.spend),
        fmtN(p.impressions),
        fmtN(p.reach),
        p.frequency.toFixed(1) + "×",
        fmt$(p.cpm),
        fmtN(p.clicks),
        fmt$(p.cpc),
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: hexToRgb(BRAND), textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 14, right: 14 },
    });

    // Rationale
    if (opts.rationale) {
      const tbl = (doc as any).lastAutoTable;
      let ry = (tbl?.finalY ?? my + 40) + 8;
      ry = sectionTitle(doc, "Strategic Rationale", ry);
      setTextColor(doc, GREY_DARK);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const rLines = doc.splitTextToSize(opts.rationale, W - 28);
      doc.text(rLines, 14, ry);
    }

    page++;
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const slug = (opts.productName || "orchestration").replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`Orchestration_${slug}_${dateTag}.pdf`);
}

// ─── Focus Group PDF ───────────────────────────────────────────────

const DTYPE_LABELS: Record<string, string> = {
  "concept-reaction": "Concept Reaction",
  "message-testing": "Message Testing",
  "category-exploration": "Category Exploration",
  "brand-perception": "Brand Perception",
};

export interface FocusGroupExportOpts {
  discussionType: DiscussionType;
  topic: string;
  audienceLabel: string;
  audienceCount: number;
  participants: Participant[];
  messages: Message[];
  summary?: SessionSummary;
}

export function downloadFocusGroupPdf(opts: FocusGroupExportOpts) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = pageW(doc);
  let page = 1;

  const typeLabel = DTYPE_LABELS[opts.discussionType] || opts.discussionType;

  // Page 1: Cover
  addHeader(doc, "Focus Group Report", typeLabel);
  addFooter(doc, page);
  let y = 30;

  // Topic banner
  setFill(doc, BRAND_LIGHT);
  doc.roundedRect(14, y, W - 28, 20, 2, 2, "F");
  setTextColor(doc, BRAND);
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("DISCUSSION TOPIC", 20, y + 6);
  setTextColor(doc, GREY_DARK);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  const topicLines = doc.splitTextToSize(opts.topic, W - 48);
  doc.text(topicLines, 20, y + 12);
  // Audience badge
  setFill(doc, BRAND);
  doc.roundedRect(W - 76, y + 4, 62, 12, 2, 2, "F");
  setTextColor(doc, WHITE);
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text(sanitize(opts.audienceLabel), W - 45, y + 9, { align: "center" });
  doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
  doc.text(`n = ${opts.audienceCount.toLocaleString()}`, W - 45, y + 13.5, { align: "center" });
  y += 28;

  // Participants table
  y = sectionTitle(doc, "Participants", y);
  autoTable(doc, {
    startY: y,
    head: [["Name", "Gender", "Age Group", "Profile Summary"]],
    body: opts.participants.map((p) => [
      p.name, p.gender, p.age_group,
      p.profile.split("\n").slice(2, 4).join(" · ").substring(0, 80),
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: hexToRgb(BRAND), textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;

  // Summary (if exists)
  if (opts.summary) {
    if (y > pageH(doc) - 60) { page++; doc.addPage(); addHeader(doc, "Focus Group Report", typeLabel); addFooter(doc, page); y = 30; }
    y = sectionTitle(doc, "Overall Sentiment", y);
    setTextColor(doc, GREY_DARK);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    const sentLines = doc.splitTextToSize(opts.summary.overallSentiment, W - 28);
    doc.text(sentLines, 14, y);
    y += sentLines.length * 5 + 8;

    // Key themes
    y = sectionTitle(doc, "Key Themes", y);
    opts.summary.keyThemes.forEach((theme, i) => {
      if (y > pageH(doc) - 20) { page++; doc.addPage(); addHeader(doc, "Focus Group Report", typeLabel); addFooter(doc, page); y = 30; }
      setFill(doc, BRAND_LIGHT);
      doc.roundedRect(14, y, W - 28, 7, 1, 1, "F");
      setTextColor(doc, BRAND);
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}`, 19, y + 4.8);
      setTextColor(doc, GREY_DARK);
      doc.setFont("helvetica", "normal");
      doc.text(theme, 25, y + 4.8);
      y += 9;
    });
    y += 4;

    // Key quotes
    if (opts.summary.keyQuotes?.length) {
      if (y > pageH(doc) - 40) { page++; doc.addPage(); addHeader(doc, "Focus Group Report", typeLabel); addFooter(doc, page); y = 30; }
      y = sectionTitle(doc, "Key Quotes", y);
      opts.summary.keyQuotes.forEach((q) => {
        if (y > pageH(doc) - 25) { page++; doc.addPage(); addHeader(doc, "Focus Group Report", typeLabel); addFooter(doc, page); y = 30; }
        const qLines = doc.splitTextToSize(`"${q.quote}"`, W - 36);
        setFill(doc, "#f9f9f9");
        doc.roundedRect(14, y, W - 28, qLines.length * 4.5 + 8, 1, 1, "F");
        setTextColor(doc, GREY_MID);
        doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
        doc.text(qLines, 20, y + 4.5);
        setTextColor(doc, BRAND);
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text(`— ${q.participant}`, W - 16, y + qLines.length * 4.5 + 2, { align: "right" });
        y += qLines.length * 4.5 + 11;
      });
    }

    // Recommendations
    if (opts.summary.recommendations?.length) {
      if (y > pageH(doc) - 40) { page++; doc.addPage(); addHeader(doc, "Focus Group Report", typeLabel); addFooter(doc, page); y = 30; }
      y = sectionTitle(doc, "Recommendations", y);
      opts.summary.recommendations.forEach((r) => {
        if (y > pageH(doc) - 15) { page++; doc.addPage(); addHeader(doc, "Focus Group Report", typeLabel); addFooter(doc, page); y = 30; }
        const rLines = doc.splitTextToSize(`-  ${sanitize(r)}`, W - 28);
        setTextColor(doc, GREY_DARK);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
        doc.text(rLines, 14, y);
        y += rLines.length * 5 + 3;
      });
    }
  }

  // Transcript page(s)
  const transcript = opts.messages.filter((m) => m.role !== "system");
  if (transcript.length) {
    page++; doc.addPage();
    addHeader(doc, "Focus Group Report", "Full Transcript");
    addFooter(doc, page);
    y = 30;
    transcript.forEach((msg) => {
      const speaker = msg.role === "moderator" ? "MODERATOR" : msg.participantName ?? "Participant";
      const text = `${speaker}: ${msg.content}`;
      const lines = doc.splitTextToSize(text, W - 28);
      if (y + lines.length * 4.5 > pageH(doc) - 18) {
        page++; doc.addPage();
        addHeader(doc, "Focus Group Report", "Full Transcript");
        addFooter(doc, page);
        y = 30;
      }
      setTextColor(doc, msg.role === "moderator" ? BRAND : GREY_DARK);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", msg.role === "moderator" ? "bold" : "normal");
      doc.text(lines, 14, y);
      y += lines.length * 4.5 + 3;
    });
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const slug = (opts.topic || "focus_group").replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 30);
  doc.save(`FocusGroup_${slug}_${dateTag}.pdf`);
}

// ─── Monitor PDF ──────────────────────────────────────────────────

export interface MonitorExportOpts {
  brand: string;
  competitors: string;
  topics: string;
  sources: MonitorSource[];
  audienceLabel: string;
  audienceCount: number;
  result: MonitorResult;
}

export function downloadMonitorPdf(opts: MonitorExportOpts) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = pageW(doc);
  let page = 1;

  addHeader(doc, `Brand Monitor — ${opts.brand}`, "All Respondents");
  addFooter(doc, page);
  let y = 30;

  // Run info
  setFill(doc, BRAND_LIGHT);
  doc.roundedRect(14, y, W - 28, 16, 2, 2, "F");
  setTextColor(doc, BRAND);
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(opts.brand, 20, y + 6);
  setTextColor(doc, GREY_MID);
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  if (opts.competitors) doc.text(`vs ${opts.competitors}`, 20, y + 11);
  doc.text(`Sources: ${opts.sources.join(", ")}`, W - 16, y + 6, { align: "right" });
  doc.text(new Date().toLocaleDateString("en-US", { dateStyle: "long" }), W - 16, y + 11, { align: "right" });
  y += 22;

  // Scorecard
  y = sectionTitle(doc, "Scorecard", y);
  const kpis = [
    { label: "Awareness", value: opts.result.scorecard.awareness },
    { label: "Sentiment", value: opts.result.scorecard.sentiment },
    { label: "Reputation", value: opts.result.scorecard.reputation },
    { label: "Share of Voice", value: opts.result.scorecard.shareOfVoice, suffix: "%" },
  ];
  const kpiW = (W - 28) / kpis.length;
  kpis.forEach((k, i) => {
    const kx = 14 + i * kpiW;
    setFill(doc, BRAND_LIGHT);
    doc.roundedRect(kx, y, kpiW - 2, 14, 2, 2, "F");
    setTextColor(doc, BRAND);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(`${k.value}${k.suffix || ""}`, kx + kpiW / 2 - 1, y + 7, { align: "center" });
    setTextColor(doc, GREY_MID);
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
    doc.text(k.label.toUpperCase(), kx + kpiW / 2 - 1, y + 12, { align: "center" });
  });
  y += 22;

  // Sentiment summary
  y = sectionTitle(doc, `Brand Sentiment — ${opts.result.sentimentLabel.toUpperCase()}`, y);
  setTextColor(doc, GREY_DARK);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  const sentLines = doc.splitTextToSize(opts.result.sentimentSummary, W - 28);
  doc.text(sentLines, 14, y);
  y += sentLines.length * 5 + 8;

  // Key themes
  y = sectionTitle(doc, "Key Themes", y);
  opts.result.keyThemes.forEach((t, i) => {
    if (y > pageH(doc) - 20) { page++; doc.addPage(); addHeader(doc, `Brand Monitor — ${opts.brand}`, "All Respondents"); addFooter(doc, page); y = 30; }
    const tLines = doc.splitTextToSize(`${i + 1}.  ${t}`, W - 28);
    setTextColor(doc, GREY_DARK);
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.text(tLines, 14, y);
    y += tLines.length * 4.5 + 2;
  });
  y += 4;

  // Competitive positioning
  if (y > pageH(doc) - 50) { page++; doc.addPage(); addHeader(doc, `Brand Monitor — ${opts.brand}`, "All Respondents"); addFooter(doc, page); y = 30; }
  y = sectionTitle(doc, "Competitive Positioning", y);
  setTextColor(doc, GREY_DARK);
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  const compLines = doc.splitTextToSize(opts.result.competitivePositioning, W - 28);
  doc.text(compLines, 14, y);
  y += compLines.length * 5 + 8;

  // Verbatims
  if (opts.result.verbatims?.length) {
    if (y > pageH(doc) - 40) { page++; doc.addPage(); addHeader(doc, `Brand Monitor — ${opts.brand}`, "All Respondents"); addFooter(doc, page); y = 30; }
    y = sectionTitle(doc, "Consumer Verbatims", y);
    autoTable(doc, {
      startY: y,
      head: [["Sentiment", "Source", "Quote"]],
      body: opts.result.verbatims.map((v) => [
        v.sentiment.toUpperCase(), v.source, `"${sanitize(v.quote)}"`,
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: hexToRgb(BRAND), textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 22 } },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;
  }

  // Watch items
  if (opts.result.watchItems?.length) {
    if (y > pageH(doc) - 30) { page++; doc.addPage(); addHeader(doc, `Brand Monitor — ${opts.brand}`, "All Respondents"); addFooter(doc, page); y = 30; }
    y = sectionTitle(doc, "Watch Items", y);
    opts.result.watchItems.forEach((w) => {
      if (y > pageH(doc) - 20) { page++; doc.addPage(); addHeader(doc, `Brand Monitor — ${opts.brand}`, "All Respondents"); addFooter(doc, page); y = 30; }
      setFill(doc, "#fff5f5");
      const wLines = doc.splitTextToSize(w.description, W - 50);
      doc.roundedRect(14, y, W - 28, 7 + wLines.length * 4.5, 1, 1, "F");
      setTextColor(doc, "#e53e3e");
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text(`[${w.severity.toUpperCase()}]  ${w.title}`, 18, y + 4.5);
      setTextColor(doc, GREY_MID);
      doc.setFont("helvetica", "normal");
      doc.text(wLines, 18, y + 9);
      y += 7 + wLines.length * 4.5 + 4;
    });
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const slug = (opts.brand || "monitor").replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`Monitor_${slug}_${dateTag}.pdf`);
}

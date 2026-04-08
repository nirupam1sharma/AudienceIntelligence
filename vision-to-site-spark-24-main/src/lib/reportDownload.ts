import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AudienceRecord } from "./audienceData";
import type { Segment } from "./segmentData";

// Brand colour
const BRAND = "#004638";
const BRAND_LIGHT = "#e6f0ec";
const GREY_DARK = "#1a1a1a";
const GREY_MID = "#555555";
const GREY_LIGHT = "#dddddd";
const WHITE = "#ffffff";

// ─── Helpers ───────────────────────────────────────────────────────

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
  doc.text(title, titleX, 9, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, titleX, 15, { align: "center" });
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
  const { data, allData, audienceLabel, appliedQuery, crosstab } = opts;
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

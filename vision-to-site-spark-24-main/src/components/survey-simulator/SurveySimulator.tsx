import { useState, useCallback } from "react";
import {
  ClipboardList, Plus, Trash2, ChevronDown, Loader2, Key,
  AlertTriangle, Download, Save, RotateCcw, BookMarked,
  Clock, CheckCircle2, BarChart2, ThumbsUp, AlignLeft,
  Hash, ToggleLeft, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { loadAudienceData, type AudienceRecord } from "@/lib/audienceData";
import { getAnthropicKey, setAnthropicKey } from "@/lib/anthropicNlp";
import type {
  QuestionType, SurveyQuestion, RespondentAnswer,
  QuestionResult, SurveyResults,
} from "@/lib/surveySimulatorTypes";
import {
  loadSavedSurveys, saveSurvey, deleteSavedSurvey,
  type SavedSurvey,
} from "@/lib/surveySimulatorStorage";

// ─── Constants ────────────────────────────────────────────────────

const SAMPLE_SIZES = [50, 100, 200, 500];

const QUESTION_TYPES: { id: QuestionType; label: string; icon: typeof List; desc: string }[] = [
  { id: "multiple_choice", label: "Multiple Choice", icon: List,       desc: "2–7 options" },
  { id: "rating",          label: "Rating Scale",    icon: Hash,       desc: "1–5 scale" },
  { id: "yes_no",          label: "Yes / No",        icon: ToggleLeft, desc: "Binary" },
  { id: "open_ended",      label: "Open Ended",      icon: AlignLeft,  desc: "Free text" },
];

const LOADING_STEPS = [
  "Sampling audience respondents…",
  "Building psychographic profiles…",
  "Fielding survey in batches…",
  "Aggregating responses…",
  "Computing results…",
];

const BRAND = "#004638";
const BRAND_10 = "#004638/10";

// ─── Audience profile helper ──────────────────────────────────────

const INTEREST_KEYS: (keyof AudienceRecord)[] = [
  "interest_sports", "interest_health_wellness", "interest_music", "interest_travel",
  "interest_movies", "interest_nature", "interest_reading", "interest_cooking",
  "interest_shopping", "interest_fitness", "interest_technology", "interest_finance",
  "interest_games", "interest_art", "interest_fashion",
];

const VALUE_KEYS: (keyof AudienceRecord)[] = [
  "value_family", "value_working_hard", "value_financial_responsibility",
  "value_enjoying_life", "value_healthy_lifestyle", "value_self_improvement",
  "value_honesty", "value_environment", "value_looking_good", "value_wealth",
];

const SOCIAL_KEYS: (keyof AudienceRecord)[] = [
  "facebook_usage", "youtube_usage", "instagram_usage", "twitter_usage",
  "linkedin_usage", "snapchat_usage", "reddit_usage", "tiktok_usage",
];

function labelKey(key: string): string {
  return key
    .replace(/interest_|value_|_usage/g, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildRespondentProfile(r: AudienceRecord, idx: number): string {
  const interests = INTEREST_KEYS
    .filter((k) => r[k] === true)
    .slice(0, 4)
    .map((k) => labelKey(String(k)))
    .join(", ") || "General";

  const topValues = VALUE_KEYS
    .map((k) => ({ label: labelKey(String(k)), score: Number(r[k]) || 0 }))
    .filter((v) => v.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((v) => v.label)
    .join(", ") || "N/A";

  const socials = SOCIAL_KEYS
    .filter((k) => r[k] === true)
    .slice(0, 3)
    .map((k) => labelKey(String(k)))
    .join(", ") || "None";

  return `R${idx + 1}: ${r.age_group}, ${r.gender}, ${r.household_income_bracket} income. Interests: ${interests}. Values: ${topValues}. Social: ${socials}.`;
}

// ─── Unique ID helper ─────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Build API prompt ─────────────────────────────────────────────

function buildBatchPrompt(
  respondents: { record: AudienceRecord; idx: number }[],
  questions: SurveyQuestion[],
  context: string
): string {
  const profileBlock = respondents
    .map(({ record, idx }) => buildRespondentProfile(record, idx))
    .join("\n");

  const questionBlock = questions
    .map((q, i) => {
      const typeNote =
        q.type === "multiple_choice"
          ? `[Multiple Choice — respond with EXACTLY one of: ${q.options?.map((o) => `"${o}"`).join(", ")}]`
          : q.type === "rating"
          ? `[Rating — respond with a single integer 1–5]`
          : q.type === "yes_no"
          ? `[Yes/No — respond with exactly "Yes" or "No"]`
          : `[Open Ended — 1–2 natural, conversational sentences]`;
      return `Q${i + 1} ${typeNote}: ${q.text}`;
    })
    .join("\n");

  const ids = respondents.map(({ idx }) => `"R${idx + 1}"`).join(", ");
  const qKeys = questions.map((_, i) => `"q${i + 1}"`).join(", ");

  return `Respondent profiles:
${profileBlock}

${context ? `Survey context: ${context}\n\n` : ""}Questions:
${questionBlock}

Return a JSON array — one object per respondent. Each object must have keys: "respondent_id" (${ids}) and ${qKeys}.
For multiple choice answers use exact option text. For rating use an integer. For yes/no use "Yes" or "No". For open ended write naturally.
Return ONLY the JSON array, no markdown fences.`;
}

// ─── Results aggregator ───────────────────────────────────────────

function aggregateResults(
  responses: RespondentAnswer[],
  questions: SurveyQuestion[]
): QuestionResult[] {
  return questions.map((q, i) => {
    const key = `q${i + 1}`;
    const answers = responses.map((r) => r[key]);

    if (q.type === "multiple_choice") {
      const counts: Record<string, number> = {};
      (q.options ?? []).forEach((o) => (counts[o] = 0));
      answers.forEach((a) => {
        const s = String(a).trim();
        if (s in counts) counts[s]++;
        else {
          // fuzzy match
          const match = Object.keys(counts).find(
            (k) => k.toLowerCase() === s.toLowerCase()
          );
          if (match) counts[match]++;
          else counts[s] = (counts[s] || 0) + 1;
        }
      });
      const total = answers.length;
      const distribution = Object.entries(counts).map(([option, count]) => ({
        option,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
      return { questionId: q.id, questionText: q.text, type: q.type, distribution };
    }

    if (q.type === "rating") {
      const nums = answers.map((a) => Math.min(5, Math.max(1, Number(a) || 3)));
      const average = nums.length > 0
        ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10
        : 0;
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      nums.forEach((n) => { dist[n] = (dist[n] || 0) + 1; });
      const ratingDistribution = [1, 2, 3, 4, 5].map((v) => ({ value: v, count: dist[v] }));
      return { questionId: q.id, questionText: q.text, type: q.type, average, ratingDistribution };
    }

    if (q.type === "yes_no") {
      const yesCount = answers.filter((a) => String(a).trim().toLowerCase() === "yes").length;
      const noCount = answers.length - yesCount;
      const total = answers.length;
      const yesPct = total > 0 ? Math.round((yesCount / total) * 100) : 0;
      return {
        questionId: q.id, questionText: q.text, type: q.type,
        yesPct, noPct: 100 - yesPct, yesCount, noCount,
      };
    }

    // open_ended
    const verbatims = answers
      .map((a) => String(a).trim())
      .filter((a) => a.length > 5)
      .slice(0, 8);
    return { questionId: q.id, questionText: q.text, type: q.type, verbatims };
  });
}

// ─── Sub-component: QuestionCard ──────────────────────────────────

interface QuestionCardProps {
  q: SurveyQuestion;
  idx: number;
  onUpdate: (updated: SurveyQuestion) => void;
  onRemove: () => void;
}

function QuestionCard({ q, idx, onUpdate, onRemove }: QuestionCardProps) {
  const [typeOpen, setTypeOpen] = useState(false);
  const typeInfo = QUESTION_TYPES.find((t) => t.id === q.type)!;

  const addOption = () => {
    if ((q.options?.length ?? 0) < 7) {
      onUpdate({ ...q, options: [...(q.options ?? []), ""] });
    }
  };

  const removeOption = (i: number) => {
    onUpdate({ ...q, options: q.options?.filter((_, oi) => oi !== i) });
  };

  const updateOption = (i: number, val: string) => {
    const opts = [...(q.options ?? [])];
    opts[i] = val;
    onUpdate({ ...q, options: opts });
  };

  const changeType = (newType: QuestionType) => {
    const updated: SurveyQuestion = { ...q, type: newType };
    if (newType === "multiple_choice" && !q.options?.length) {
      updated.options = ["", ""];
    }
    onUpdate(updated);
    setTypeOpen(false);
  };

  return (
    <div className="border border-surface-card-border rounded-xl bg-surface-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#004638]/10 flex items-center justify-center text-xs font-bold text-[#004638] mt-0.5">
          {idx + 1}
        </span>

        <Input
          value={q.text}
          onChange={(e) => onUpdate({ ...q, text: e.target.value })}
          placeholder="Enter your question…"
          className="flex-1 bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted"
        />

        {/* Type picker */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setTypeOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-surface-card-border bg-surface-dark text-xs font-semibold text-hero-foreground hover:bg-surface-dark/80 transition-colors"
          >
            <typeInfo.icon className="h-3.5 w-3.5 text-[#004638]" />
            {typeInfo.label}
            <ChevronDown className="h-3 w-3 text-hero-muted" />
          </button>

          {typeOpen && (
            <div className="absolute right-0 top-10 z-50 w-52 bg-surface-card border border-surface-card-border rounded-xl shadow-xl overflow-hidden">
              {QUESTION_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => changeType(t.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                    q.type === t.id
                      ? "bg-[#004638]/10 text-[#004638] font-semibold"
                      : "text-hero-foreground hover:bg-surface-dark/60"
                  )}
                >
                  <t.icon className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-hero-muted">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onRemove}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-hero-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Options (multiple choice) */}
      {q.type === "multiple_choice" && (
        <div className="pl-10 space-y-2">
          {(q.options ?? []).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded border border-surface-card-border bg-surface-dark flex items-center justify-center text-xs text-hero-muted font-mono">
                {String.fromCharCode(65 + oi)}
              </span>
              <Input
                value={opt}
                onChange={(e) => updateOption(oi, e.target.value)}
                placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                className="flex-1 h-8 text-sm bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted"
              />
              {(q.options?.length ?? 0) > 2 && (
                <button
                  onClick={() => removeOption(oi)}
                  className="flex-shrink-0 text-hero-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {(q.options?.length ?? 0) < 7 && (
            <button
              onClick={addOption}
              className="flex items-center gap-1.5 text-xs text-[#004638] hover:underline mt-1"
            >
              <Plus className="h-3 w-3" /> Add option
            </button>
          )}
        </div>
      )}

      {/* Rating hint */}
      {q.type === "rating" && (
        <div className="pl-10 flex items-center gap-2 text-xs text-hero-muted">
          <span className="px-2 py-0.5 rounded bg-surface-dark border border-surface-card-border">1 = Strongly Disagree</span>
          <span className="text-hero-muted/40">···</span>
          <span className="px-2 py-0.5 rounded bg-surface-dark border border-surface-card-border">5 = Strongly Agree</span>
        </div>
      )}

      {/* Yes/No hint */}
      {q.type === "yes_no" && (
        <div className="pl-10 flex items-center gap-2 text-xs text-hero-muted">
          <span className="px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-600">Yes</span>
          <span className="text-hero-muted/40">/</span>
          <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500">No</span>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Result card ───────────────────────────────────

function ResultCard({ result, n }: { result: QuestionResult; n: number }) {
  const typeInfo = QUESTION_TYPES.find((t) => t.id === result.type)!;

  return (
    <div className="border border-surface-card-border rounded-xl bg-surface-card p-5 space-y-4">
      {/* Question header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#004638]/10 flex items-center justify-center">
          <typeInfo.icon className="h-4 w-4 text-[#004638]" />
        </div>
        <div>
          <p className="font-semibold text-hero-foreground leading-snug">{result.questionText}</p>
          <span className="text-xs text-hero-muted">{typeInfo.label}</span>
        </div>
      </div>

      {/* Multiple choice */}
      {result.type === "multiple_choice" && result.distribution && (
        <div className="space-y-2">
          {result.distribution
            .sort((a, b) => b.count - a.count)
            .map((opt, i) => {
              const isTop = i === 0;
              return (
                <div key={opt.option} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn("font-medium", isTop ? "text-[#004638]" : "text-hero-foreground")}>
                      {opt.option}
                    </span>
                    <span className={cn("font-semibold text-xs", isTop ? "text-amber-500" : "text-hero-muted")}>
                      {opt.pct}% ({opt.count})
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-dark overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", isTop ? "bg-amber-400" : "bg-[#004638]/40")}
                      style={{ width: `${opt.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Rating */}
      {result.type === "rating" && result.ratingDistribution && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-4xl font-black",
                (result.average ?? 0) >= 4 ? "text-green-500" :
                (result.average ?? 0) >= 3 ? "text-amber-500" : "text-red-500"
              )}
            >
              {result.average?.toFixed(1)}
            </span>
            <div className="text-xs text-hero-muted">
              <div>avg score</div>
              <div>out of 5.0</div>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {result.ratingDistribution.map(({ value, count }) => {
              const maxCount = Math.max(...result.ratingDistribution!.map((d) => d.count));
              const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              const labels = ["SD", "D", "N", "A", "SA"];
              return (
                <div key={value} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-hero-muted font-mono">{count}</span>
                  <div className="w-full flex items-end justify-center" style={{ height: 40 }}>
                    <div
                      className="w-full rounded-t-sm bg-[#004638]/70 transition-all"
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs text-hero-muted">{labels[value - 1]}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-hero-muted/60 px-1">
            <span>Strongly Disagree</span>
            <span>Strongly Agree</span>
          </div>
        </div>
      )}

      {/* Yes / No */}
      {result.type === "yes_no" && (
        <div className="space-y-3">
          <div className="flex gap-6">
            <div className="text-center">
              <div
                className={cn(
                  "text-3xl font-black",
                  (result.yesPct ?? 0) >= 60 ? "text-green-500" :
                  (result.yesPct ?? 0) >= 40 ? "text-amber-500" : "text-red-500"
                )}
              >
                {result.yesPct}%
              </div>
              <div className="text-xs text-hero-muted font-medium">Yes ({result.yesCount})</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-hero-foreground/50">{result.noPct}%</div>
              <div className="text-xs text-hero-muted font-medium">No ({result.noCount})</div>
            </div>
          </div>
          {/* Split bar */}
          <div className="h-3 rounded-full overflow-hidden flex bg-surface-dark">
            <div
              className={cn(
                "h-full transition-all",
                (result.yesPct ?? 0) >= 60 ? "bg-green-500" :
                (result.yesPct ?? 0) >= 40 ? "bg-amber-400" : "bg-red-400"
              )}
              style={{ width: `${result.yesPct}%` }}
            />
            <div className="h-full flex-1 bg-hero-muted/20" />
          </div>
        </div>
      )}

      {/* Open-ended verbatims */}
      {result.type === "open_ended" && result.verbatims && (
        <div className="space-y-2">
          {result.verbatims.map((v, i) => (
            <blockquote
              key={i}
              className="border-l-2 border-[#004638]/30 pl-3 text-sm text-hero-foreground/80 italic leading-relaxed"
            >
              "{v}"
            </blockquote>
          ))}
          {n > result.verbatims.length && (
            <p className="text-xs text-hero-muted pl-3">
              +{n - result.verbatims.length} more responses
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

type ViewMode = "setup" | "fielding" | "results" | "saved";

const SurveySimulator = () => {
  // Config state
  const [context, setContext] = useState("");
  const [sampleSize, setSampleSize] = useState(100);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    { id: uid(), type: "multiple_choice", text: "", options: ["", ""] },
  ]);

  // UI state
  const [view, setView] = useState<ViewMode>("setup");
  const [progress, setProgress] = useState<{ step: number; total: number; label: string }>({
    step: 0, total: 0, label: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Results
  const [results, setResults] = useState<SurveyResults | null>(null);

  // Saved
  const [savedSurveys, setSavedSurveys] = useState<SavedSurvey[]>(() => loadSavedSurveys());
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");

  // ─── Question management ────────────────────────────────────────

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { id: uid(), type: "multiple_choice", text: "", options: ["", ""] },
    ]);
  };

  const updateQuestion = (id: string, updated: SurveyQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  // ─── Validation ─────────────────────────────────────────────────

  const validate = (): string | null => {
    if (questions.length === 0) return "Add at least one question.";
    for (const q of questions) {
      if (!q.text.trim()) return "All questions must have text.";
      if (q.type === "multiple_choice") {
        const filled = (q.options ?? []).filter((o) => o.trim());
        if (filled.length < 2) return "Multiple choice questions need at least 2 options.";
      }
    }
    return null;
  };

  // ─── API Key save ───────────────────────────────────────────────

  const saveKey = () => {
    if (apiKeyInput.trim()) {
      setAnthropicKey(apiKeyInput.trim());
      setApiKeyInput("");
      setShowKeyInput(false);
    }
  };

  // ─── Field survey ───────────────────────────────────────────────

  const fieldSurvey = useCallback(async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const apiKey = getAnthropicKey();
    if (!apiKey) { setShowKeyInput(true); return; }

    setError(null);
    setView("fielding");

    try {
      // 1. Load audience data
      setProgress({ step: 1, total: 5, label: LOADING_STEPS[0] });
      const allData = await loadAudienceData();

      // 2. Sample respondents
      setProgress({ step: 2, total: 5, label: LOADING_STEPS[1] });
      const shuffled = [...allData].sort(() => Math.random() - 0.5);
      const sample = shuffled.slice(0, sampleSize);

      // 3. Field in batches of 10
      const BATCH = 10;
      const totalBatches = Math.ceil(sample.length / BATCH);
      const allResponses: RespondentAnswer[] = [];

      for (let b = 0; b < totalBatches; b++) {
        setProgress({
          step: 3,
          total: 5,
          label: `Fielding batch ${b + 1} of ${totalBatches}…`,
        });

        const batchRecords = sample.slice(b * BATCH, (b + 1) * BATCH);
        const batchWithIdx = batchRecords.map((record, localIdx) => ({
          record,
          idx: b * BATCH + localIdx,
        }));

        const prompt = buildBatchPrompt(batchWithIdx, questions, context);

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            system:
              "You are simulating realistic survey responses from real people. Use the full psychographic profile provided — values, interests, media habits — not just demographics. Vary responses naturally. Open-ended answers should sound conversational, not generic. Return ONLY a valid JSON array, no markdown.",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!res.ok) {
          if (res.status === 401) throw new Error("Invalid API key. Please check your Anthropic API key.");
          throw new Error(`API error ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();
        const raw: string = json.content?.[0]?.text ?? "[]";

        // Parse — handle potential markdown code fences
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        let parsed: RespondentAnswer[];
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = [];
        }
        allResponses.push(...parsed);
      }

      // 4. Aggregate
      setProgress({ step: 4, total: 5, label: LOADING_STEPS[3] });
      const questionResults = aggregateResults(allResponses, questions);

      // 5. Finalise
      setProgress({ step: 5, total: 5, label: LOADING_STEPS[4] });
      const finalResults: SurveyResults = {
        n: allResponses.length,
        questions: [...questions],
        questionResults,
        fieldedAt: new Date().toISOString(),
        context,
        rawResponses: allResponses,
      };

      setResults(finalResults);
      setView("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
      setView("setup");
    }
  }, [questions, context, sampleSize]);

  // ─── Save survey ─────────────────────────────────────────────────

  const handleSave = () => {
    if (!results) return;
    const saved = saveSurvey(context, sampleSize, questions, results);
    setSavedSurveys((prev) => [saved, ...prev]);
  };

  // ─── Delete saved ─────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    deleteSavedSurvey(id);
    setSavedSurveys(loadSavedSurveys());
  };

  // ─── Export CSV ──────────────────────────────────────────────────

  const exportCSV = () => {
    if (!results) return;
    const headers = [
      "respondent_id",
      ...results.questions.map((q, i) => `q${i + 1}_${q.text.replace(/,/g, ";").replace(/"/g, "'").slice(0, 50)}`),
    ];
    const rows = results.rawResponses.map((r) => [
      r.respondent_id,
      ...results.questions.map((_, i) => {
        const val = String(r[`q${i + 1}`] ?? "").replace(/"/g, '""');
        return val.includes(",") ? `"${val}"` : val;
      }),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey_results_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Load saved survey ────────────────────────────────────────────

  const loadSaved = (survey: SavedSurvey) => {
    setContext(survey.context);
    setSampleSize(survey.sampleSize);
    setQuestions(survey.questions);
    setResults(survey.results);
    setView("results");
    setActiveTab("current");
  };

  // ─── Render ───────────────────────────────────────────────────────

  const apiKey = getAnthropicKey();

  // ── Fielding view ──
  if (view === "fielding") {
    const pct = progress.total > 0 ? Math.round((progress.step / progress.total) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-[#004638]/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-[#004638] animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-hero-foreground font-semibold">{progress.label}</p>
          <p className="text-hero-muted text-sm">n = {sampleSize} respondents · {questions.length} questions</p>
        </div>
        <div className="w-72 space-y-1.5">
          <div className="h-2 rounded-full bg-surface-dark overflow-hidden">
            <div
              className="h-full bg-[#004638] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-hero-muted text-right">{pct}%</p>
        </div>
      </div>
    );
  }

  // ── Results view ──
  if (view === "results" && results) {
    const fieldedDate = new Date(results.fieldedAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    return (
      <div className="space-y-6">
        {/* Results header */}
        <div className="rounded-2xl border border-surface-card-border bg-surface-card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#004638]/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-[#004638]" />
              </div>
              <div>
                <h3 className="font-bold text-hero-foreground text-lg">Survey Complete</h3>
                <p className="text-hero-muted text-sm">
                  {results.n} respondents · {results.questions.length} questions · {fieldedDate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={exportCSV}
                className="border-surface-card-border text-hero-foreground hover:bg-surface-dark gap-1.5"
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                className="border-surface-card-border text-hero-foreground hover:bg-surface-dark gap-1.5"
              >
                <Save className="h-4 w-4" /> Save
              </Button>
              <Button
                size="sm"
                onClick={() => { setResults(null); setView("setup"); }}
                className="bg-[#004638] hover:bg-[#004638]/90 text-white gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> New Survey
              </Button>
            </div>
          </div>

          {results.context && (
            <div className="mt-3 pt-3 border-t border-surface-card-border">
              <p className="text-xs text-hero-muted uppercase tracking-wider mb-1">Context</p>
              <p className="text-sm text-hero-foreground">{results.context}</p>
            </div>
          )}
        </div>

        {/* Question results */}
        <div className="space-y-4">
          {results.questionResults.map((result) => (
            <ResultCard key={result.questionId} result={result} n={results.n} />
          ))}
        </div>
      </div>
    );
  }

  // ── Setup view ──
  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-surface-card-border pb-0">
        {[
          { id: "current", label: "Build Survey", icon: ClipboardList },
          { id: "history", label: `Saved (${savedSurveys.length})`, icon: BookMarked },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as "current" | "history")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-[#004638] text-[#004638]"
                : "border-transparent text-hero-muted hover:text-hero-foreground"
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* History tab */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {savedSurveys.length === 0 ? (
            <div className="text-center py-16 text-hero-muted text-sm">
              No saved surveys yet. Field a survey and click Save.
            </div>
          ) : (
            savedSurveys.map((s) => (
              <div
                key={s.id}
                className="border border-surface-card-border rounded-xl bg-surface-card p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-hero-foreground truncate">
                    {s.context || "Untitled survey"}
                  </p>
                  <p className="text-xs text-hero-muted mt-0.5">
                    n={s.results.n} · {s.questions.length} questions ·{" "}
                    {new Date(s.savedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadSaved(s)}
                    className="border-surface-card-border text-hero-foreground hover:bg-surface-dark text-xs"
                  >
                    View
                  </Button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-hero-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Build Survey tab */}
      {activeTab === "current" && (
        <>
          {/* API Key warning */}
          {(!apiKey || showKeyInput) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-hero-foreground">Anthropic API key required</p>
                  <p className="text-xs text-hero-muted mt-0.5">
                    Enter your key to field AI-simulated surveys. Stored locally in your browser.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveKey()}
                  placeholder="sk-ant-…"
                  className="flex-1 bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted font-mono text-sm"
                />
                <Button
                  size="sm"
                  onClick={saveKey}
                  disabled={!apiKeyInput.trim()}
                  className="bg-[#004638] hover:bg-[#004638]/90 text-white"
                >
                  <Key className="h-4 w-4 mr-1.5" /> Save
                </Button>
              </div>
            </div>
          )}

          {/* Survey configuration */}
          <div className="rounded-xl border border-surface-card-border bg-surface-card p-5 space-y-5">
            <h3 className="font-bold text-hero-foreground">Survey Configuration</h3>

            {/* Context */}
            <div className="space-y-1.5">
              <label className="text-xs text-hero-muted uppercase tracking-wider">
                Survey Context <span className="normal-case text-hero-muted/60">(optional)</span>
              </label>
              <Input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. Netflix subscription pricing, new product launch awareness…"
                className="bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted"
              />
            </div>

            {/* Sample size */}
            <div className="space-y-1.5">
              <label className="text-xs text-hero-muted uppercase tracking-wider">Sample Size</label>
              <div className="flex items-center gap-2">
                {SAMPLE_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSampleSize(size)}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-semibold transition-colors",
                      sampleSize === size
                        ? "bg-[#004638] border-[#004638] text-white"
                        : "border-surface-card-border bg-surface-dark text-hero-foreground hover:bg-surface-dark/80"
                    )}
                  >
                    n={size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-hero-foreground">
                Questions{" "}
                <span className="text-hero-muted font-normal text-sm">({questions.length})</span>
              </h3>
              <button
                onClick={addQuestion}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#004638] hover:underline"
              >
                <Plus className="h-4 w-4" /> Add question
              </button>
            </div>

            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                idx={i}
                onUpdate={(updated) => updateQuestion(q.id, updated)}
                onRemove={() => removeQuestion(q.id)}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Field survey button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-hero-muted">
              {sampleSize} respondents × {questions.length} question{questions.length !== 1 ? "s" : ""} ≈{" "}
              {Math.ceil(sampleSize / 10)} API calls
            </p>
            <Button
              onClick={fieldSurvey}
              className="bg-[#004638] hover:bg-[#004638]/90 text-white font-semibold px-8 h-11 gap-2"
            >
              <BarChart2 className="h-4 w-4" />
              Field Survey
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default SurveySimulator;

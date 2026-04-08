import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { AudienceRecord } from "@/lib/audienceData";

function exportCsv(data: AudienceRecord[]) {
  const headers: (keyof AudienceRecord)[] = [
    "respondent_id", "age", "age_group", "gender",
    "household_income_bracket", "race_ethnicity",
    "is_social_active_daily", "is_high_income",
  ];
  const rows = [
    headers.join(","),
    ...data.map((r) =>
      headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
    ),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audience_export_${data.length}_respondents.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 25;

const AudienceTable = ({ data }: { data: AudienceRecord[] }) => {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const pageData = useMemo(() => data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [data, page]);
  useMemo(() => setPage(0), [data.length]);

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-surface-card-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-surface-card-border bg-surface-dark/50">
              <TableHead className="text-hero-muted text-xs">ID</TableHead>
              <TableHead className="text-hero-muted text-xs">Age</TableHead>
              <TableHead className="text-hero-muted text-xs">Age Group</TableHead>
              <TableHead className="text-hero-muted text-xs">Gender</TableHead>
              <TableHead className="text-hero-muted text-xs">Income</TableHead>
              <TableHead className="text-hero-muted text-xs">Race/Ethnicity</TableHead>
              <TableHead className="text-hero-muted text-xs">Social Active</TableHead>
              <TableHead className="text-hero-muted text-xs">High Income</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map((r) => (
              <TableRow key={r.respondent_id} className="border-surface-card-border hover:bg-surface-card/50">
                <TableCell className="text-hero-foreground text-xs font-mono">{r.respondent_id}</TableCell>
                <TableCell className="text-hero-foreground text-xs">{r.age}</TableCell>
                <TableCell className="text-hero-foreground text-xs">{r.age_group}</TableCell>
                <TableCell className="text-hero-foreground text-xs">{r.gender}</TableCell>
                <TableCell className="text-hero-foreground text-xs">{r.household_income_bracket}</TableCell>
                <TableCell className="text-hero-foreground text-xs">{r.race_ethnicity}</TableCell>
                <TableCell className="text-hero-foreground text-xs">{r.is_social_active_daily ? "Yes" : "No"}</TableCell>
                <TableCell className="text-hero-foreground text-xs">{r.is_high_income ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t border-surface-card-border bg-surface-dark/30">
        <span className="text-xs text-hero-muted">
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.length)} of {data.length.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportCsv(data)}
            className="h-7 px-2 text-xs text-hero-muted hover:text-hero-foreground gap-1"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-hero-muted hover:text-hero-foreground" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-hero-muted hover:text-hero-foreground" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudienceTable;

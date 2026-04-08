import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { AudienceFilters, ToggleValue } from "@/lib/audienceData";

interface FilterPanelProps {
  filters: AudienceFilters;
  onFiltersChange: (filters: AudienceFilters) => void;
  options: {
    ageGroups: string[];
    genders: string[];
    incomeBrackets: string[];
    raceEthnicities: string[];
  };
  onReset: () => void;
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (val: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-hero-muted uppercase tracking-wider">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <Badge key={opt} variant={active ? "default" : "outline"}
              className={`cursor-pointer text-xs transition-all ${active
                ? "bg-glow-primary/20 text-glow-primary border-glow-primary/40 hover:bg-glow-primary/30"
                : "border-surface-card-border text-hero-muted hover:border-glow-primary/30 hover:text-hero-foreground"
              }`}
              onClick={() => onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])}
            >{opt}</Badge>
          );
        })}
      </div>
    </div>
  );
}

function TriToggle({ label, value, onChange }: {
  label: string; value: ToggleValue; onChange: (v: ToggleValue) => void;
}) {
  const opts: { label: string; val: ToggleValue }[] = [
    { label: "Any", val: "any" }, { label: "Yes", val: "yes" }, { label: "No", val: "no" },
  ];
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-hero-muted truncate">{label}</span>
      <div className="flex gap-1 flex-shrink-0">
        {opts.map((o) => (
          <Badge key={o.val} variant={value === o.val ? "default" : "outline"}
            className={`cursor-pointer text-[10px] px-1.5 py-0 transition-all ${value === o.val
              ? "bg-glow-accent/20 text-glow-accent border-glow-accent/40"
              : "border-surface-card-border text-hero-muted hover:border-glow-accent/30"
            }`}
            onClick={() => onChange(o.val)}
          >{o.label}</Badge>
        ))}
      </div>
    </div>
  );
}

function FilterSection({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-hero-foreground uppercase tracking-wider py-1 hover:text-glow-primary transition-colors">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="space-y-2 mt-2 pl-1">{children}</div>}
    </div>
  );
}

const AudienceFilterPanel = ({ filters, onFiltersChange, options, onReset }: FilterPanelProps) => {
  const update = (partial: Partial<AudienceFilters>) => onFiltersChange({ ...filters, ...partial });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-hero-foreground">Filters</h3>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-hero-muted hover:text-hero-foreground h-7 px-2">
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
      </div>

      <FilterSection title="Demographics" defaultOpen>
        <MultiSelect label="Age Group" options={options.ageGroups} selected={filters.ageGroups} onChange={(v) => update({ ageGroups: v })} />
        <MultiSelect label="Gender" options={options.genders} selected={filters.genders} onChange={(v) => update({ genders: v })} />
        <MultiSelect label="Income Bracket" options={options.incomeBrackets} selected={filters.incomeBrackets} onChange={(v) => update({ incomeBrackets: v })} />
        <MultiSelect label="Race / Ethnicity" options={options.raceEthnicities} selected={filters.raceEthnicities} onChange={(v) => update({ raceEthnicities: v })} />
      </FilterSection>

      <Separator className="bg-surface-card-border" />

      <FilterSection title="Social Media">
        <TriToggle label="Facebook" value={filters.facebook} onChange={(v) => update({ facebook: v })} />
        <TriToggle label="YouTube" value={filters.youtube} onChange={(v) => update({ youtube: v })} />
        <TriToggle label="Instagram" value={filters.instagram} onChange={(v) => update({ instagram: v })} />
        <TriToggle label="Twitter/X" value={filters.twitter} onChange={(v) => update({ twitter: v })} />
        <TriToggle label="LinkedIn" value={filters.linkedin} onChange={(v) => update({ linkedin: v })} />
        <TriToggle label="Snapchat" value={filters.snapchat} onChange={(v) => update({ snapchat: v })} />
        <TriToggle label="Reddit" value={filters.reddit} onChange={(v) => update({ reddit: v })} />
        <TriToggle label="TikTok" value={filters.tiktok} onChange={(v) => update({ tiktok: v })} />
      </FilterSection>

      <Separator className="bg-surface-card-border" />

      <FilterSection title="TV Genres">
        <TriToggle label="Live Sports" value={filters.tvLiveSports} onChange={(v) => update({ tvLiveSports: v })} />
        <TriToggle label="News" value={filters.tvNews} onChange={(v) => update({ tvNews: v })} />
        <TriToggle label="Crime/Detective" value={filters.tvCrime} onChange={(v) => update({ tvCrime: v })} />
        <TriToggle label="Drama" value={filters.tvDrama} onChange={(v) => update({ tvDrama: v })} />
        <TriToggle label="Documentary" value={filters.tvDocumentary} onChange={(v) => update({ tvDocumentary: v })} />
        <TriToggle label="Comedy" value={filters.tvComedy} onChange={(v) => update({ tvComedy: v })} />
        <TriToggle label="Sci-Fi" value={filters.tvSciFi} onChange={(v) => update({ tvSciFi: v })} />
        <TriToggle label="Reality" value={filters.tvReality} onChange={(v) => update({ tvReality: v })} />
        <TriToggle label="Talk Shows" value={filters.tvTalkShows} onChange={(v) => update({ tvTalkShows: v })} />
      </FilterSection>

      <Separator className="bg-surface-card-border" />

      <FilterSection title="Media Channels">
        <TriToggle label="Television" value={filters.usesTV} onChange={(v) => update({ usesTV: v })} />
        <TriToggle label="Podcasts" value={filters.usesPodcasts} onChange={(v) => update({ usesPodcasts: v })} />
        <TriToggle label="Radio" value={filters.usesRadio} onChange={(v) => update({ usesRadio: v })} />
        <TriToggle label="Magazines" value={filters.usesMagazines} onChange={(v) => update({ usesMagazines: v })} />
        <TriToggle label="Newspapers" value={filters.usesNewspapers} onChange={(v) => update({ usesNewspapers: v })} />
      </FilterSection>

      <Separator className="bg-surface-card-border" />

      <FilterSection title="Interests & Hobbies">
        <TriToggle label="Sports" value={filters.intSports} onChange={(v) => update({ intSports: v })} />
        <TriToggle label="Health/Wellness" value={filters.intHealthWellness} onChange={(v) => update({ intHealthWellness: v })} />
        <TriToggle label="Music" value={filters.intMusic} onChange={(v) => update({ intMusic: v })} />
        <TriToggle label="Travel" value={filters.intTravel} onChange={(v) => update({ intTravel: v })} />
        <TriToggle label="Movies" value={filters.intMovies} onChange={(v) => update({ intMovies: v })} />
        <TriToggle label="Nature" value={filters.intNature} onChange={(v) => update({ intNature: v })} />
        <TriToggle label="Reading" value={filters.intReading} onChange={(v) => update({ intReading: v })} />
        <TriToggle label="Cooking" value={filters.intCooking} onChange={(v) => update({ intCooking: v })} />
        <TriToggle label="Shopping" value={filters.intShopping} onChange={(v) => update({ intShopping: v })} />
        <TriToggle label="Fitness" value={filters.intFitness} onChange={(v) => update({ intFitness: v })} />
        <TriToggle label="Technology" value={filters.intTechnology} onChange={(v) => update({ intTechnology: v })} />
        <TriToggle label="Finance" value={filters.intFinance} onChange={(v) => update({ intFinance: v })} />
        <TriToggle label="Games" value={filters.intGames} onChange={(v) => update({ intGames: v })} />
        <TriToggle label="Art" value={filters.intArt} onChange={(v) => update({ intArt: v })} />
        <TriToggle label="Fashion" value={filters.intFashion} onChange={(v) => update({ intFashion: v })} />
      </FilterSection>

      <Separator className="bg-surface-card-border" />

      <FilterSection title="Derived Flags">
        <TriToggle label="Social Active (Daily+)" value={filters.isSocialActiveDaily} onChange={(v) => update({ isSocialActiveDaily: v })} />
        <TriToggle label="High Income ($100K+)" value={filters.isHighIncome} onChange={(v) => update({ isHighIncome: v })} />
      </FilterSection>
    </div>
  );
};

export default AudienceFilterPanel;

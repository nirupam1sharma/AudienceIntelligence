import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadAudienceData, type AudienceRecord } from "@/lib/audienceData";
import { loadSegments, type Segment } from "@/lib/segmentData";
import CrosstabCard from "./CrosstabCard";

interface CardInstance {
  id: string;
}

let _nextId = 1;
const newId = () => String(_nextId++);

const CrosstabStudio = () => {
  const [allData, setAllData] = useState<AudienceRecord[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardInstance[]>([{ id: newId() }]);

  useEffect(() => {
    setSegments(loadSegments());
    loadAudienceData().then((d) => { setAllData(d); setLoading(false); });
  }, []);

  const addCard = () => setCards((prev) => [...prev, { id: newId() }]);
  const deleteCard = (id: string) => setCards((prev) => prev.filter((c) => c.id !== id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-glow-primary/30 border-t-glow-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {cards.map((card, idx) => (
        <CrosstabCard
          key={card.id}
          index={idx}
          allData={allData}
          segments={segments}
          onDelete={() => deleteCard(card.id)}
          canDelete={cards.length > 1}
        />
      ))}

      <Button
        variant="outline"
        onClick={addCard}
        className="w-full border-dashed border-surface-card-border text-hero-muted hover:text-hero-foreground hover:border-glow-primary/50 hover:bg-glow-primary/5 gap-2 h-11 text-sm transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Cross-Tab
      </Button>
    </div>
  );
};

export default CrosstabStudio;

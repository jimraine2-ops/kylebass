import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BriefingEntry } from "@/pages/PennyStocksPage";

export default function BriefingFeed({ briefings }: { briefings: BriefingEntry[] }) {
  if (briefings.length === 0) return null;
  return (
    <Card className="border-primary/20">
      <CardContent className="p-0">
        <ScrollArea className="h-[100px]">
          <div className="p-3 space-y-1">
            {briefings.map(b => (
              <div key={b.id} className="flex items-start gap-2 text-[11px] animate-in fade-in-0 slide-in-from-top-1 duration-300">
                <span className="text-muted-foreground font-mono shrink-0">{b.time}</span>
                <span className={`${b.type === 'buy' ? 'text-primary font-medium' : b.type === 'sell' ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                  {b.type === 'buy' ? '🟢' : b.type === 'sell' ? '🔴' : '📡'} {b.text}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface QuantAutoBriefingProps {
  logs: string[];
  conditions: {
    sentimentPositive: boolean;
    rvolAbove: boolean;
    aboveVwap: boolean;
    meetsScore: boolean;
    isPyramiding: boolean;
    allConditionsMet: boolean;
  } | null;
  isActive: boolean;
}

export function QuantAutoBriefing({ logs, conditions, isActive }: QuantAutoBriefingProps) {
  return (
    <Card className="border-primary/30">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-stock-up animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="text-xs font-bold">
              QUANT AI: {isActive ? 'ACTIVE' : 'STANDBY'}
            </span>
          </div>
          {conditions && (
            <div className="flex items-center gap-1.5">
              <ConditionChip label="호재" met={conditions.sentimentPositive} />
              <ConditionChip label="RVOL≥1.5" met={conditions.rvolAbove} />
              <ConditionChip label="VWAP↑" met={conditions.aboveVwap} />
              <ConditionChip label="≥50점" met={conditions.meetsScore} />
            </div>
          )}
        </div>

        {logs.length > 0 && (
          <ScrollArea className="h-[80px]">
            <div className="space-y-1">
              {logs.map((log, i) => (
                <p key={i} className="text-[10px] font-mono text-muted-foreground leading-tight">
                  {log}
                </p>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function ConditionChip({ label, met }: { label: string; met: boolean }) {
  return (
    <Badge
      variant={met ? "default" : "outline"}
      className={`text-[9px] px-1 py-0 ${met ? 'bg-stock-up/20 text-stock-up border-stock-up/30' : 'text-muted-foreground'}`}
    >
      {met ? <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> : <XCircle className="w-2.5 h-2.5 mr-0.5" />}
      {label}
    </Badge>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyNews } from "@/hooks/useStockData";
import { Newspaper, AlertTriangle, ThumbsUp, ThumbsDown, Minus, Globe, Languages, RefreshCw } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL'];
const SYMBOL_KO: Record<string, string> = {
  AAPL: '애플', MSFT: '마이크로소프트', NVDA: '엔비디아', TSLA: '테슬라', GOOGL: '구글',
};

function analyzeSentiment(text: string): { label: string; score: number } {
  const lower = text.toLowerCase();
  const pos = ['surge', 'rally', 'beat', 'upgrade', 'growth', 'profit', 'record', 'boost', '강세', '급등', '상회', '성장'];
  const neg = ['miss', 'decline', 'loss', 'downgrade', 'warning', 'cut', 'risk', 'fail', '약세', '급락', '하회', '손실'];
  let score = 0;
  pos.forEach(kw => { if (lower.includes(kw)) score += 1; });
  neg.forEach(kw => { if (lower.includes(kw)) score -= 1; });
  if (score > 0) return { label: '긍정', score };
  if (score < 0) return { label: '부정', score };
  return { label: '중립', score: 0 };
}

export default function NewsPage() {
  const [selected, setSelected] = useState('AAPL');
  const { data: news, isLoading, refetch } = useCompanyNews(selected);
  const [originalPopup, setOriginalPopup] = useState<{ headline: string; summary: string } | null>(null);

  const hasTranslated = news?.some((item: any) => item.translated);
  const sentimentIcon = (s: string) => {
    if (s === '긍정') return <ThumbsUp className="w-3 h-3 stock-up" />;
    if (s === '부정') return <ThumbsDown className="w-3 h-3 stock-down" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-primary" />
          실시간 미장 뉴스
        </h1>
        <div className="flex items-center gap-2">
          {hasTranslated && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 flex items-center gap-1">
              <Languages className="w-3 h-3" />
              한국어 번역 중
            </Badge>
          )}
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-muted transition-colors" title="새로고침">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Symbol tabs */}
      <div className="flex gap-2 flex-wrap">
        {SYMBOLS.map(s => (
          <button
            key={s}
            onClick={() => setSelected(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selected === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {SYMBOL_KO[s] || s} ({s})
          </button>
        ))}
      </div>

      {/* News Feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {SYMBOL_KO[selected] || selected} 뉴스 피드
            <Badge variant="outline" className="text-[10px] ml-auto font-normal">최근 7일</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : !news || news.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              최근 7일간 해당 종목의 관련 뉴스가 없습니다
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {news.map((item: any, i: number) => {
                const displayHeadline = item.headline_ko || item.headline;
                const displaySummary = item.summary_ko || item.summary;
                const sentiment = analyzeSentiment(`${displayHeadline} ${displaySummary}`);

                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    {sentimentIcon(sentiment.label)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{displayHeadline}</p>
                      {displaySummary && displaySummary !== displayHeadline && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{displaySummary}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                          {item.source} · {item.datetime ? new Date(item.datetime * 1000).toLocaleDateString('ko-KR') : ''}
                        </span>
                        {item.translated && (
                          <button
                            onClick={() => setOriginalPopup({ headline: item.headline, summary: item.summary })}
                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                          >
                            <Globe className="w-2.5 h-2.5" />
                            원문 보기
                          </button>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${
                      sentiment.label === '긍정' ? 'border-stock-up stock-up' : 
                      sentiment.label === '부정' ? 'border-stock-down stock-down' : ''
                    }`}>
                      {sentiment.label} {sentiment.score > 0 ? '+' : ''}{sentiment.score}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Original English popup */}
      <Dialog open={!!originalPopup} onOpenChange={() => setOriginalPopup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4" />
              영문 원문
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">제목 (Original)</p>
              <p className="text-sm font-medium">{originalPopup?.headline}</p>
            </div>
            {originalPopup?.summary && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">요약 (Original)</p>
                <p className="text-sm text-muted-foreground">{originalPopup?.summary}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

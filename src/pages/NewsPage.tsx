import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSentimentAnalysis } from "@/hooks/useStockData";
import { Newspaper, AlertTriangle, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { useState } from "react";
import { getMockNewsHeadlines } from "@/lib/api";

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL'];

export default function NewsPage() {
  const [selected, setSelected] = useState('AAPL');
  const { data: sentiment, isLoading } = useSentimentAnalysis(selected);
  const headlines = getMockNewsHeadlines(selected);

  const sentimentIcon = (s: string) => {
    if (s === '긍정') return <ThumbsUp className="w-3 h-3 stock-up" />;
    if (s === '부정') return <ThumbsDown className="w-3 h-3 stock-down" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Newspaper className="w-6 h-6 text-primary" />
        뉴스 & 감성 분석
      </h1>

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
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentiment Gauge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">감성 점수</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40" /> : sentiment ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className={`text-4xl font-bold font-mono ${
                    sentiment.sentimentScore > 20 ? 'stock-up' : sentiment.sentimentScore < -20 ? 'stock-down' : 'text-warning'
                  }`}>
                    {sentiment.sentimentScore > 0 ? '+' : ''}{sentiment.sentimentScore}
                  </p>
                  <Badge className="mt-2" variant={sentiment.overallSentiment === '긍정' ? 'default' : sentiment.overallSentiment === '부정' ? 'destructive' : 'secondary'}>
                    {sentiment.overallSentiment}
                  </Badge>
                </div>
                {/* Ratio bars */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-8 stock-up">긍정</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-stock-up rounded-full transition-all" style={{ width: `${sentiment.positiveRatio}%` }} />
                    </div>
                    <span className="text-xs font-mono w-10 text-right">{sentiment.positiveRatio}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-8 text-muted-foreground">중립</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-muted-foreground/40 rounded-full transition-all" style={{ width: `${sentiment.neutralRatio}%` }} />
                    </div>
                    <span className="text-xs font-mono w-10 text-right">{sentiment.neutralRatio}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-8 stock-down">부정</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-stock-down rounded-full transition-all" style={{ width: `${sentiment.negativeRatio}%` }} />
                    </div>
                    <span className="text-xs font-mono w-10 text-right">{sentiment.negativeRatio}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">분석 중...</p>
            )}
          </CardContent>
        </Card>

        {/* News Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {selected} 뉴스 피드
              {sentiment?.warning && (
                <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 악재 경고
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : (
              <div className="space-y-3">
                {(sentiment?.headlines || headlines.map((h: string) => ({ text: h, sentiment: '중립', score: 0, summary: h }))).map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    {sentimentIcon(item.sentiment)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.text}</p>
                      {item.summary && item.summary !== item.text && (
                        <p className="text-xs text-muted-foreground mt-1">{item.summary}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${
                      item.sentiment === '긍정' ? 'border-stock-up stock-up' : 
                      item.sentiment === '부정' ? 'border-stock-down stock-down' : ''
                    }`}>
                      {item.sentiment} {item.score > 0 ? '+' : ''}{item.score}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {sentiment?.warning && (
              <div className="mt-4 p-3 rounded-lg bg-stock-down/10 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-stock-down shrink-0 mt-0.5" />
                <p className="text-sm stock-down">{sentiment.warning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

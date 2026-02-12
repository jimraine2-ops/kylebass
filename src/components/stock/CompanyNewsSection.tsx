import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, ExternalLink, Clock, FileText } from "lucide-react";
import { useCompanyNews } from "@/hooks/useStockData";

const POSITIVE_KEYWORDS = ['surprise', 'exceed', 'approval', 'breakthrough', 'beat', 'record', 'surge', 'upgrade', 'rally', 'growth', 'profit', 'bullish', 'outperform', 'gain', 'boost'];
const NEGATIVE_KEYWORDS = ['miss', 'delay', 'lawsuit', 'decline', 'loss', 'downgrade', 'warning', 'cut', 'bearish', 'risk', 'fail', 'recall', 'investigation', 'fraud', 'debt'];
const SEC_KEYWORDS = ['sec filing', '10-k', '10-q', '8-k', 'form 4', 'form 3', 'proxy', 's-1', 'annual report', 'quarterly report', 'insider'];

function analyzeSentiment(headline: string, summary: string): { score: number; label: string; color: string } {
  const text = `${headline} ${summary}`.toLowerCase();
  let score = 0;
  POSITIVE_KEYWORDS.forEach(kw => { if (text.includes(kw)) score += 1; });
  NEGATIVE_KEYWORDS.forEach(kw => { if (text.includes(kw)) score -= 1; });
  const normalized = Math.max(-1, Math.min(1, score / 3));
  if (normalized > 0.2) return { score: normalized, label: '긍정', color: 'bg-stock-up/20 text-stock-up' };
  if (normalized < -0.2) return { score: normalized, label: '부정', color: 'bg-stock-down/20 text-stock-down' };
  return { score: normalized, label: '중립', color: 'bg-muted text-muted-foreground' };
}

function isSecFiling(headline: string, source: string): boolean {
  const text = `${headline} ${source}`.toLowerCase();
  return SEC_KEYWORDS.some(kw => text.includes(kw));
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return '방금 전';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  return `${Math.floor(seconds / 86400)}일 전`;
}

interface Props {
  symbol: string;
}

export default function CompanyNewsSection({ symbol }: Props) {
  const { data: news, isLoading } = useCompanyNews(symbol);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          실시간 종목 뉴스
          <Badge variant="outline" className="text-[10px] ml-auto font-normal">최근 7일</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : !news || news.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            최근 7일간 해당 종목의 관련 뉴스가 없습니다
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {news.map((item: any, i: number) => {
              const sentiment = analyzeSentiment(item.headline || '', item.summary || '');
              const isSec = isSecFiling(item.headline || '', item.source || '');

              return (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block rounded-lg border p-3 transition-all hover:shadow-sm hover:border-primary/40 ${isSec ? 'border-warning/50 bg-warning/5' : 'border-border'}`}
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    {item.image && (
                      <div className="shrink-0 w-20 h-16 rounded-md overflow-hidden bg-muted">
                        <img
                          src={item.image}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="flex items-start gap-2">
                        <h4 className="text-sm font-medium leading-tight line-clamp-2 flex-1">
                          {item.headline}
                        </h4>
                        <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                      </div>

                      {/* Summary */}
                      {item.summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.summary}
                        </p>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Source & time */}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {item.source} · {item.datetime ? timeAgo(item.datetime) : ''}
                        </span>

                        {/* Sentiment badge */}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${sentiment.color}`}>
                          {sentiment.label} {sentiment.score > 0 ? `+${(sentiment.score * 100).toFixed(0)}` : (sentiment.score * 100).toFixed(0)}
                        </Badge>

                        {/* SEC badge */}
                        {isSec && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/50 bg-warning/20 text-warning">
                            <FileText className="w-2.5 h-2.5 mr-0.5" />
                            공시
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { useStockSearch } from "@/hooks/useStockData";
import { ThemeToggle } from "@/components/ThemeToggle";
import { searchKoreanStocks, type KoreanStockEntry } from "@/lib/koreanStockMap";

export function TopBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const koreanResults = useMemo(() => searchKoreanStocks(debouncedQuery), [debouncedQuery]);
  const hasKoreanResults = koreanResults.length > 0;

  const enableApiSearch = debouncedQuery.length >= 1 && !hasKoreanResults;
  const { data: apiResults, isLoading } = useStockSearch(enableApiSearch ? debouncedQuery : "");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (symbol: string) => {
    setQuery("");
    setOpen(false);
    navigate(`/stock/${symbol}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (koreanResults.length > 0) {
      handleSelect(koreanResults[0].symbol);
      return;
    }
    if (query.trim()) {
      handleSelect(query.trim().toUpperCase());
    }
  };

  const showDropdown = open && debouncedQuery.length >= 1;
  const showLoading = isLoading && !hasKoreanResults;

  return (
    <header className="h-14 border-b border-border flex items-center gap-4 px-4 bg-card/50 backdrop-blur-sm">
      <SidebarTrigger />
      <div ref={wrapperRef} className="relative flex-1 max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            {showLoading ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            )}
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => query.length >= 1 && setOpen(true)}
              placeholder="종목명(한글) 또는 티커(영어)를 입력하세요"
              className="pl-9 h-9 bg-muted/50 border-border text-sm"
            />
          </div>
        </form>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
            {hasKoreanResults && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30">
                  🇰🇷 한국어 검색 결과
                </div>
                <ul>
                  {koreanResults.map((entry: KoreanStockEntry) => (
                    <li
                      key={entry.symbol}
                      className="px-4 py-2.5 hover:bg-accent cursor-pointer flex items-center justify-between gap-2 text-sm"
                      onClick={() => handleSelect(entry.symbol)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-bold text-primary shrink-0 text-sm">
                          {entry.symbol}
                        </span>
                        <div className="min-w-0">
                          <p className="text-foreground font-medium truncate text-xs leading-tight">
                            {entry.koreanName}
                          </p>
                          <p className="text-muted-foreground truncate text-[10px] leading-tight">
                            {entry.englishName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.category && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {entry.category}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!hasKoreanResults && (
              <>
                {showLoading && (
                  <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> 검색 중...
                  </div>
                )}
                {!showLoading && apiResults && apiResults.length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    일치하는 종목이 없습니다
                  </div>
                )}
                {!showLoading && apiResults && apiResults.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30">
                      🔍 검색 결과
                    </div>
                    <ul>
                      {apiResults.map((r: any) => (
                        <li
                          key={r.symbol}
                          className="px-4 py-2.5 hover:bg-accent cursor-pointer flex items-center justify-between gap-2 text-sm"
                          onClick={() => handleSelect(r.symbol)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono font-semibold text-primary shrink-0">
                              {r.symbol}
                            </span>
                            <span className="text-foreground truncate">
                              {r.shortname || r.description || "—"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {r.type || r.exchange || ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          {new Date().toLocaleDateString('ko-KR')}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Clock, X, TrendingUp } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { useStockSearch } from "@/hooks/useStockData";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { ThemeToggle } from "@/components/ThemeToggle";
import { searchKoreanStocks, getKoreanName, type KoreanStockEntry } from "@/lib/koreanStockMap";

export function TopBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { recents, addRecent, clearRecents } = useRecentSearches();

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

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (symbol: string, label?: string) => {
    const displayLabel = label || getKoreanName(symbol) || symbol;
    addRecent(symbol, displayLabel);
    setQuery("");
    setOpen(false);
    navigate(`/stock/${symbol}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (koreanResults.length > 0) {
      handleSelect(koreanResults[0].symbol, koreanResults[0].koreanName);
      return;
    }
    if (query.trim()) {
      handleSelect(query.trim().toUpperCase());
    }
  };

  const showDropdown = open;
  const hasQuery = debouncedQuery.length >= 1;
  const showLoading = isLoading && !hasKoreanResults;
  const showRecents = !hasQuery && recents.length > 0;
  const showResults = hasQuery;

  return (
    <header className="h-14 border-b border-border flex items-center gap-4 px-4 bg-card/50 backdrop-blur-sm">
      <SidebarTrigger />
      <div ref={wrapperRef} className="relative flex-1 max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            {showLoading ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            )}
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="종목명(한글/초성) 또는 티커 검색 · Ctrl+K"
              className="pl-9 pr-20 h-9 bg-muted/50 border-border text-sm"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border font-mono hidden sm:inline">
              Ctrl+K
            </kbd>
          </div>
        </form>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-[420px] overflow-y-auto">
            
            {/* 최근 검색어 */}
            {showRecents && (
              <>
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-border bg-muted/30">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 최근 검색
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearRecents(); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    전체 삭제
                  </button>
                </div>
                <ul>
                  {recents.map((r) => (
                    <li
                      key={r.symbol}
                      className="px-4 py-2 hover:bg-accent cursor-pointer flex items-center justify-between gap-2 text-sm"
                      onClick={() => handleSelect(r.symbol, r.label)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-mono font-bold text-primary text-xs shrink-0">{r.symbol}</span>
                        <span className="text-foreground truncate text-xs">{r.label}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* 검색 결과가 없고 최근 검색도 없을 때 */}
            {!hasQuery && !showRecents && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <Search className="w-5 h-5 mx-auto mb-2 opacity-40" />
                <p>종목명, 초성(ㅌㅅㄹ), 티커(TSLA)로 검색하세요</p>
                <p className="text-[10px] mt-1">미국 전체 상장 종목 검색 가능</p>
              </div>
            )}

            {/* 한글 매핑 결과 */}
            {showResults && hasKoreanResults && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> 🇰🇷 매칭 결과 ({koreanResults.length}건)
                </div>
                <ul>
                  {koreanResults.map((entry: KoreanStockEntry) => (
                    <li
                      key={entry.symbol}
                      className="px-4 py-2.5 hover:bg-accent cursor-pointer flex items-center justify-between gap-2 text-sm group"
                      onClick={() => handleSelect(entry.symbol, entry.koreanName)}
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

            {/* API 검색 결과 (한글 매핑에 없는 전체 종목) */}
            {showResults && !hasKoreanResults && (
              <>
                {showLoading && (
                  <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> 전체 시장 검색 중...
                  </div>
                )}
                {!showLoading && apiResults && apiResults.length === 0 && (
                  <div className="px-4 py-4 text-center">
                    <p className="text-sm text-muted-foreground">일치하는 종목이 없습니다</p>
                    <p className="text-[10px] text-muted-foreground mt-1">유효하지 않은 종목이거나 상장 폐지된 종목입니다</p>
                  </div>
                )}
                {!showLoading && apiResults && apiResults.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30 flex items-center gap-1">
                      <Search className="w-3 h-3" /> 🔍 전체 시장 검색 ({apiResults.length}건)
                    </div>
                    <ul>
                      {apiResults.map((r: any) => (
                        <li
                          key={r.symbol}
                          className="px-4 py-2.5 hover:bg-accent cursor-pointer flex items-center justify-between gap-2 text-sm"
                          onClick={() => handleSelect(r.symbol, r.shortname || r.description)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono font-semibold text-primary shrink-0">
                              {r.symbol}
                            </span>
                            <span className="text-foreground truncate text-xs">
                              {r.shortname || r.description || "—"}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
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

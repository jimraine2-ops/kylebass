import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { useStockSearch } from "@/hooks/useStockData";

export function TopBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const { data: results, isLoading } = useStockSearch(debouncedQuery);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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
    if (query.trim()) {
      handleSelect(query.trim().toUpperCase());
    }
  };

  return (
    <header className="h-14 border-b border-border flex items-center gap-4 px-4 bg-card/50 backdrop-blur-sm">
      <SidebarTrigger />
      <div ref={wrapperRef} className="relative flex-1 max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            {isLoading ? (
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
              placeholder="종목 검색 (예: AAPL, Tesla, NVDA)"
              className="pl-9 h-9 bg-muted/50 border-border text-sm"
            />
          </div>
        </form>

        {open && debouncedQuery.length >= 1 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
            {isLoading && (
              <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> 검색 중...
              </div>
            )}
            {!isLoading && results && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                일치하는 미국 종목이 없습니다
              </div>
            )}
            {!isLoading && results && results.length > 0 && (
              <ul>
                {results.map((r: any) => (
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
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          {new Date().toLocaleDateString('ko-KR')}
        </span>
      </div>
    </header>
  );
}

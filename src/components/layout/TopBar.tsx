import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function TopBar() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/stock/${query.trim().toUpperCase()}`);
      setQuery("");
    }
  };

  return (
    <header className="h-14 border-b border-border flex items-center gap-4 px-4 bg-card/50 backdrop-blur-sm">
      <SidebarTrigger />
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="종목 검색 (예: AAPL, MSFT, NVDA)"
            className="pl-9 h-9 bg-muted/50 border-border text-sm"
          />
        </div>
      </form>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          {new Date().toLocaleDateString('ko-KR')}
        </span>
      </div>
    </header>
  );
}

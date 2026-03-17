import { Moon, Sun, Waves, Leaf, Sparkles, Sunset, Flower2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type ColorTheme } from "@/components/ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const themes: { id: ColorTheme; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "light", label: "라이트", icon: <Sun className="w-4 h-4" />, color: "bg-white border border-border" },
  { id: "dark", label: "다크", icon: <Moon className="w-4 h-4" />, color: "bg-zinc-900" },
  { id: "ocean", label: "오션", icon: <Waves className="w-4 h-4" />, color: "bg-cyan-600" },
  { id: "emerald", label: "에메랄드", icon: <Leaf className="w-4 h-4" />, color: "bg-emerald-600" },
  { id: "purple", label: "퍼플", icon: <Sparkles className="w-4 h-4" />, color: "bg-purple-600" },
  { id: "sunset", label: "선셋", icon: <Sunset className="w-4 h-4" />, color: "bg-orange-500" },
  { id: "rose", label: "로즈", icon: <Flower2 className="w-4 h-4" />, color: "bg-pink-500" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = themes.find(t => t.id === theme) || themes[1];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          aria-label="테마 변경"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">테마 선택</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map(t => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`flex items-center gap-2.5 cursor-pointer ${theme === t.id ? 'bg-accent' : ''}`}
          >
            <div className={`w-4 h-4 rounded-full shrink-0 ${t.color}`} />
            <span className="flex items-center gap-1.5 text-xs">
              {t.icon}
              {t.label}
            </span>
            {theme === t.id && <span className="ml-auto text-primary text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

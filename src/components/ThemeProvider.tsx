import { createContext, useContext, useEffect, useState } from "react";

export type ColorTheme = "light" | "dark" | "ocean" | "emerald" | "purple" | "sunset" | "rose";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ColorTheme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: ColorTheme;
  setTheme: (theme: ColorTheme) => void;
};

const ALL_THEME_CLASSES = ["light", "dark", "theme-ocean", "theme-emerald", "theme-purple", "theme-sunset", "theme-rose"] as const;

function themeToClass(theme: ColorTheme): string {
  if (theme === "light" || theme === "dark") return theme;
  return `theme-${theme}`;
}

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: "dark",
  setTheme: () => null,
});

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "stockpulse-theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ColorTheme>(
    () => (localStorage.getItem(storageKey) as ColorTheme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove all theme classes
    ALL_THEME_CLASSES.forEach(cls => root.classList.remove(cls));
    // Add the active one
    root.classList.add(themeToClass(theme));
  }, [theme]);

  const value = {
    theme,
    setTheme: (t: ColorTheme) => {
      localStorage.setItem(storageKey, t);
      setTheme(t);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};

import * as React from "react";
import { DEFAULT_VOCABULARY, vocabularyFor, type Vocabulary } from "@/lib/vocabulary";

type Density = "compact" | "comfortable";
type Theme = "dark" | "light";

type Ctx = {
  workspace: string;
  setWorkspace: (w: string) => void;
  vocab: Vocabulary;
  setVocab: (key: string) => void;
  density: Density;
  setDensity: (d: Density) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const AppCtx = React.createContext<Ctx | null>(null);

function stored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWs] = React.useState(
    () => stored("honcho.ws", import.meta.env.VITE_DEFAULT_WORKSPACE ?? "default"),
  );
  const [vocabKey, setVocabKey] = React.useState(() => stored("honcho.vocab", DEFAULT_VOCABULARY.key));
  const [density, setDens] = React.useState<Density>(() => stored("honcho.density", "compact") as Density);
  const [theme, setTh] = React.useState<Theme>(() => stored("honcho.theme", "dark") as Theme);

  React.useEffect(() => {
    // The imported design keys its light theme off [data-hx="light"]; :root is
    // dark. Setting the attribute is the whole theme switch.
    document.documentElement.dataset.hx = theme;
    document.documentElement.dataset.density = density;
    try {
      localStorage.setItem("honcho.theme", theme);
      localStorage.setItem("honcho.density", density);
      localStorage.setItem("honcho.ws", workspace);
      localStorage.setItem("honcho.vocab", vocabKey);
    } catch {
      /* private window — the app still works, the preference just will not stick */
    }
  }, [theme, density, workspace, vocabKey]);

  const value = React.useMemo(
    () => ({
      workspace, setWorkspace: setWs,
      vocab: vocabularyFor(vocabKey), setVocab: setVocabKey,
      density, setDensity: setDens,
      theme, setTheme: setTh,
    }),
    [workspace, vocabKey, density, theme],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = React.useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

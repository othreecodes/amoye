import * as React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/lib/app-state";
import { Shell } from "@/components/shell";
import { Palette } from "@/components/palette";
import { ConnectGate } from "@/components/connect";
import { Toaster } from "sonner";

import Today from "@/routes/today";
import People from "@/routes/people";
import Person from "@/routes/person";
import { Conversations } from "@/routes/conversations";
import Conversation from "@/routes/conversation";
import Knowledge from "@/routes/knowledge";
import Ask from "@/routes/ask";
import { Group, Groups } from "@/routes/groups";
import Backlog from "@/routes/backlog";
import Settings from "@/routes/settings";
import Developer from "@/routes/developer";

export default function App() {
  const [palette, setPalette] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.key === "/")) {
        e.preventDefault();
        setPalette((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AppProvider>
      <ConnectGate>
      <BrowserRouter basename="/dashboard">
        <Shell onSearch={() => setPalette(true)}>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/people" element={<People />} />
            <Route path="/people/:personId" element={<Person />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/conversations/:conversationId" element={<Conversation />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/:groupId" element={<Group />} />
            <Route path="/backlog" element={<Backlog />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/developer" element={<Developer />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
        <Palette open={palette} onClose={() => setPalette(false)} />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              borderRadius: "10px",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
            },
          }}
        />
      </BrowserRouter>
      </ConnectGate>
    </AppProvider>
  );
}

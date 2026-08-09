import { useEffect, useState } from "react";

import { App } from "./App";
import { AuthGate } from "./auth";
import { LandingPage } from "./LandingPage";

function workspaceRequested(): boolean {
  return new URLSearchParams(window.location.search).get("workspace") === "1";
}

export function RockyRoot() {
  const [showWorkspace, setShowWorkspace] = useState(workspaceRequested);

  useEffect(() => {
    const handleHistoryChange = () => setShowWorkspace(workspaceRequested());
    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, []);

  function openWorkspace() {
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", "1");
    window.history.pushState({}, "", url);
    setShowWorkspace(true);
    window.scrollTo({ top: 0 });
  }

  if (!showWorkspace) {
    return <LandingPage onOpenWorkspace={openWorkspace} />;
  }

  return (
    <AuthGate>
      <App />
    </AuthGate>
  );
}

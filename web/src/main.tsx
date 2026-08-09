import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { RockyRoot } from "./RockyRoot";
import "./styles.css";
import "./studio.css";
import "./landing.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RockyRoot />
  </StrictMode>,
);

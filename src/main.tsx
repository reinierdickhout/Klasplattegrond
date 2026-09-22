import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { StoreProvider } from "./store.tsx";
import { UiProvider } from "./components/ui.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UiProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </UiProvider>
  </StrictMode>,
);

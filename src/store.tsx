import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Klas, Les, Lokaal } from "./types.ts";
import { bewaarCollectie, dataPad, isTauri, laadCollectie, type CollectieNaam } from "./storage.ts";

export type OpslagStatus = "ok" | "bezig" | "fout";

interface Collectie<T> {
  items: T[];
  update: (fn: (huidig: T[]) => T[]) => void;
  flush: () => Promise<void>;
}

const DEBOUNCE_MS = 150;

function useCollectie<T>(
  naam: CollectieNaam,
  meld: (naam: CollectieNaam, status: OpslagStatus, fout?: string) => void,
): Collectie<T> & { geladen: boolean } {
  const [items, setItems] = useState<T[]>([]);
  const [geladen, setGeladen] = useState(false);
  const laatste = useRef<T[]>([]);
  const vies = useRef(false);
  const geblokkeerd = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let actief = true;
    laadCollectie<T>(naam)
      .then((geladenItems) => {
        if (!actief) return;
        laatste.current = geladenItems;
        setItems(geladenItems);
        setGeladen(true);
      })
      .catch((e) => {
        // Nooit opslaan als laden mislukte: anders overschrijven we een (mogelijk herstelbaar) bestand met een lege lijst.
        geblokkeerd.current = true;
        meld(naam, "fout", `Laden van ${naam} mislukt: ${String(e)}`);
        if (actief) setGeladen(true);
      });
    return () => {
      actief = false;
    };
  }, [naam, meld]);

  const schrijf = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!vies.current || geblokkeerd.current) return;
    vies.current = false;
    meld(naam, "bezig");
    try {
      await bewaarCollectie(naam, laatste.current);
      meld(naam, "ok");
    } catch (e) {
      vies.current = true;
      meld(naam, "fout", `Opslaan van ${naam} mislukt: ${String(e)}`);
    }
  }, [naam, meld]);

  const update = useCallback(
    (fn: (huidig: T[]) => T[]) => {
      if (geblokkeerd.current) return;
      laatste.current = fn(laatste.current);
      setItems(laatste.current);
      vies.current = true;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(schrijf, DEBOUNCE_MS);
    },
    [schrijf],
  );

  return { items, update, flush: schrijf, geladen };
}

interface StoreWaarde {
  geladen: boolean;
  klassen: Klas[];
  lessen: Les[];
  lokalen: Lokaal[];
  updateKlassen: (fn: (huidig: Klas[]) => Klas[]) => void;
  updateLessen: (fn: (huidig: Les[]) => Les[]) => void;
  updateLokalen: (fn: (huidig: Lokaal[]) => Lokaal[]) => void;
  opslag: { status: OpslagStatus; fout?: string };
  dataPad: string;
  flushAlles: () => Promise<void>;
}

const StoreContext = createContext<StoreWaarde | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [opslag, setOpslag] = useState<{ status: OpslagStatus; fout?: string }>({ status: "ok" });
  const [pad, setPad] = useState("");
  const fouten = useRef(new Map<CollectieNaam, string>());

  const meld = useCallback((naam: CollectieNaam, status: OpslagStatus, fout?: string) => {
    if (status === "fout") fouten.current.set(naam, fout ?? "onbekende fout");
    else fouten.current.delete(naam);
    const eerste = [...fouten.current.values()][0];
    if (eerste) setOpslag({ status: "fout", fout: eerste });
    else setOpslag({ status });
  }, []);

  const k = useCollectie<Klas>("klassen", meld);
  const l = useCollectie<Les>("lessen", meld);
  const o = useCollectie<Lokaal>("lokalen", meld);

  useEffect(() => {
    dataPad().then(setPad).catch(() => setPad("onbekend"));
  }, []);

  const flushAlles = useCallback(async () => {
    await Promise.all([k.flush(), l.flush(), o.flush()]);
  }, [k.flush, l.flush, o.flush]);

  // Bij afsluiten van het venster eerst wegschrijven wat nog in de wachtrij staat.
  const flushRef = useRef(flushAlles);
  flushRef.current = flushAlles;
  useEffect(() => {
    if (!isTauri) {
      const bijSluiten = () => void flushRef.current();
      window.addEventListener("beforeunload", bijSluiten);
      return () => window.removeEventListener("beforeunload", bijSluiten);
    }
    let ontkoppel: (() => void) | undefined;
    let weg = false;
    import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const venster = getCurrentWindow();
      const stop = await venster.onCloseRequested(async (event) => {
        event.preventDefault();
        try {
          await flushRef.current();
        } finally {
          await venster.destroy();
        }
      });
      if (weg) stop();
      else ontkoppel = stop;
    });
    return () => {
      weg = true;
      ontkoppel?.();
    };
  }, []);

  const waarde = useMemo<StoreWaarde>(
    () => ({
      geladen: k.geladen && l.geladen && o.geladen,
      klassen: k.items,
      lessen: l.items,
      lokalen: o.items,
      updateKlassen: k.update,
      updateLessen: l.update,
      updateLokalen: o.update,
      opslag,
      dataPad: pad,
      flushAlles,
    }),
    [k.geladen, l.geladen, o.geladen, k.items, l.items, o.items, k.update, l.update, o.update, opslag, pad, flushAlles],
  );

  return <StoreContext.Provider value={waarde}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreWaarde {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore buiten StoreProvider");
  return ctx;
}

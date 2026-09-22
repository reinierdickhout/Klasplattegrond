import { invoke } from "@tauri-apps/api/core";

export type CollectieNaam = "klassen" | "lessen" | "lokalen";

/** In de echte app (Tauri) staat alles als JSON-bestand naast de exe; in de browser-preview valt het terug op localStorage. */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const VERSIE = 1;

interface Envelop<T> {
  versie: number;
  items: T[];
}

export async function laadCollectie<T>(naam: CollectieNaam): Promise<T[]> {
  let ruw: unknown;
  if (isTauri) {
    ruw = await invoke<unknown>("load_collection", { name: naam });
  } else {
    const tekst = localStorage.getItem(`klasplattegrond:${naam}`);
    ruw = tekst ? JSON.parse(tekst) : null;
  }
  if (ruw == null) return [];
  const env = ruw as Envelop<T>;
  if (!env || !Array.isArray(env.items)) {
    throw new Error(`${naam}.json heeft een onverwacht formaat`);
  }
  return env.items;
}

export async function bewaarCollectie<T>(naam: CollectieNaam, items: T[]): Promise<void> {
  const env: Envelop<T> = { versie: VERSIE, items };
  if (isTauri) {
    await invoke("save_collection", { name: naam, value: env });
  } else {
    localStorage.setItem(`klasplattegrond:${naam}`, JSON.stringify(env));
  }
}

export async function dataPad(): Promise<string> {
  if (isTauri) return invoke<string>("get_data_path");
  return "(browser-preview: localStorage)";
}

/** Bewaart een tekstbestand (bv. CSV) op een door de gebruiker gekozen plek. Geeft false terug bij annuleren. */
export async function exporteerTekst(bestandsnaam: string, inhoud: string, extensie: string): Promise<boolean> {
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const pad = await save({ defaultPath: bestandsnaam, filters: [{ name: extensie.toUpperCase(), extensions: [extensie] }] });
    if (!pad) return false;
    await invoke("write_export_file", { path: pad, content: inhoud });
    return true;
  }
  const blob = new Blob([inhoud], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

import type { Student } from "./types.ts";
import { nieuwId, normaliseer, splitsNaam } from "./names.ts";

export type NieuweStudent = Omit<Student, "id">;

/**
 * Alles hier draait lokaal in de app: het bestand wordt in het geheugen gelezen en nergens naartoe gestuurd.
 */

/** Minimale CSV-parser (aanhalingstekens, ; , of tab als scheidingsteken, BOM). */
export function parseCsv(invoer: string): string[][] {
  const tekst = invoer.replace(/^﻿/, "");
  const eersteRegel = tekst.split(/\r?\n/).find((r) => r.trim() !== "") ?? "";
  const tel = (c: string) => eersteRegel.split(c).length - 1;
  const kandidaten = [";", "\t", ","];
  const scheiding = kandidaten.reduce((beste, c) => (tel(c) > tel(beste) ? c : beste), ";");

  const rijen: string[][] = [];
  let rij: string[] = [];
  let cel = "";
  let tussenQuotes = false;
  for (let i = 0; i < tekst.length; i++) {
    const ch = tekst[i];
    if (tussenQuotes) {
      if (ch === '"' && tekst[i + 1] === '"') {
        cel += '"';
        i++;
      } else if (ch === '"') tussenQuotes = false;
      else cel += ch;
    } else if (ch === '"') tussenQuotes = true;
    else if (ch === scheiding) {
      rij.push(cel);
      cel = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && tekst[i + 1] === "\n") i++;
      rij.push(cel);
      rijen.push(rij);
      rij = [];
      cel = "";
    } else cel += ch;
  }
  if (cel !== "" || rij.length > 0) {
    rij.push(cel);
    rijen.push(rij);
  }
  return rijen.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

function celNaarTekst(cel: unknown): string {
  if (cel == null) return "";
  if (cel instanceof Date) return cel.toISOString().slice(0, 10);
  return String(cel).trim();
}

export interface Bestandsinhoud {
  rijen: string[][];
  bladen: string[];
  blad: string;
}

/** Leest een .xlsx (eerste of gekozen werkblad) of .csv/.txt volledig in het geheugen. */
export async function leesBestand(bestand: File, blad?: string): Promise<Bestandsinhoud> {
  const naam = bestand.name.toLowerCase();
  if (naam.endsWith(".xlsx")) {
    const { default: leesXlsx, readSheetNames } = await import("read-excel-file");
    const bladen = await readSheetNames(bestand);
    const gekozen = blad && bladen.includes(blad) ? blad : bladen[0];
    const ruw = await leesXlsx(bestand, { sheet: gekozen });
    const rijen = ruw.map((r) => r.map(celNaarTekst)).filter((r) => r.some((c) => c !== ""));
    return { rijen, bladen, blad: gekozen };
  }
  if (naam.endsWith(".csv") || naam.endsWith(".txt") || naam.endsWith(".tsv")) {
    return { rijen: parseCsv(await bestand.text()), bladen: [], blad: "" };
  }
  throw new Error("Kies een .xlsx-, .csv- of .txt-bestand. (Een oud .xls-bestand? Sla het eerst op als .xlsx.)");
}

export interface Koppeling {
  modus: "gesplitst" | "volledig";
  voornaam: number;
  tussenvoegsel: number;
  achternaam: number;
  volledig: number;
  nummer: number;
}

const GEEN = -1;

const PATRONEN = {
  voornaam: /^(voornaam|roepnaam|first ?name|given ?name)$/,
  tussenvoegsel: /^(tussenvoegsel|voorvoegsel|prefix)s?$/,
  achternaam: /^(achternaam|familienaam|last ?name|surname|family ?name)$/,
  volledig: /^(naam|name|student|studentnaam|volledige ?naam|full ?name|leerling)$/,
  nummer: /(studentnummer|student ?nr|studentnr|studentid|student ?id|nummer|number|lidnummer|id)$/,
};

function kop(cel: string): string {
  return normaliseer(cel).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function lijktOpKoprij(rij: string[]): boolean {
  return rij.some((c) => Object.values(PATRONEN).some((p) => p.test(kop(c))));
}

export function raadKoppeling(kolommen: string[], heeftKop: boolean, kolomAantal: number): Koppeling {
  const k: Koppeling = { modus: "gesplitst", voornaam: GEEN, tussenvoegsel: GEEN, achternaam: GEEN, volledig: GEEN, nummer: GEEN };
  if (heeftKop) {
    kolommen.forEach((c, i) => {
      const t = kop(c);
      if (k.voornaam === GEEN && PATRONEN.voornaam.test(t)) k.voornaam = i;
      else if (k.tussenvoegsel === GEEN && PATRONEN.tussenvoegsel.test(t)) k.tussenvoegsel = i;
      else if (k.achternaam === GEEN && PATRONEN.achternaam.test(t)) k.achternaam = i;
      else if (k.volledig === GEEN && PATRONEN.volledig.test(t)) k.volledig = i;
      else if (k.nummer === GEEN && PATRONEN.nummer.test(t)) k.nummer = i;
    });
    if (k.voornaam !== GEEN && k.achternaam !== GEEN) return k;
    if (k.volledig !== GEEN) return { ...k, modus: "volledig" };
  }
  // Geen (bruikbare) kopregel: eerste kolom is de naam, of eerste twee kolommen voor- en achternaam.
  if (kolomAantal >= 2) return { ...k, modus: "gesplitst", voornaam: 0, achternaam: 1, tussenvoegsel: GEEN, nummer: GEEN };
  return { ...k, modus: "volledig", volledig: 0 };
}

export function bouwStudenten(rijen: string[][], k: Koppeling): { studenten: NieuweStudent[]; overgeslagen: number; dubbel: number } {
  const studenten: NieuweStudent[] = [];
  const gezien = new Set<string>();
  let overgeslagen = 0;
  let dubbel = 0;
  const cel = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  for (const r of rijen) {
    let voornaam: string;
    let achternaam: string;
    if (k.modus === "volledig") {
      ({ voornaam, achternaam } = splitsNaam(cel(r, k.volledig)));
    } else {
      voornaam = cel(r, k.voornaam);
      achternaam = [cel(r, k.tussenvoegsel), cel(r, k.achternaam)].filter(Boolean).join(" ");
    }
    if (!voornaam && !achternaam) {
      overgeslagen++;
      continue;
    }
    const nummer = cel(r, k.nummer) || undefined;
    const sleutel = nummer ? `n:${nummer}` : `t:${normaliseer(`${voornaam} ${achternaam}`)}`;
    if (gezien.has(sleutel)) {
      dubbel++;
      continue;
    }
    gezien.add(sleutel);
    studenten.push({ voornaam, achternaam, ...(nummer ? { nummer } : {}) });
  }
  return { studenten, overgeslagen, dubbel };
}

/**
 * Voegt geïmporteerde studenten toe aan een bestaande lijst. Bestaande studenten blijven hun id houden,
 * zodat oude lessen en plattegronden blijven kloppen. Herkenning: studentnummer, anders naam.
 */
export function voegSamen(
  bestaand: Student[],
  nieuw: NieuweStudent[],
): { studenten: Student[]; toegevoegd: number; bijgewerkt: number } {
  const perNummer = new Map(bestaand.filter((s) => s.nummer).map((s) => [s.nummer as string, s]));
  const perNaam = new Map(bestaand.map((s) => [normaliseer(`${s.voornaam} ${s.achternaam}`), s]));
  const resultaat = [...bestaand];
  let toegevoegd = 0;
  let bijgewerkt = 0;
  for (const n of nieuw) {
    const naamSleutel = normaliseer(`${n.voornaam} ${n.achternaam}`);
    const match = (n.nummer ? perNummer.get(n.nummer) : undefined) ?? perNaam.get(naamSleutel);
    if (match) {
      const idx = resultaat.findIndex((s) => s.id === match.id);
      const wijzigt = match.voornaam !== n.voornaam || match.achternaam !== n.achternaam || (n.nummer && match.nummer !== n.nummer);
      if (wijzigt) {
        resultaat[idx] = { ...match, voornaam: n.voornaam, achternaam: n.achternaam, nummer: n.nummer ?? match.nummer };
        bijgewerkt++;
      }
    } else {
      resultaat.push({ id: nieuwId(), ...n });
      toegevoegd++;
    }
  }
  return { studenten: resultaat, toegevoegd, bijgewerkt };
}

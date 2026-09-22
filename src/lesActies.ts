import type { AanwezigheidRij, Klas, Les, Plaatsing } from "./types.ts";
import { sorteerOpAchternaam, volledigeNaam } from "./names.ts";

/** Koppelt een student aan een tafel. Eerdere koppelingen van dezelfde tafel of student vervallen. */
export function plaats(les: Les, tafelId: string, studentId: string, nu: Date = new Date()): Les {
  const nieuw: Plaatsing = {
    tafelId,
    studentId,
    tijd: nu.toISOString(),
    // Wie na het afsluiten van de aanvang wordt gekoppeld, is later binnengekomen.
    laat: les.aanvangAfgesloten != null,
  };
  return {
    ...les,
    plaatsingen: [...les.plaatsingen.filter((p) => p.tafelId !== tafelId && p.studentId !== studentId), nieuw],
  };
}

/**
 * Zet een student op een tafel; werkt voor drag & drop en klik-koppelen.
 * - Nog niet geplaatst: nieuwe koppeling (telt als 'later' als de aanvang al is afgesloten). Een eventuele andere student op die tafel valt eraf.
 * - Al geplaatst en de doeltafel is vrij: de student verhuist; tijdstip en 'later'-status blijven behouden (verhuizen is niet opnieuw binnenkomen).
 * - Al geplaatst en de doeltafel is bezet: de twee studenten wisselen van tafel.
 */
export function zetStudentOpTafel(les: Les, studentId: string, tafelId: string, nu: Date = new Date()): Les {
  const eigen = les.plaatsingen.find((p) => p.studentId === studentId);
  if (!eigen) return plaats(les, tafelId, studentId, nu);
  if (eigen.tafelId === tafelId) return les;
  const doel = les.plaatsingen.find((p) => p.tafelId === tafelId);
  return {
    ...les,
    plaatsingen: les.plaatsingen.map((p) => (p === eigen ? { ...p, tafelId } : p === doel ? { ...p, tafelId: eigen.tafelId } : p)),
  };
}

export function losStudent(les: Les, studentId: string): Les {
  return { ...les, plaatsingen: les.plaatsingen.filter((p) => p.studentId !== studentId) };
}

export function verwijderPlaatsing(les: Les, tafelId: string): Les {
  return { ...les, plaatsingen: les.plaatsingen.filter((p) => p.tafelId !== tafelId) };
}

export function zetLaat(les: Les, tafelId: string, laat: boolean): Les {
  return { ...les, plaatsingen: les.plaatsingen.map((p) => (p.tafelId === tafelId ? { ...p, laat } : p)) };
}

export function startLes(les: Les, nu: Date = new Date()): Les {
  return { ...les, status: "bezig", startTijd: les.startTijd ?? nu.toISOString() };
}

export function sluitAanvang(les: Les, nu: Date = new Date()): Les {
  return { ...les, aanvangAfgesloten: nu.toISOString() };
}

export function heropenAanvang(les: Les): Les {
  const { aanvangAfgesloten: _weg, ...rest } = les;
  return rest;
}

export function verwijderTafels(les: Les, ids: Set<string>): Les {
  return {
    ...les,
    tafels: les.tafels.filter((t) => !ids.has(t.id)),
    plaatsingen: les.plaatsingen.filter((p) => !ids.has(p.tafelId)),
  };
}

/** Eén rij per student van de klas, alfabetisch op achternaam. */
export function berekenAanwezigheid(les: Les, klas: Klas): AanwezigheidRij[] {
  const perStudent = new Map(les.plaatsingen.map((p) => [p.studentId, p]));
  return sorteerOpAchternaam(klas.studenten).map((student) => {
    const p = perStudent.get(student.id);
    if (!p) return { student, status: "afwezig" as const };
    return { student, status: p.laat ? ("later" as const) : ("aanvang" as const), tijd: p.tijd };
  });
}

export function tel(rijen: AanwezigheidRij[]): { aanvang: number; later: number; afwezig: number; aanwezig: number; totaal: number } {
  const aanvang = rijen.filter((r) => r.status === "aanvang").length;
  const later = rijen.filter((r) => r.status === "later").length;
  return { aanvang, later, afwezig: rijen.length - aanvang - later, aanwezig: aanvang + later, totaal: rijen.length };
}

export function klokTijd(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

export function datumNl(datum: string): string {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export const STATUS_TEKST = { aanvang: "Aanwezig bij aanvang", later: "Later binnengekomen", afwezig: "Afwezig" } as const;

/** Excel-vriendelijke CSV (puntkomma, BOM), zodat het bestand in een Nederlandse Excel direct goed opent. */
export function maakCsv(les: Les, klas: Klas, rijen: AanwezigheidRij[]): string {
  const esc = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const regels: string[][] = [
    ["Aanwezigheidslijst"],
    ["Les", les.titel || "(zonder titel)"],
    ["Klas", klas.naam],
    ["Datum", les.datum],
    ["Start", klokTijd(les.startTijd)],
    [],
    ["Naam", "Studentnummer", "Status", "Binnengekomen om"],
    ...rijen.map((r) => [volledigeNaam(r.student), r.student.nummer ?? "", STATUS_TEKST[r.status], klokTijd(r.tijd)]),
  ];
  return "﻿" + regels.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}

/** Tab-gescheiden tekst voor plakken in Excel. */
export function maakTsv(rijen: AanwezigheidRij[]): string {
  return rijen.map((r) => [volledigeNaam(r.student), STATUS_TEKST[r.status], klokTijd(r.tijd)].join("\t")).join("\n");
}

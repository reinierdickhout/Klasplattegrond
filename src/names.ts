import type { Student } from "./types.ts";

const collator = new Intl.Collator("nl", { sensitivity: "base", numeric: true });

export function volledigeNaam(s: Pick<Student, "voornaam" | "achternaam">): string {
  return [s.voornaam, s.achternaam].filter(Boolean).join(" ");
}

/** Splitst "Anna de Vries" -> Anna / de Vries, en "de Vries, Anna" -> Anna / de Vries. */
export function splitsNaam(volledig: string): { voornaam: string; achternaam: string } {
  const tekst = volledig.replace(/\s+/g, " ").trim();
  if (tekst.includes(",")) {
    const [achter, ...rest] = tekst.split(",");
    return { voornaam: rest.join(",").trim(), achternaam: achter.trim() };
  }
  const idx = tekst.indexOf(" ");
  if (idx < 0) return { voornaam: tekst, achternaam: "" };
  return { voornaam: tekst.slice(0, idx), achternaam: tekst.slice(idx + 1).trim() };
}

/** Kleine letters zonder accenten, voor zoeken. */
export function normaliseer(tekst: string): string {
  return tekst.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Alle getypte woorden moeten ergens in de naam (of het nummer) voorkomen, in willekeurige volgorde. */
export function matchStudent(s: Student, zoek: string): boolean {
  const woorden = normaliseer(zoek).split(/\s+/).filter(Boolean);
  if (woorden.length === 0) return true;
  const hooiberg = normaliseer(`${s.voornaam} ${s.achternaam} ${s.nummer ?? ""}`);
  return woorden.every((w) => hooiberg.includes(w));
}

export function sorteerOpVoornaam(lijst: Student[]): Student[] {
  return [...lijst].sort((a, b) => collator.compare(a.voornaam, b.voornaam) || collator.compare(a.achternaam, b.achternaam));
}

const TUSSENVOEGSEL = /^(van der|van den|van de|van 't|van|de|den|der|ten|ter|te|von|het|'t)\s+/i;

/** Sorteersleutel zoals in Nederland gebruikelijk: "de Boer" staat onder de B. */
export function sorteerSleutel(achternaam: string): string {
  return achternaam.replace(TUSSENVOEGSEL, "");
}

export function sorteerOpAchternaam(lijst: Student[]): Student[] {
  return [...lijst].sort(
    (a, b) => collator.compare(sorteerSleutel(a.achternaam), sorteerSleutel(b.achternaam)) || collator.compare(a.voornaam, b.voornaam),
  );
}

export function nieuwId(): string {
  return crypto.randomUUID();
}

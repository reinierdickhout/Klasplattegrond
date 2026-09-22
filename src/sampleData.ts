import type { Klas, Student } from "./types.ts";
import { nieuwId } from "./names.ts";

/** Volledig fictieve namen, zodat je de app kunt uitproberen zonder echte studentgegevens. */
const NAMEN: Array<[string, string]> = [
  ["Sanne", "de Vries"], ["Daan", "Jansen"], ["Yara", "El Amrani"], ["Luuk", "van den Berg"],
  ["Fleur", "Bakker"], ["Milan", "Visser"], ["Noor", "Smit"], ["Tim", "Meijer"],
  ["Iris", "de Boer"], ["Jesse", "Mulder"], ["Lotte", "de Groot"], ["Ruben", "Bos"],
  ["Amira", "Yilmaz"], ["Stijn", "Peters"], ["Eva", "Hendriks"], ["Sem", "van Dijk"],
  ["Mila", "Dekker"], ["Thijs", "Brouwer"], ["Zoë", "van der Meer"], ["Bram", "Kok"],
  ["Lieke", "Jacobs"], ["Niels", "Vos"], ["Femke", "van Leeuwen"], ["Joost", "Willems"],
  ["Anouk", "Hoekstra"], ["Kars", "Maas"], ["Roos", "Verhoeven"], ["Tygo", "Schouten"],
];

export function voorbeeldKlas(): Klas {
  const studenten: Student[] = NAMEN.map(([voornaam, achternaam], i) => ({
    id: nieuwId(),
    voornaam,
    achternaam,
    nummer: String(2900001 + i),
  }));
  return { id: nieuwId(), naam: "Voorbeeldklas (fictief)", studenten, bijgewerkt: new Date().toISOString() };
}

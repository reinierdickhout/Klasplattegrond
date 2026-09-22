export interface Student {
  id: string;
  voornaam: string;
  achternaam: string;
  /** Optioneel studentnummer; wordt gebruikt om bij her-importeren dezelfde student te herkennen. */
  nummer?: string;
}

export interface Klas {
  id: string;
  naam: string;
  studenten: Student[];
  bijgewerkt: string;
}

export type Rotatie = 0 | 90 | 180 | 270;

/**
 * Eenheden zijn rastercellen. Een tafel is 4x3 cellen (liggend), 3x4 na een kwartslag.
 * (x, y) is de linkerbovenhoek van het huidige (dus reeds gedraaide) vlak.
 * Bij rotatie 0 zit de student onderaan de tafel en kijkt naar het bord (bovenkant).
 */
export interface Tafel {
  id: string;
  x: number;
  y: number;
  rot: Rotatie;
}

export interface Ruimte {
  breedte: number;
  hoogte: number;
}

export interface Plaatsing {
  tafelId: string;
  studentId: string;
  /** ISO-tijdstip waarop de student aan de tafel werd gekoppeld. */
  tijd: string;
  /** true = gekoppeld nadat de aanvang was afgesloten (dus later binnengekomen). */
  laat: boolean;
}

export type LesStatus = "voorbereiding" | "bezig" | "afgerond";

export interface Les {
  id: string;
  titel: string;
  /** yyyy-mm-dd */
  datum: string;
  klasId: string;
  capaciteit: number;
  ruimte: Ruimte;
  tafels: Tafel[];
  plaatsingen: Plaatsing[];
  status: LesStatus;
  startTijd?: string;
  /** Tijdstip waarop "de aanvang" werd afgesloten; plaatsingen daarna gelden als 'later'. */
  aanvangAfgesloten?: string;
  aangemaakt: string;
}

/** Een bewaarde tafelindeling voor een vast lokaal. */
export interface Lokaal {
  id: string;
  naam: string;
  capaciteit: number;
  ruimte: Ruimte;
  tafels: Tafel[];
}

export type AanwezigheidStatus = "aanvang" | "later" | "afwezig";

export interface AanwezigheidRij {
  student: Student;
  status: AanwezigheidStatus;
  /** ISO-tijdstip van binnenkomst, alleen bij aanwezig/later. */
  tijd?: string;
}

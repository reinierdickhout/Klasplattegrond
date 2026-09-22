import type { Ruimte, Tafel, Rotatie } from "./types.ts";
import { nieuwId } from "./names.ts";

export const TAFEL_B = 4;
export const TAFEL_D = 3;
/** Ruimte vooraan voor bord/docent. */
export const VOORKANT = 5;
const RAND = 2;
const BLOK_B = TAFEL_B * 2;
const GANG = 2;
const RIJ_STAP = TAFEL_D + 1;

export function afmeting(t: Pick<Tafel, "rot">): { w: number; h: number } {
  return t.rot % 180 === 0 ? { w: TAFEL_B, h: TAFEL_D } : { w: TAFEL_D, h: TAFEL_B };
}

/**
 * Standaard indeling: blokken van 2 tafels breed, meerdere rijen diep.
 * 18 studenten -> 3 blokken van 2 breed x 3 diep. Kiest het aantal blokken dat de minste lege
 * plekken geeft en een gangbare (liggende) lokaalverhouding; rijen worden van voor naar achter gevuld.
 */
export function standaardIndeling(aantal: number): { tafels: Tafel[]; ruimte: Ruimte; blokken: number; diepte: number } {
  const n = Math.max(1, Math.round(aantal));
  const paren = Math.ceil(n / 2);
  let best = { blokken: 1, diepte: paren, score: Infinity };
  for (let b = 1; b <= Math.min(8, paren); b++) {
    const d = Math.ceil(paren / b);
    const leeg = b * d - paren;
    const breedte = b * BLOK_B + (b - 1) * GANG;
    const diepte = d * RIJ_STAP;
    const score = leeg * 2 + Math.abs(Math.log(breedte / diepte / 1.9)) * 3;
    if (score < best.score) best = { blokken: b, diepte: d, score };
  }
  const { blokken, diepte } = best;
  const tafels: Tafel[] = [];
  for (let p = 0; p < paren; p++) {
    const rij = Math.floor(p / blokken);
    const blok = p % blokken;
    for (const links of [true, false]) {
      if (tafels.length >= n) break;
      tafels.push({
        id: nieuwId(),
        x: RAND + blok * (BLOK_B + GANG) + (links ? 0 : TAFEL_B),
        y: VOORKANT + rij * RIJ_STAP,
        rot: 0,
      });
    }
  }
  const ruimte: Ruimte = {
    breedte: RAND * 2 + blokken * BLOK_B + (blokken - 1) * GANG,
    hoogte: VOORKANT + diepte * RIJ_STAP + 2,
  };
  return { tafels, ruimte, blokken, diepte };
}

/**
 * Draait een tafel of groep tafels (bv. een heel blok) een kwartslag. Alles blijft in gehele rastercellen:
 * het omhullende vlak van de groep draait rond zijn eigen midden en - omdat een oneven verschil tussen
 * breedte en hoogte een half-cel verschuiving geeft - wordt daarna met een vaste regel afgerond
 * (liggend -> staand: naar rechts/boven, staand -> liggend: naar links/onder). Daardoor keren
 * twee kwartslagen exact terug en ontstaat er nooit drift. Binnen de groep behoudt elke tafel zijn relatieve plek.
 */
export function draaiGroep(tafels: Tafel[], richting: 1 | -1, ruimte: Ruimte): Tafel[] {
  const b = bbox(tafels);
  const W = b.w;
  const H = b.h;
  const dx = W > H ? Math.ceil((W - H) / 2) : Math.floor((W - H) / 2);
  const dy = W > H ? Math.floor((H - W) / 2) : Math.ceil((H - W) / 2);
  const nx = b.x + dx;
  const ny = b.y + dy;
  const gedraaid = tafels.map((t) => {
    const { w, h } = afmeting(t);
    const rx = t.x - b.x;
    const ry = t.y - b.y;
    const [relx, rely] = richting === 1 ? [H - ry - h, rx] : [ry, W - rx - w];
    const rot = ((t.rot + 90 * richting + 360) % 360) as Rotatie;
    return { ...t, rot, x: nx + relx + 0, y: ny + rely + 0 };
  });
  // Hele groep terug de ruimte in schuiven. Past de groep niet (dan is hij groter dan het lokaal), dan gaat
  // links/boven vóór: nooit negatieve coördinaten; de aanroeper laat het lokaal rechts/onder meegroeien.
  const nb = bbox(gedraaid);
  const sx = Math.max(-nb.x, Math.min(0, ruimte.breedte - (nb.x + nb.w)));
  const sy = Math.max(-nb.y, Math.min(0, ruimte.hoogte - (nb.y + nb.h)));
  return gedraaid.map((t) => ({ ...t, x: t.x + sx, y: t.y + sy }));
}

export function bbox(tafels: Tafel[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tafels) {
    const { w, h } = afmeting(t);
    x0 = Math.min(x0, t.x);
    y0 = Math.min(y0, t.y);
    x1 = Math.max(x1, t.x + w);
    y1 = Math.max(y1, t.y + h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function clamp(t: Tafel, ruimte: Ruimte): Tafel {
  const { w, h } = afmeting(t);
  return {
    ...t,
    x: Math.min(Math.max(0, t.x), Math.max(0, ruimte.breedte - w)),
    y: Math.min(Math.max(0, t.y), Math.max(0, ruimte.hoogte - h)),
  };
}

export function overlapt(a: Tafel, b: Tafel): boolean {
  const A = afmeting(a);
  const B = afmeting(b);
  return a.x < b.x + B.w && b.x < a.x + A.w && a.y < b.y + B.h && b.y < a.y + A.h;
}

export function overlappendeIds(tafels: Tafel[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < tafels.length; i++) {
    for (let j = i + 1; j < tafels.length; j++) {
      if (overlapt(tafels[i], tafels[j])) {
        ids.add(tafels[i].id);
        ids.add(tafels[j].id);
      }
    }
  }
  return ids;
}

/** Zoekt de eerste vrije plek (rij voor rij) voor een extra tafel. */
export function vrijePlek(tafels: Tafel[], ruimte: Ruimte): { x: number; y: number } {
  for (let y = VOORKANT; y + TAFEL_D <= ruimte.hoogte; y++) {
    for (let x = 0; x + TAFEL_B <= ruimte.breedte; x++) {
      const kandidaat: Tafel = { id: "", x, y, rot: 0 };
      if (!tafels.some((t) => overlapt(kandidaat, t))) return { x, y };
    }
  }
  return { x: 0, y: VOORKANT };
}

/** Richting (eenheidsvector) waarin de stoel staat, ten opzichte van de tafel. */
export function stoelRichting(rot: Rotatie): { dx: number; dy: number } {
  switch (rot) {
    case 0: return { dx: 0, dy: 1 };
    case 90: return { dx: -1, dy: 0 };
    case 180: return { dx: 0, dy: -1 };
    case 270: return { dx: 1, dy: 0 };
  }
}

/** Kopie van een indeling met nieuwe tafel-ids (bv. bij hergebruik van een sjabloon). */
export function kopieerTafels(tafels: Tafel[]): Tafel[] {
  return tafels.map((t) => ({ ...t, id: nieuwId() }));
}

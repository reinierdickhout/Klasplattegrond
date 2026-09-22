import { useMemo, useRef, useState } from "react";
import type { Ruimte, Student, Tafel } from "../types.ts";
import { afmeting, bbox, overlappendeIds, stoelRichting } from "../layout.ts";
import { klokTijd } from "../lesActies.ts";

export interface Bezetting {
  student: Student;
  laat: boolean;
  tijd: string;
}

interface Props {
  tafels: Tafel[];
  ruimte: Ruimte;
  bezetting: Map<string, Bezetting>;
  geselecteerd: Set<string>;
  /** Oefenmodus: namen zijn verborgen tot je op een tafel klikt. */
  verbergNamen: boolean;
  onthuld: Set<string>;
  /** Tafel waarboven een gesleepte student nu zweeft (wordt gemarkeerd). */
  dropTafelId: string | null;
  /** Er wordt op dit moment een student gesleept (tafels tonen dat ze een doel zijn). */
  studentSleept: boolean;
  onSelecteer: (ids: Set<string>) => void;
  onWijzig: (tafels: Tafel[]) => void;
  /** Klik zonder slepen op een tafel (selecteren is dan al gebeurd). */
  onTafelKlik: (id: string) => void;
  /** Begin van het slepen van de student aan een tafel, via de greep. */
  onStudentSleepStart: (studentId: string, tafelId: string, e: React.PointerEvent) => void;
}

interface Slepen {
  ids: Set<string>;
  tafelId: string;
  optellen: boolean;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  origineel: Map<string, Tafel>;
}

interface Band {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  optellen: boolean;
}

/** Past een tekst in een gegeven breedte (in rastereenheden) door het lettertype te verkleinen, en kapt anders af. */
function passendeTekst(tekst: string, maxBreedte: number, maxFont: number, minFont: number): { tekst: string; font: number } {
  const teken = 0.56;
  const font = Math.min(maxFont, maxBreedte / (Math.max(tekst.length, 1) * teken));
  if (font >= minFont) return { tekst, font };
  const maxTekens = Math.max(3, Math.floor(maxBreedte / (minFont * teken)));
  return { tekst: tekst.slice(0, maxTekens - 1) + "…", font: minFont };
}

const klem = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

const GREEP_PUNTEN = [-1, 0, 1].flatMap((r) => [-1, 1].map((k) => ({ x: k * 0.14, y: r * 0.2 })));

export function RoomCanvas({
  tafels,
  ruimte,
  bezetting,
  geselecteerd,
  verbergNamen,
  onthuld,
  dropTafelId,
  studentSleept,
  onSelecteer,
  onWijzig,
  onTafelKlik,
  onStudentSleepStart,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  /** Groep met de 180°-gedraaide weergave; pointer-coördinaten worden via deze groep naar rasterdata omgerekend. */
  const kamerRef = useRef<SVGGElement>(null);
  const [slepen, setSlepen] = useState<Slepen | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  const overlap = useMemo(() => overlappendeIds(tafels), [tafels]);

  const naarEenheden = (e: { clientX: number; clientY: number }) => {
    const m = kamerRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const bijTafelIndrukken = (e: React.PointerEvent, t: Tafel) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const optellen = e.shiftKey || e.ctrlKey || e.metaKey;
    let sel = new Set(geselecteerd);
    if (optellen) {
      if (sel.has(t.id)) {
        sel.delete(t.id);
        onSelecteer(sel);
        return;
      }
      sel.add(t.id);
    } else if (!sel.has(t.id)) {
      sel = new Set([t.id]);
    }
    onSelecteer(sel);
    const p = naarEenheden(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    setSlepen({
      ids: sel,
      tafelId: t.id,
      optellen,
      startX: p.x,
      startY: p.y,
      dx: 0,
      dy: 0,
      origineel: new Map(tafels.filter((x) => sel.has(x.id)).map((x) => [x.id, x])),
    });
  };

  const bijAchtergrondIndrukken = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = naarEenheden(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    setBand({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, optellen: e.shiftKey || e.ctrlKey || e.metaKey });
  };

  const bijBewegen = (e: React.PointerEvent) => {
    if (slepen) {
      const p = naarEenheden(e);
      const b = bbox([...slepen.origineel.values()]);
      // Snappen op het raster: hele cellen, en de groep blijft binnen het lokaal.
      const dx = klem(Math.round(p.x - slepen.startX), -b.x, ruimte.breedte - (b.x + b.w));
      const dy = klem(Math.round(p.y - slepen.startY), -b.y, ruimte.hoogte - (b.y + b.h));
      if (dx !== slepen.dx || dy !== slepen.dy) setSlepen({ ...slepen, dx, dy });
    } else if (band) {
      const p = naarEenheden(e);
      setBand({ ...band, x1: p.x, y1: p.y });
    }
  };

  const bijLoslaten = () => {
    if (slepen) {
      if (slepen.dx !== 0 || slepen.dy !== 0) {
        onWijzig(
          tafels.map((t) => {
            const o = slepen.origineel.get(t.id);
            return o ? { ...t, x: o.x + slepen.dx, y: o.y + slepen.dy } : t;
          }),
        );
      } else {
        // Gewone klik: uit een groepsselectie alleen de aangeklikte tafel overhouden
        if (!slepen.optellen && slepen.ids.size > 1) onSelecteer(new Set([slepen.tafelId]));
        onTafelKlik(slepen.tafelId);
      }
      setSlepen(null);
    }
    if (band) {
      const [x0, x1] = [Math.min(band.x0, band.x1), Math.max(band.x0, band.x1)];
      const [y0, y1] = [Math.min(band.y0, band.y1), Math.max(band.y0, band.y1)];
      if (x1 - x0 < 0.4 && y1 - y0 < 0.4) {
        if (!band.optellen) onSelecteer(new Set());
      } else {
        const ids = new Set(band.optellen ? geselecteerd : []);
        for (const t of tafels) {
          const { w, h } = afmeting(t);
          if (t.x < x1 && t.x + w > x0 && t.y < y1 && t.y + h > y0) ids.add(t.id);
        }
        onSelecteer(ids);
      }
      setBand(null);
    }
  };

  // Geselecteerde/gesleepte tafels bovenop tekenen
  const getekend = useMemo(() => [...tafels].sort((a, b) => Number(geselecteerd.has(a.id)) - Number(geselecteerd.has(b.id))), [tafels, geselecteerd]);

  const marge = 1;
  return (
    <svg
      ref={svgRef}
      className={`ruimte${studentSleept ? " student-sleept" : ""}`}
      viewBox={`${-marge} ${-marge} ${ruimte.breedte + marge * 2} ${ruimte.hoogte + marge * 2}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={bijBewegen}
      onPointerUp={bijLoslaten}
      onPointerCancel={bijLoslaten}
    >
      <defs>
        <pattern id="raster" width="1" height="1" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="0.06" className="rasterpunt" />
        </pattern>
      </defs>
      {/* Weergave vanuit de docent: bord onderaan. 180° gedraaid (geen spiegeling); de data blijft ongewijzigd. */}
      <g ref={kamerRef} transform={`rotate(180 ${ruimte.breedte / 2} ${ruimte.hoogte / 2})`}>
        <rect className="vloer" x={0} y={0} width={ruimte.breedte} height={ruimte.hoogte} rx={0.4} onPointerDown={bijAchtergrondIndrukken} />
        <rect x={0} y={0} width={ruimte.breedte} height={ruimte.hoogte} fill="url(#raster)" pointerEvents="none" />
        <rect className="bord" x={2} y={0.7} width={Math.max(2, ruimte.breedte - 4)} height={1.6} rx={0.4} pointerEvents="none" />
        <text className="bord-tekst" x={ruimte.breedte / 2} y={1.5} transform={`rotate(180 ${ruimte.breedte / 2} 1.5)`} pointerEvents="none">
          Bord / docent
        </text>

        {getekend.map((t) => {
          const versleep = slepen?.ids.has(t.id) ? slepen : null;
          const x = t.x + (versleep?.dx ?? 0);
          const y = t.y + (versleep?.dy ?? 0);
          const { w, h } = afmeting(t);
          const b = bezetting.get(t.id);
          const zichtbaar = !verbergNamen || onthuld.has(t.id);
          const stoel = stoelRichting(t.rot);
          const stoelX = stoel.dy !== 0 ? w / 2 - 1 : stoel.dx < 0 ? -0.45 : w - 0.35;
          const stoelY = stoel.dx !== 0 ? h / 2 - 1 : stoel.dy < 0 ? -0.45 : h - 0.35;
          const stoelB = stoel.dy !== 0 ? 2 : 0.8;
          const stoelH = stoel.dx !== 0 ? 2 : 0.8;
          const klasse = [
            "tafel",
            b ? (b.laat ? "laat" : "aanvang") : "leeg",
            geselecteerd.has(t.id) && "gekozen",
            overlap.has(t.id) && "overlap",
            versleep && "wordt-gesleept",
            dropTafelId === t.id && "drop-doel",
          ]
            .filter(Boolean)
            .join(" ");
          const binnenB = w - 0.6;
          const voor = b ? passendeTekst(b.student.voornaam, binnenB, 0.95, 0.5) : null;
          const achter = b && b.student.achternaam ? passendeTekst(b.student.achternaam, binnenB, 0.72, 0.45) : null;
          return (
            <g key={t.id} className={klasse} data-tafel-id={t.id} transform={`translate(${x} ${y})`} onPointerDown={(e) => bijTafelIndrukken(e, t)}>
              <rect className="stoel" x={stoelX} y={stoelY} width={stoelB} height={stoelH} rx={0.3} />
              <rect className="blad" width={w} height={h} rx={0.35} />
              <g transform={`rotate(180 ${w / 2} ${h / 2})`}>
                {b && zichtbaar && voor && (
                  <>
                    <title>{`${b.student.voornaam} ${b.student.achternaam}`.trim()}</title>
                    <text className="naam-voor" x={w / 2} y={h / 2 - (achter ? 0.05 : 0)} fontSize={voor.font}>
                      {voor.tekst}
                    </text>
                    {achter && (
                      <text className="naam-achter" x={w / 2} y={h / 2 + 0.7} fontSize={achter.font}>
                        {achter.tekst}
                      </text>
                    )}
                    {b.laat && (
                      <text className="naam-tijd" x={w / 2} y={h / 2 - 1.0} fontSize={0.5}>
                        {klokTijd(b.tijd)}
                      </text>
                    )}
                  </>
                )}
                {b && !zichtbaar && (
                  <text className="naam-verborgen" x={w / 2} y={h / 2} fontSize={1.4}>
                    ?
                  </text>
                )}
                {!b && (
                  <text className="naam-plus" x={w / 2} y={h / 2} fontSize={1.3}>
                    +
                  </text>
                )}
              </g>
              {b && zichtbaar && (
                // Greep om de student (met naam) naar een andere tafel te slepen. Links boven op het scherm = rechts onder in de gedraaide data.
                <g
                  className="greep"
                  transform={`translate(${w - 0.7} ${h - 0.7})`}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    onStudentSleepStart(b.student.id, t.id, e);
                  }}
                >
                  <title>Sleep om deze student naar een andere tafel te zetten (of naar de lijst om los te koppelen)</title>
                  <circle className="greep-bg" r={0.5} />
                  {GREEP_PUNTEN.map((p, i) => (
                    <circle key={i} className="greep-punt" cx={p.x} cy={p.y} r={0.05} />
                  ))}
                </g>
              )}
            </g>
          );
        })}

        {band && (
          <rect
            className="rubberband"
            x={Math.min(band.x0, band.x1)}
            y={Math.min(band.y0, band.y1)}
            width={Math.abs(band.x1 - band.x0)}
            height={Math.abs(band.y1 - band.y0)}
            pointerEvents="none"
          />
        )}
      </g>
    </svg>
  );
}

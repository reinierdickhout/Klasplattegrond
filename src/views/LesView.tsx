import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Les, Student, Tafel } from "../types.ts";
import { afmeting, bbox, clamp as klemTafel, draaiGroep, kopieerTafels, standaardIndeling, vrijePlek } from "../layout.ts";
import { matchStudent, nieuwId, sorteerOpVoornaam, splitsNaam, volledigeNaam } from "../names.ts";
import {
  berekenAanwezigheid,
  datumNl,
  heropenAanvang,
  klokTijd,
  losStudent,
  sluitAanvang,
  startLes,
  tel,
  verwijderPlaatsing,
  verwijderTafels,
  zetLaat,
  zetStudentOpTafel,
} from "../lesActies.ts";
import { useStore } from "../store.tsx";
import { RoomCanvas, type Bezetting } from "../components/RoomCanvas.tsx";
import { AanwezigheidDialog } from "../components/AanwezigheidDialog.tsx";
import { useUi } from "../components/ui.tsx";
import { PRESETS } from "../components/NieuweLesDialog.tsx";

interface SleepStatus {
  studentId: string;
  vanTafelId: string | null;
  x: number;
  y: number;
  doelTafel: string | null;
  doelLijst: boolean;
}

interface StudentLijstProps {
  studenten: Student[];
  geplaatst: Set<string>;
  zoek: string;
  setZoek: (z: string) => void;
  zoekRef: React.RefObject<HTMLInputElement | null>;
  onKies: (id: string) => void;
  onNieuw: (naam: string) => void;
  onSleepStart: (id: string, e: React.PointerEvent) => void;
  actiefId: string | null;
  leegTekst: string;
}

function StudentLijst({ studenten, geplaatst, zoek, setZoek, zoekRef, onKies, onNieuw, onSleepStart, actiefId, leegTekst }: StudentLijstProps) {
  const gefilterd = useMemo(() => sorteerOpVoornaam(studenten).filter((s) => matchStudent(s, zoek)), [studenten, zoek]);
  const kanToevoegen = zoek.trim().length > 1 && gefilterd.length === 0;
  return (
    <div className="studentlijst">
      <input
        ref={zoekRef}
        className="zoekveld"
        placeholder="Typ om te zoeken… (Enter = eerste)"
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (gefilterd[0]) onKies(gefilterd[0].id);
            else if (kanToevoegen) onNieuw(zoek.trim());
          }
        }}
      />
      <ul>
        {gefilterd.map((s) => (
          <li key={s.id}>
            <button
              className={`student-rij ${actiefId === s.id ? "actief" : ""} ${geplaatst.has(s.id) ? "geplaatst" : ""}`}
              onPointerDown={(e) => onSleepStart(s.id, e)}
              onClick={() => onKies(s.id)}
              title="Sleep naar een tafel, of klik"
            >
              <span className="grip">⠿</span>
              <span className="voornaam">{s.voornaam}</span> <span className="achternaam">{s.achternaam}</span>
              {geplaatst.has(s.id) && <span className="klein op-tafel">op tafel</span>}
            </button>
          </li>
        ))}
      </ul>
      {gefilterd.length === 0 && !kanToevoegen && <p className="klein leeg">{leegTekst}</p>}
      {kanToevoegen && (
        <button className="knop" onClick={() => onNieuw(zoek.trim())}>
          ＋ “{zoek.trim()}” toevoegen als nieuwe student
        </button>
      )}
    </div>
  );
}

export function LesView({ lesId, onTerug }: { lesId: string; onTerug: () => void }) {
  const { lessen, klassen, updateLessen, updateKlassen, updateLokalen } = useStore();
  const { toast, bevestig } = useUi();
  const les = lessen.find((l) => l.id === lesId);
  const klas = klassen.find((k) => k.id === les?.klasId);

  const [selectie, setSelectie] = useState<Set<string>>(new Set());
  const [gekozenStudent, setGekozenStudent] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [toonGeplaatst, setToonGeplaatst] = useState(false);
  const [historie, setHistorie] = useState<Les[]>([]);
  const [lijstOpen, setLijstOpen] = useState(false);
  const [verbergNamen, setVerbergNamen] = useState(false);
  const [onthuld, setOnthuld] = useState<Set<string>>(new Set());
  const [capInput, setCapInput] = useState(les?.capaciteit ?? 24);
  const [lokaalNaam, setLokaalNaam] = useState("");
  const [lokaalOpen, setLokaalOpen] = useState(false);
  const [sleep, setSleep] = useState<SleepStatus | null>(null);
  const negeerKlik = useRef(false);
  const zoekRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<(studentId: string, van: string | null, doelTafel: string | null, doelLijst: boolean) => void>(() => {});

  /** Wijzigt de les en onthoudt de vorige toestand voor ongedaan maken. */
  const wijzig = useCallback(
    (fn: (l: Les) => Les) => {
      let vorige: Les | undefined;
      updateLessen((ls) =>
        ls.map((l) => {
          if (l.id !== lesId) return l;
          vorige = l;
          return fn(l);
        }),
      );
      if (vorige) {
        const snapshot = vorige;
        setHistorie((h) => [...h.slice(-49), snapshot]);
      }
    },
    [lesId, updateLessen],
  );

  const herstel = useCallback(() => {
    const laatste = historie[historie.length - 1];
    if (!laatste) return;
    setHistorie((h) => h.slice(0, -1));
    updateLessen((ls) => ls.map((l) => (l.id === lesId ? laatste : l)));
    // Selectie behouden voor zover die tafels na het terugdraaien nog bestaan
    setSelectie((huidig) => new Set([...huidig].filter((id) => laatste.tafels.some((t) => t.id === id))));
  }, [historie, lesId, updateLessen]);

  const bezetting = useMemo(() => {
    const m = new Map<string, Bezetting>();
    if (!les || !klas) return m;
    const perId = new Map(klas.studenten.map((s) => [s.id, s]));
    for (const p of les.plaatsingen) {
      const student = perId.get(p.studentId);
      if (student) m.set(p.tafelId, { student, laat: p.laat, tijd: p.tijd });
    }
    return m;
  }, [les, klas]);

  const draai = useCallback(
    (richting: 1 | -1) => {
      if (selectie.size === 0) return;
      wijzig((l) => {
        const gedraaid = draaiGroep(l.tafels.filter((t) => selectie.has(t.id)), richting, l.ruimte);
        const perId = new Map(gedraaid.map((t) => [t.id, t]));
        const tafels = l.tafels.map((t) => perId.get(t.id) ?? t);
        // Past de gedraaide groep niet meer in het lokaal, dan groeit het lokaal mee in plaats van tafels erbuiten te zetten.
        const b = bbox(tafels);
        return { ...l, tafels, ruimte: { breedte: Math.max(l.ruimte.breedte, b.x + b.w), hoogte: Math.max(l.ruimte.hoogte, b.y + b.h) } };
      });
    },
    [selectie, wijzig],
  );

  const verplaats = useCallback(
    (dx: number, dy: number) => {
      if (selectie.size === 0) return;
      wijzig((l) => {
        const sel = l.tafels.filter((t) => selectie.has(t.id));
        const b = bbox(sel);
        const ddx = Math.min(Math.max(dx, -b.x), l.ruimte.breedte - (b.x + b.w));
        const ddy = Math.min(Math.max(dy, -b.y), l.ruimte.hoogte - (b.y + b.h));
        return { ...l, tafels: l.tafels.map((t) => (selectie.has(t.id) ? { ...t, x: t.x + ddx, y: t.y + ddy } : t)) };
      });
    },
    [selectie, wijzig],
  );

  const verwijderGeselecteerd = useCallback(async () => {
    if (!les || selectie.size === 0) return;
    const metNaam = les.plaatsingen.filter((p) => selectie.has(p.tafelId)).length;
    if (metNaam > 0) {
      const ja = await bevestig({
        titel: "Tafels verwijderen?",
        tekst: `${metNaam} van de geselecteerde tafels heeft een student. Die student wordt losgekoppeld (en telt weer als afwezig).`,
        knop: "Verwijderen",
        gevaar: true,
      });
      if (!ja) return;
    }
    wijzig((l) => verwijderTafels(l, selectie));
    setSelectie(new Set());
  }, [les, selectie, bevestig, wijzig]);

  /**
   * Slepen van een student (uit de lijst of via de greep op een tafel). Eigen pointer-afhandeling in plaats van HTML5-drag&drop,
   * zodat lijst (HTML) en plattegrond (SVG) hetzelfde gedrag hebben en het ook in de desktop-app betrouwbaar werkt.
   */
  const startSleep = useCallback((studentId: string, vanTafelId: string | null, e: { clientX: number; clientY: number; button: number }) => {
    if (e.button !== 0) return;
    const begin = { x: e.clientX, y: e.clientY };
    let actief = false;
    const doelOp = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      return {
        doelTafel: el?.closest("[data-tafel-id]")?.getAttribute("data-tafel-id") ?? null,
        doelLijst: !!el?.closest("[data-drop='lijst']"),
      };
    };
    const stop = () => {
      window.removeEventListener("pointermove", beweeg);
      window.removeEventListener("pointerup", los);
      window.removeEventListener("pointercancel", annuleer);
      window.removeEventListener("keydown", toets, true);
      document.body.classList.remove("slepende");
    };
    const beweeg = (ev: PointerEvent) => {
      if (!actief) {
        if (Math.hypot(ev.clientX - begin.x, ev.clientY - begin.y) < 6) return;
        actief = true;
        document.body.classList.add("slepende");
      }
      setSleep({ studentId, vanTafelId, x: ev.clientX, y: ev.clientY, ...doelOp(ev.clientX, ev.clientY) });
    };
    const los = (ev: PointerEvent) => {
      stop();
      if (!actief) return;
      // Het 'click'-event dat direct na het loslaten volgt mag geen koppeling of selectie veroorzaken
      negeerKlik.current = true;
      window.setTimeout(() => (negeerKlik.current = false), 0);
      const d = doelOp(ev.clientX, ev.clientY);
      setSleep(null);
      dropRef.current(studentId, vanTafelId, d.doelTafel, d.doelLijst);
    };
    const annuleer = () => {
      stop();
      setSleep(null);
    };
    const toets = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        annuleer();
        negeerKlik.current = true;
        window.setTimeout(() => (negeerKlik.current = false), 0);
      }
    };
    window.addEventListener("pointermove", beweeg);
    window.addEventListener("pointerup", los);
    window.addEventListener("pointercancel", annuleer);
    window.addEventListener("keydown", toets, true);
  }, []);

  // Sneltoetsen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inVeld = !!el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
      if (document.querySelector(".modal-root .modal")) return;
      if (e.ctrlKey || e.metaKey) {
        if (inVeld) return;
        const k = e.key.toLowerCase();
        if (k === "z") {
          e.preventDefault();
          herstel();
        } else if (k === "a" && les) {
          e.preventDefault();
          setSelectie(new Set(les.tafels.map((t) => t.id)));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          draai(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          draai(1);
        }
        return;
      }
      if (e.key === "Escape") {
        if (inVeld) (el as HTMLElement).blur();
        setSelectie(new Set());
        setGekozenStudent(null);
        return;
      }
      if (inVeld || e.altKey) return;
      // Typ-om-te-zoeken: een letter of cijfer zonder ingedrukt veld gaat naar het zoekveld van de studentenlijst
      if (e.key.length === 1 && !verbergNamen && zoekRef.current) {
        e.preventDefault();
        setZoek((z) => z + e.key);
        zoekRef.current.focus();
        return;
      }
      if (selectie.size === 0) return;
      // De weergave is 180° gedraaid (bord onderaan): pijltjes volgen wat je op het scherm ziet.
      const stap = e.shiftKey ? 4 : 1;
      if (e.key === "ArrowLeft") verplaats(stap, 0);
      else if (e.key === "ArrowRight") verplaats(-stap, 0);
      else if (e.key === "ArrowUp") verplaats(0, stap);
      else if (e.key === "ArrowDown") verplaats(0, -stap);
      else if (e.key === "Delete" || e.key === "Backspace") void verwijderGeselecteerd();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectie, les, verbergNamen, herstel, verplaats, draai, verwijderGeselecteerd]);

  if (!les || !klas) {
    return (
      <div className="pagina">
        <p>Deze les of de bijbehorende klas bestaat niet meer.</p>
        <button className="knop" onClick={onTerug}>
          ← Terug naar lessen
        </button>
      </div>
    );
  }

  const rijen = berekenAanwezigheid(les, klas);
  const t = tel(rijen);
  const geplaatst = new Set(les.plaatsingen.map((p) => p.studentId));
  const nietGeplaatst = klas.studenten.filter((s) => !geplaatst.has(s.id));
  const enkeleTafelId = selectie.size === 1 ? [...selectie][0] : null;
  const enkeleBezetting = enkeleTafelId ? bezetting.get(enkeleTafelId) : undefined;
  const gekozenStudentObj = klas.studenten.find((s) => s.id === gekozenStudent);
  const geselecteerdeTafels = les.tafels.filter((x) => selectie.has(x.id));
  const sleepStudent = sleep ? klas.studenten.find((s) => s.id === sleep.studentId) : undefined;

  /** Koppelt (of verhuist/wisselt) een student en start zo nodig automatisch de les. */
  const plaatsStudent = (studentId: string, tafelId: string) => {
    if (les.status === "voorbereiding") toast(`Les gestart om ${klokTijd(new Date().toISOString())}`, "info");
    wijzig((l) => zetStudentOpTafel(l.status === "voorbereiding" ? startLes(l) : l, studentId, tafelId));
    setSelectie(new Set());
    setGekozenStudent(null);
    setZoek("");
  };

  dropRef.current = (studentId, van, doelTafel, doelLijst) => {
    if (doelTafel && les.tafels.some((x) => x.id === doelTafel)) plaatsStudent(studentId, doelTafel);
    else if (doelLijst && van) wijzig((l) => losStudent(l, studentId));
  };

  const kiesStudent = (studentId: string) => {
    if (negeerKlik.current) return;
    if (enkeleTafelId) {
      plaatsStudent(studentId, enkeleTafelId);
      return;
    }
    setGekozenStudent((huidig) => (huidig === studentId ? null : studentId));
  };

  const voegStudentToe = (naam: string) => {
    const { voornaam, achternaam } = splitsNaam(naam);
    const s: Student = { id: nieuwId(), voornaam, achternaam };
    updateKlassen((ks) => ks.map((k) => (k.id === klas.id ? { ...k, studenten: [...k.studenten, s], bijgewerkt: new Date().toISOString() } : k)));
    if (enkeleTafelId) plaatsStudent(s.id, enkeleTafelId);
    else setZoek("");
    toast(`${volledigeNaam(s)} toegevoegd aan ${klas.naam}`, "ok");
  };

  const bijTafelKlik = (id: string) => {
    if (negeerKlik.current) return;
    if (verbergNamen) {
      setOnthuld((o) => {
        const n = new Set(o);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      return;
    }
    if (gekozenStudent) plaatsStudent(gekozenStudent, id);
  };

  const bijSelecteer = (ids: Set<string>) => {
    // Focus uit het zoekveld halen, zodat sneltoetsen (pijltjes, Delete) weer op de tafels werken
    if (document.activeElement instanceof HTMLElement && document.activeElement.closest(".zijbalk")) document.activeElement.blur();
    setSelectie(ids);
  };

  const start = () => wijzig((l) => startLes(l));

  const pasStandaardToe = async () => {
    const n = Math.max(1, Math.min(200, Math.round(capInput) || 1));
    if (les.plaatsingen.length > 0) {
      const ja = await bevestig({
        titel: "Nieuwe standaardindeling?",
        tekst: "Alle tafels worden vervangen door de standaardindeling en de gekoppelde namen worden losgemaakt.",
        knop: "Vervangen",
        gevaar: true,
      });
      if (!ja) return;
    } else if (les.tafels.length > 0) {
      const ja = await bevestig({ titel: "Nieuwe standaardindeling?", tekst: "Je huidige tafelindeling wordt vervangen. Met Ongedaan maken kun je terug.", knop: "Vervangen" });
      if (!ja) return;
    }
    const s = standaardIndeling(n);
    wijzig((l) => ({ ...l, capaciteit: n, tafels: s.tafels, ruimte: s.ruimte, plaatsingen: [] }));
    setCapInput(n);
    setSelectie(new Set());
  };

  const voegTafelToe = () => {
    const plek = vrijePlek(les.tafels, les.ruimte);
    const nieuw: Tafel = { id: nieuwId(), x: plek.x, y: plek.y, rot: 0 };
    wijzig((l) => ({ ...l, tafels: [...l.tafels, klemTafel(nieuw, l.ruimte)] }));
    setSelectie(new Set([nieuw.id]));
  };

  const uitlijnen = (as: "x" | "y") => {
    if (geselecteerdeTafels.length < 2) return;
    // Op het scherm links/boven = in de data de rechter-/onderrand (weergave is 180° gedraaid).
    const maat = (x: Tafel) => (as === "x" ? afmeting(x).w : afmeting(x).h);
    const rand = Math.max(...geselecteerdeTafels.map((x) => x[as] + maat(x)));
    wijzig((l) => ({ ...l, tafels: l.tafels.map((x) => (selectie.has(x.id) ? { ...x, [as]: rand - maat(x) } : x)) }));
  };

  const pasRuimteAan = (dB: number, dH: number) => {
    wijzig((l) => {
      const b = bbox(l.tafels.length ? l.tafels : [{ id: "", x: 0, y: 0, rot: 0 }]);
      return {
        ...l,
        ruimte: {
          breedte: Math.max(b.x + b.w, 8, l.ruimte.breedte + dB),
          hoogte: Math.max(b.y + b.h, 8, l.ruimte.hoogte + dH),
        },
      };
    });
  };

  const bewaarLokaal = () => {
    const naam = lokaalNaam.trim();
    if (!naam) return;
    updateLokalen((ls) => [...ls, { id: nieuwId(), naam, capaciteit: les.tafels.length, ruimte: { ...les.ruimte }, tafels: kopieerTafels(les.tafels) }]);
    setLokaalNaam("");
    toast(`Indeling bewaard als "${naam}" - kies hem bij een nieuwe les`, "ok");
  };

  const rondAf = () => wijzig((l) => ({ ...l, status: "afgerond" }));
  const heropen = () => wijzig((l) => ({ ...l, status: "bezig" }));

  const tekort = les.tafels.length < klas.studenten.length ? `Let op: ${klas.studenten.length} studenten maar ${les.tafels.length} tafels.` : "";
  const lijstDropActief = !!sleep?.vanTafelId && sleep.doelLijst;

  return (
    <div className="les-scherm">
      <div className="les-kop">
        <button className="knop" onClick={onTerug}>
          ← Lessen
        </button>
        <div className="les-titel-blok">
          <input
            key={les.titel}
            className="titel-input"
            defaultValue={les.titel}
            placeholder="Titel van de les"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== les.titel) updateLessen((ls) => ls.map((l) => (l.id === lesId ? { ...l, titel: v } : l)));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <div className="klein">
            {klas.naam} · {datumNl(les.datum)}
          </div>
        </div>

        <button className="knop" onClick={herstel} disabled={historie.length === 0} title="Ongedaan maken (Ctrl+Z)">
          ↶ Ongedaan
        </button>
        <button className="knop primair" onClick={() => setLijstOpen(true)}>
          Aanwezigheidslijst
        </button>
      </div>

      <div className="les-body">
        <div className="canvas-kolom">
          {verbergNamen && <div className="banner info">Oefenmodus: namen zijn verborgen. Klik op een tafel om de naam te tonen of weer te verbergen.</div>}
          {gekozenStudentObj && (
            <div className="banner actie">
              Klik nu op een tafel voor <strong>{volledigeNaam(gekozenStudentObj)}</strong>
              <button className="knop klein" onClick={() => setGekozenStudent(null)}>
                Annuleren
              </button>
            </div>
          )}
          <div className="gereedschap">
            <button className="knop" onClick={voegTafelToe}>
              ＋ Tafel
            </button>
            <button className="knop" onClick={() => setSelectie(new Set(les.tafels.map((x) => x.id)))}>
              Alles selecteren
            </button>
            <span className="scheiding" />
            <button className="knop" disabled={selectie.size === 0} onClick={() => draai(-1)} title="Kwartslag linksom (Ctrl+←)">
              ↺ Links
            </button>
            <button className="knop" disabled={selectie.size === 0} onClick={() => draai(1)} title="Kwartslag rechtsom (Ctrl+→)">
              ↻ Rechts
            </button>
            <button className="knop" disabled={selectie.size < 2} onClick={() => uitlijnen("x")}>
              Links uitlijnen
            </button>
            <button className="knop" disabled={selectie.size < 2} onClick={() => uitlijnen("y")}>
              Boven uitlijnen
            </button>
            <button className="knop gevaar" disabled={selectie.size === 0} onClick={() => void verwijderGeselecteerd()}>
              Verwijder
            </button>
          </div>
          <div className={`selectie-strook ${enkeleBezetting ? (enkeleBezetting.laat ? "laat" : "aanvang") : ""}`}>
            {enkeleBezetting && enkeleTafelId ? (
              <>
                <strong>{volledigeNaam(enkeleBezetting.student)}</strong>
                <span className="klein">
                  {enkeleBezetting.laat ? "later binnengekomen" : "aanwezig bij aanvang"} · {klokTijd(enkeleBezetting.tijd)}
                </span>
                <button className="knop klein" onClick={() => wijzig((l) => zetLaat(l, enkeleTafelId, !enkeleBezetting.laat))}>
                  Markeer als {enkeleBezetting.laat ? "bij aanvang" : "later"}
                </button>
                <button
                  className="knop klein"
                  onClick={() => {
                    wijzig((l) => verwijderPlaatsing(l, enkeleTafelId));
                    setSelectie(new Set());
                  }}
                >
                  Losmaken
                </button>
              </>
            ) : (
              <span className="klein">
                {selectie.size === 0 ? "Sleep tafels om ze te verplaatsen; klik of trek een kader om te selecteren." : `${selectie.size} ${selectie.size === 1 ? "tafel" : "tafels"} geselecteerd`}
              </span>
            )}
          </div>
          <div className={`canvas-wrap ${gekozenStudent ? "kiest-tafel" : ""}`}>
            <RoomCanvas
              tafels={les.tafels}
              ruimte={les.ruimte}
              bezetting={bezetting}
              geselecteerd={selectie}
              verbergNamen={verbergNamen}
              onthuld={onthuld}
              dropTafelId={sleep?.doelTafel ?? null}
              studentSleept={!!sleep}
              onSelecteer={bijSelecteer}
              onWijzig={(tafels) => wijzig((l) => ({ ...l, tafels }))}
              onTafelKlik={bijTafelKlik}
              onStudentSleepStart={(studentId, tafelId, e) => startSleep(studentId, tafelId, e)}
            />
          </div>
          <div className="legenda">
            <span>
              <i className="blokje leeg" /> Vrij
            </span>
            <span>
              <i className="blokje aanvang" /> Aanwezig bij aanvang
            </span>
            <span>
              <i className="blokje laat" /> Later binnengekomen
            </span>
            <span className="legenda-stoel">
              <i className="blokje stoel" /> Stoel (kijkt naar het bord)
            </span>
            <span>⠿ Greep: sleep de naam naar een andere tafel</span>
          </div>
        </div>

        <aside className="zijbalk">
          <section className="status-kaart">
            <div className="teller-rij">
              <div>
                <div className="groot-getal">
                  {t.aanwezig}
                  <span className="van">/{t.totaal}</span>
                </div>
                <div className="klein">aanwezig{t.later > 0 ? ` · ${t.later} later` : ""}</div>
              </div>
              <div className="klein rechts">
                {les.status === "voorbereiding" ? "Nog niet gestart" : les.status === "afgerond" ? "Afgerond" : `Gestart ${klokTijd(les.startTijd)}`}
              </div>
            </div>
            {tekort && <p className="waarschuwing">{tekort}</p>}
            {les.status === "voorbereiding" && (
              <>
                <p className="klein">De les start vanzelf bij de eerste naam die je koppelt, of start hem zelf.</p>
                <button className="knop primair breed" onClick={start}>
                  ▶ Start les
                </button>
              </>
            )}
            {les.status === "bezig" &&
              (les.aanvangAfgesloten ? (
                <div className="fase laat">
                  <strong>Aanvang afgesloten om {klokTijd(les.aanvangAfgesloten)}.</strong> Nieuwe studenten tellen als ‘later binnengekomen’.
                  <button className="knop klein" onClick={() => wijzig((l) => heropenAanvang(l))}>
                    Heropenen
                  </button>
                </div>
              ) : (
                <div className="fase aanvang">
                  <strong>Bij aanvang:</strong> wie je nu koppelt, telt als aanwezig bij aanvang.
                  <button className="knop" onClick={() => wijzig((l) => sluitAanvang(l))}>
                    Aanvang afsluiten
                  </button>
                </div>
              ))}
            <div className="knoppenrij">
              <button
                className={`knop ${verbergNamen ? "actief" : ""}`}
                onClick={() => {
                  setVerbergNamen((v) => !v);
                  setOnthuld(new Set());
                  setSelectie(new Set());
                  setGekozenStudent(null);
                }}
                title="Verberg de namen en test jezelf"
              >
                🎓 Namen oefenen
              </button>
              {les.status === "bezig" && (
                <button className="knop" onClick={rondAf}>
                  Les afronden
                </button>
              )}
              {les.status === "afgerond" && (
                <button className="knop" onClick={heropen}>
                  Heropenen
                </button>
              )}
            </div>
          </section>

          <section className={`studenten-paneel ${lijstDropActief ? "drop-actief" : ""}`} data-drop="lijst">
            {verbergNamen ? (
              <p className="klein">Oefenmodus aan: de studentenlijst is verborgen.</p>
            ) : (
              <>
                <div className="paneel-kop">
                  <h3>Zonder tafel ({nietGeplaatst.length})</h3>
                  <label className="vinkje klein">
                    <input type="checkbox" checked={toonGeplaatst} onChange={(e) => setToonGeplaatst(e.target.checked)} /> ook op tafel
                  </label>
                </div>
                <p className="klein">Sleep een naam naar een tafel, of klik een tafel en typ een naam.</p>
                {lijstDropActief && <div className="drop-hint">Laat los om deze student los te koppelen</div>}
                <StudentLijst
                  studenten={toonGeplaatst ? klas.studenten : nietGeplaatst}
                  geplaatst={geplaatst}
                  zoek={zoek}
                  setZoek={setZoek}
                  zoekRef={zoekRef}
                  onKies={kiesStudent}
                  onNieuw={voegStudentToe}
                  onSleepStart={(id, e) => startSleep(id, null, e)}
                  actiefId={gekozenStudent}
                  leegTekst={toonGeplaatst ? "Geen student gevonden." : "Iedereen heeft een tafel."}
                />
              </>
            )}
          </section>

          <details className="inklap" open={lokaalOpen} onToggle={(e) => setLokaalOpen(e.currentTarget.open)}>
            <summary>Lokaal en standaardindeling</summary>
            <div className="chips">
              {PRESETS.map((p) => (
                <button key={p} className={`chip ${capInput === p ? "actief" : ""}`} onClick={() => setCapInput(p)}>
                  {p}
                </button>
              ))}
              <label className="chip-getal">
                anders:
                <input type="number" min={1} max={200} value={capInput} onChange={(e) => setCapInput(Number(e.target.value))} />
              </label>
            </div>
            <button className="knop breed" onClick={pasStandaardToe}>
              Standaardindeling maken voor {Math.max(1, Math.round(capInput) || 1)}
            </button>
            <p className="klein">Nu: {les.tafels.length} tafels. Blokken van 2 tafels breed, rijen achter elkaar.</p>
            <div className="stepper-rij">
              <span>Breedte {les.ruimte.breedte}</span>
              <button className="knop icoon" onClick={() => pasRuimteAan(-2, 0)}>
                −
              </button>
              <button className="knop icoon" onClick={() => pasRuimteAan(2, 0)}>
                ＋
              </button>
              <span>Diepte {les.ruimte.hoogte}</span>
              <button className="knop icoon" onClick={() => pasRuimteAan(0, -2)}>
                −
              </button>
              <button className="knop icoon" onClick={() => pasRuimteAan(0, 2)}>
                ＋
              </button>
            </div>
            <div className="inline-formulier">
              <input value={lokaalNaam} onChange={(e) => setLokaalNaam(e.target.value)} placeholder="Naam, bv. A2.31" onKeyDown={(e) => e.key === "Enter" && bewaarLokaal()} />
              <button className="knop" disabled={!lokaalNaam.trim()} onClick={bewaarLokaal}>
                Bewaar indeling
              </button>
            </div>
          </details>

          <details className="inklap sneltoetsen">
            <summary>Sneltoetsen</summary>
            <p className="klein">
              Typ een naam om te zoeken · <kbd>Enter</kbd> koppelt de eerste treffer aan de geselecteerde tafel · <kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd> draaien · pijltjes verplaatsen (
              <kbd>Shift</kbd> = 4 cellen) · <kbd>Del</kbd> verwijdert · <kbd>Ctrl</kbd>+<kbd>Z</kbd> ongedaan · <kbd>Ctrl</kbd>+<kbd>A</kbd> alles · <kbd>Esc</kbd> leegmaken
            </p>
          </details>
        </aside>
      </div>

      {sleep && sleepStudent && (
        <div className="sleep-spook" style={{ left: sleep.x + 14, top: sleep.y + 14 }}>
          {volledigeNaam(sleepStudent)}
        </div>
      )}

      {lijstOpen && <AanwezigheidDialog les={les} klas={klas} onSluit={() => setLijstOpen(false)} />}
    </div>
  );
}

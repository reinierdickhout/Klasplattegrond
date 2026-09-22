import { useMemo, useRef, useState } from "react";
import type { Klas } from "../types.ts";
import { bouwStudenten, leesBestand, lijktOpKoprij, parseCsv, raadKoppeling, voegSamen, type Bestandsinhoud, type Koppeling } from "../import.ts";
import { nieuwId, volledigeNaam } from "../names.ts";
import { useStore } from "../store.tsx";
import { Modal, useUi } from "./ui.tsx";

interface Props {
  klassen: Klas[];
  voorgekozenKlasId?: string;
  onSluit: () => void;
  onKlaar: (klasId: string) => void;
}

const kolomLetter = (i: number) => String.fromCharCode(65 + (i % 26));

export function ImportDialog({ klassen, voorgekozenKlasId, onSluit, onKlaar }: Props) {
  const { updateKlassen } = useStore();
  const { toast } = useUi();
  const bestandRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [bron, setBron] = useState<"bestand" | "plakken">("bestand");
  const [inhoud, setInhoud] = useState<Bestandsinhoud | null>(null);
  const [bestandsnaam, setBestandsnaam] = useState("");
  const [plakTekst, setPlakTekst] = useState("");
  const [heeftKop, setHeeftKop] = useState(true);
  const [koppeling, setKoppeling] = useState<Koppeling | null>(null);
  const [doel, setDoel] = useState<string>(voorgekozenKlasId ?? "nieuw");
  const [klasNaam, setKlasNaam] = useState("");
  const [fout, setFout] = useState("");
  const [sleepOver, setSleepOver] = useState(false);

  const rijen = useMemo(() => (bron === "plakken" ? parseCsv(plakTekst) : (inhoud?.rijen ?? [])), [bron, plakTekst, inhoud]);
  const kolomAantal = rijen.reduce((m, r) => Math.max(m, r.length), 0);
  const kolomNamen = Array.from({ length: kolomAantal }, (_, i) => (heeftKop && rijen[0]?.[i]) || `Kolom ${kolomLetter(i)}`);
  const datarijen = heeftKop ? rijen.slice(1) : rijen;

  const resultaat = useMemo(() => (koppeling ? bouwStudenten(datarijen, koppeling) : null), [datarijen, koppeling]);

  const herkenKolommen = (nieuweRijen: string[][], kop: boolean) => {
    setKoppeling(nieuweRijen.length ? raadKoppeling(nieuweRijen[0] ?? [], kop, nieuweRijen.reduce((m, r) => Math.max(m, r.length), 0)) : null);
  };

  const laadBestand = async (bestand: File, blad?: string) => {
    setFout("");
    try {
      const gelezen = await leesBestand(bestand, blad);
      bestandRef.current = bestand;
      setInhoud(gelezen);
      setBestandsnaam(bestand.name);
      const kop = gelezen.rijen.length > 0 && lijktOpKoprij(gelezen.rijen[0]);
      setHeeftKop(kop);
      herkenKolommen(gelezen.rijen, kop);
      if (!klasNaam) setKlasNaam(bestand.name.replace(/\.[^.]+$/, ""));
      if (gelezen.rijen.length === 0) setFout("Dit bestand bevat geen gegevens.");
    } catch (e) {
      setInhoud(null);
      setKoppeling(null);
      setFout(e instanceof Error ? e.message : String(e));
    }
  };

  const bijPlakken = (tekst: string) => {
    setPlakTekst(tekst);
    const r = parseCsv(tekst);
    const kop = r.length > 0 && lijktOpKoprij(r[0]);
    setHeeftKop(kop);
    herkenKolommen(r, kop);
  };

  const zetKop = (kop: boolean) => {
    setHeeftKop(kop);
    herkenKolommen(rijen, kop);
  };

  const zetKolom = (veld: keyof Omit<Koppeling, "modus">, waarde: string) => setKoppeling((k) => (k ? { ...k, [veld]: Number(waarde) } : k));

  const kanImporteren = !!resultaat && resultaat.studenten.length > 0 && (doel !== "nieuw" || klasNaam.trim() !== "");

  const importeer = () => {
    if (!resultaat) return;
    if (doel === "nieuw") {
      const klas: Klas = {
        id: nieuwId(),
        naam: klasNaam.trim(),
        studenten: resultaat.studenten.map((s) => ({ id: nieuwId(), ...s })),
        bijgewerkt: new Date().toISOString(),
      };
      updateKlassen((l) => [...l, klas]);
      toast(`${klas.studenten.length} studenten geïmporteerd in "${klas.naam}"`, "ok");
      onKlaar(klas.id);
    } else {
      const bestaand = klassen.find((k) => k.id === doel);
      if (!bestaand) return;
      const samen = voegSamen(bestaand.studenten, resultaat.studenten);
      updateKlassen((l) => l.map((k) => (k.id === doel ? { ...k, studenten: samen.studenten, bijgewerkt: new Date().toISOString() } : k)));
      toast(`${samen.toegevoegd} toegevoegd, ${samen.bijgewerkt} bijgewerkt in "${bestaand.naam}"`, "ok");
      onKlaar(doel);
    }
  };

  const kiesSelect = (waarde: number, veld: keyof Omit<Koppeling, "modus">, optioneel: boolean) => (
    <select value={waarde} onChange={(e) => zetKolom(veld, e.target.value)}>
      {optioneel && <option value={-1}>— geen —</option>}
      {kolomNamen.map((n, i) => (
        <option key={i} value={i}>
          {n}
        </option>
      ))}
    </select>
  );

  return (
    <Modal
      titel="Studenten importeren"
      onSluit={onSluit}
      breed
      voet={
        <>
          <span className="voet-tekst">{resultaat ? `${resultaat.studenten.length} studenten klaar om te importeren` : ""}</span>
          <button className="knop" onClick={onSluit}>
            Annuleren
          </button>
          <button className="knop primair" disabled={!kanImporteren} onClick={importeer}>
            Importeren
          </button>
        </>
      }
    >
      <p className="privacy-notitie">
        🔒 Het bestand wordt alleen in deze app gelezen en lokaal als JSON opgeslagen. Er wordt niets verstuurd of gedeeld.
      </p>

      <div className="tabs">
        <button className={`tab ${bron === "bestand" ? "actief" : ""}`} onClick={() => setBron("bestand")}>
          Excel- of CSV-bestand
        </button>
        <button className={`tab ${bron === "plakken" ? "actief" : ""}`} onClick={() => setBron("plakken")}>
          Namen plakken
        </button>
      </div>

      {bron === "bestand" ? (
        <div
          className={`dropzone ${sleepOver ? "over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setSleepOver(true);
          }}
          onDragLeave={() => setSleepOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSleepOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void laadBestand(f);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,.txt,.tsv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void laadBestand(f);
              e.target.value = "";
            }}
          />
          <button className="knop primair" onClick={() => inputRef.current?.click()}>
            Bestand kiezen…
          </button>
          <span className="dropzone-tekst">{bestandsnaam ? `📄 ${bestandsnaam}` : "of sleep een .xlsx / .csv hierheen"}</span>
          {inhoud && inhoud.bladen.length > 1 && (
            <label className="veld-inline">
              Werkblad
              <select value={inhoud.blad} onChange={(e) => bestandRef.current && void laadBestand(bestandRef.current, e.target.value)}>
                {inhoud.bladen.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      ) : (
        <textarea
          className="plakveld"
          rows={7}
          placeholder={"Plak hier namen, één per regel.\nBijvoorbeeld:  Anna de Vries   of   de Vries, Anna\nOf rechtstreeks gekopieerd uit Excel (kolommen worden herkend)."}
          value={plakTekst}
          onChange={(e) => bijPlakken(e.target.value)}
        />
      )}

      {fout && <p className="foutmelding">{fout}</p>}

      {koppeling && rijen.length > 0 && (
        <>
          <h3>Welke kolommen zijn wat?</h3>
          <label className="vinkje">
            <input type="checkbox" checked={heeftKop} onChange={(e) => zetKop(e.target.checked)} /> De eerste rij bevat kolomkoppen
          </label>
          <div className="koppeling-rooster">
            <label>
              Namen staan in
              <select value={koppeling.modus} onChange={(e) => setKoppeling({ ...koppeling, modus: e.target.value as Koppeling["modus"] })}>
                <option value="gesplitst">aparte kolommen (voor-/achternaam)</option>
                <option value="volledig">één kolom (volledige naam)</option>
              </select>
            </label>
            {koppeling.modus === "gesplitst" ? (
              <>
                <label>Voornaam {kiesSelect(koppeling.voornaam, "voornaam", false)}</label>
                <label>Tussenvoegsel {kiesSelect(koppeling.tussenvoegsel, "tussenvoegsel", true)}</label>
                <label>Achternaam {kiesSelect(koppeling.achternaam, "achternaam", false)}</label>
              </>
            ) : (
              <label>Volledige naam {kiesSelect(Math.max(koppeling.volledig, 0), "volledig", false)}</label>
            )}
            <label>Studentnummer (optioneel) {kiesSelect(koppeling.nummer, "nummer", true)}</label>
          </div>

          {resultaat && (
            <>
              <h3>Voorbeeld</h3>
              <table className="voorbeeld">
                <thead>
                  <tr>
                    <th>Voornaam</th>
                    <th>Achternaam</th>
                    <th>Nummer</th>
                  </tr>
                </thead>
                <tbody>
                  {resultaat.studenten.slice(0, 6).map((s, i) => (
                    <tr key={i}>
                      <td>{s.voornaam}</td>
                      <td>{s.achternaam}</td>
                      <td>{s.nummer ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="klein">
                {resultaat.studenten.length} studenten gevonden
                {resultaat.overgeslagen > 0 && `, ${resultaat.overgeslagen} lege rijen overgeslagen`}
                {resultaat.dubbel > 0 && `, ${resultaat.dubbel} dubbele overgeslagen`}.
                {resultaat.studenten[0] && ` Eerste: ${volledigeNaam(resultaat.studenten[0])}.`}
              </p>
            </>
          )}

          <h3>Waar naartoe?</h3>
          <div className="koppeling-rooster">
            <label>
              Doelklas
              <select value={doel} onChange={(e) => setDoel(e.target.value)}>
                <option value="nieuw">＋ Nieuwe klas</option>
                {klassen.map((k) => (
                  <option key={k.id} value={k.id}>
                    Bestaande klas bijwerken: {k.naam}
                  </option>
                ))}
              </select>
            </label>
            {doel === "nieuw" && (
              <label>
                Naam van de klas
                <input value={klasNaam} onChange={(e) => setKlasNaam(e.target.value)} placeholder="bv. ICT1A" />
              </label>
            )}
          </div>
          {doel !== "nieuw" && <p className="klein">Bij bijwerken worden nieuwe studenten toegevoegd en bestaande herkend (op studentnummer, anders op naam). Niemand wordt verwijderd.</p>}
        </>
      )}
    </Modal>
  );
}

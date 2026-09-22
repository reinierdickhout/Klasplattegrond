import { useState } from "react";
import type { Les } from "../types.ts";
import { kopieerTafels, standaardIndeling } from "../layout.ts";
import { nieuwId } from "../names.ts";
import { useStore } from "../store.tsx";
import { datumNl } from "../lesActies.ts";
import { Modal } from "./ui.tsx";

export const PRESETS = [18, 24, 32, 48];

export function vandaag(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  onSluit: () => void;
  onAangemaakt: (lesId: string) => void;
  onNaarKlassen: () => void;
}

export function NieuweLesDialog({ onSluit, onAangemaakt, onNaarKlassen }: Props) {
  const { klassen, lessen, lokalen, updateLessen } = useStore();
  const [klasId, setKlasId] = useState(klassen[0]?.id ?? "");
  const klas = klassen.find((k) => k.id === klasId);
  const [titel, setTitel] = useState("");
  const [datum, setDatum] = useState(vandaag());
  const [handmatig, setHandmatig] = useState<number | null>(null);
  const [indeling, setIndeling] = useState("standaard");

  const grootte = klas?.studenten.length ?? 0;
  const voorstel = grootte > 0 ? (PRESETS.find((p) => p >= grootte) ?? grootte) : 24;
  const capaciteitInput = handmatig ?? voorstel;

  const bron = indeling.startsWith("lokaal:")
    ? lokalen.find((l) => l.id === indeling.slice(7))
    : indeling.startsWith("les:")
      ? lessen.find((l) => l.id === indeling.slice(4))
      : undefined;
  const capaciteit = bron ? bron.capaciteit : Math.max(1, Math.min(200, Math.round(capaciteitInput) || 1));
  const tekort = grootte > capaciteit;

  const maak = () => {
    if (!klas) return;
    let tafels, ruimte;
    if (bron) {
      tafels = kopieerTafels(bron.tafels);
      ruimte = { ...bron.ruimte };
    } else {
      const s = standaardIndeling(capaciteit);
      tafels = s.tafels;
      ruimte = s.ruimte;
    }
    const les: Les = {
      id: nieuwId(),
      titel: titel.trim(),
      datum,
      klasId: klas.id,
      capaciteit,
      ruimte,
      tafels,
      plaatsingen: [],
      status: "voorbereiding",
      aangemaakt: new Date().toISOString(),
    };
    updateLessen((l) => [...l, les]);
    onAangemaakt(les.id);
  };

  const eerdereLessen = lessen.filter((l) => l.klasId === klasId).sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 8);

  return (
    <Modal
      titel="Nieuwe les"
      onSluit={onSluit}
      voet={
        <>
          <button className="knop" onClick={onSluit}>
            Annuleren
          </button>
          <button className="knop primair" disabled={!klas} onClick={maak}>
            Les aanmaken
          </button>
        </>
      }
    >
      {klassen.length === 0 ? (
        <div className="leeg-blok">
          <p>Je hebt nog geen klas. Importeer eerst een studentenlijst (of maak de fictieve voorbeeldklas aan om de app uit te proberen).</p>
          <button className="knop primair" onClick={onNaarKlassen}>
            Naar Klassen
          </button>
        </div>
      ) : (
        <div className="formulier">
          <label>
            Klas
            <select value={klasId} onChange={(e) => setKlasId(e.target.value)}>
              {klassen.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.naam} ({k.studenten.length} studenten)
                </option>
              ))}
            </select>
          </label>
          <label>
            Titel van de les <span className="optioneel">(optioneel)</span>
            <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="bv. Les 3 – Databases" autoFocus />
          </label>
          <label>
            Datum
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            <span className="klein">{datum && datumNl(datum)}</span>
          </label>

          <div className="veldgroep">
            <span className="veldlabel">Lokaalgrootte (aantal tafels)</span>
            <div className="chips">
              {PRESETS.map((p) => (
                <button key={p} className={`chip ${!bron && capaciteit === p ? "actief" : ""}`} disabled={!!bron} onClick={() => setHandmatig(p)}>
                  {p}
                </button>
              ))}
              <label className="chip-getal">
                anders:
                <input type="number" min={1} max={200} disabled={!!bron} value={bron ? bron.capaciteit : capaciteitInput} onChange={(e) => setHandmatig(Number(e.target.value))} />
              </label>
            </div>
            {tekort && <p className="waarschuwing">Let op: de klas heeft {grootte} studenten, maar er zijn maar {capaciteit} tafels.</p>}
          </div>

          <label>
            Tafelindeling
            <select value={indeling} onChange={(e) => setIndeling(e.target.value)}>
              <option value="standaard">Standaardindeling voor {capaciteitInput} personen (blokken van 2 breed)</option>
              {lokalen.length > 0 && (
                <optgroup label="Bewaarde lokaalindelingen">
                  {lokalen.map((l) => (
                    <option key={l.id} value={`lokaal:${l.id}`}>
                      {l.naam} ({l.capaciteit})
                    </option>
                  ))}
                </optgroup>
              )}
              {eerdereLessen.length > 0 && (
                <optgroup label="Indeling van een eerdere les (zonder namen)">
                  {eerdereLessen.map((l) => (
                    <option key={l.id} value={`les:${l.id}`}>
                      {l.datum} {l.titel && `– ${l.titel}`} ({l.capaciteit})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        </div>
      )}
    </Modal>
  );
}

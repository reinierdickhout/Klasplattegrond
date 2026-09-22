import { useMemo } from "react";
import type { Klas, Les } from "../types.ts";
import { volledigeNaam } from "../names.ts";
import { berekenAanwezigheid, datumNl, klokTijd, maakCsv, maakTsv, STATUS_TEKST, tel } from "../lesActies.ts";
import { exporteerTekst } from "../storage.ts";
import { Modal, useUi } from "./ui.tsx";

interface Props {
  les: Les;
  klas: Klas;
  onSluit: () => void;
}

export function AanwezigheidDialog({ les, klas, onSluit }: Props) {
  const { toast } = useUi();
  const rijen = useMemo(() => berekenAanwezigheid(les, klas), [les, klas]);
  const t = tel(rijen);

  const exporteer = async () => {
    try {
      const ok = await exporteerTekst(`aanwezigheid ${klas.naam} ${les.datum}.csv`, maakCsv(les, klas, rijen), "csv");
      if (ok) toast("Aanwezigheidslijst opgeslagen als CSV (opent in Excel)", "ok");
    } catch (e) {
      toast(`Exporteren mislukt: ${String(e)}`, "fout");
    }
  };

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(maakTsv(rijen));
      toast("Gekopieerd - plak het in Excel", "ok");
    } catch {
      toast("Kopiëren naar het klembord is niet gelukt", "fout");
    }
  };

  return (
    <Modal
      titel="Aanwezigheidslijst"
      onSluit={onSluit}
      breed
      voet={
        <>
          <button className="knop" onClick={kopieer}>
            Kopieer voor Excel
          </button>
          <button className="knop" onClick={exporteer}>
            Opslaan als CSV
          </button>
          <button className="knop primair" onClick={() => window.print()}>
            Afdrukken / PDF
          </button>
        </>
      }
    >
      <div className="aanw-kop">
        <div>
          <strong>{les.titel || "Les"}</strong> · {klas.naam}
          <div className="klein">
            {datumNl(les.datum)}
            {les.startTijd && ` · gestart om ${klokTijd(les.startTijd)}`}
          </div>
        </div>
        <div className="aanw-tellers">
          <span className="pil aanvang">{t.aanvang} bij aanvang</span>
          <span className="pil later">{t.later} later</span>
          <span className="pil afwezig">{t.afwezig} afwezig</span>
        </div>
      </div>
      <table className="aanw-tabel">
        <thead>
          <tr>
            <th>#</th>
            <th>Naam</th>
            <th>Nummer</th>
            <th>Status</th>
            <th>Binnen</th>
          </tr>
        </thead>
        <tbody>
          {rijen.map((r, i) => (
            <tr key={r.student.id} className={r.status}>
              <td className="num">{i + 1}</td>
              <td>{volledigeNaam(r.student)}</td>
              <td>{r.student.nummer ?? ""}</td>
              <td>
                <span className={`pil ${r.status}`}>{STATUS_TEKST[r.status]}</span>
              </td>
              <td>{klokTijd(r.tijd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

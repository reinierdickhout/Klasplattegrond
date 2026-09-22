import { useMemo, useState } from "react";
import { useStore } from "../store.tsx";
import { berekenAanwezigheid, datumNl, tel } from "../lesActies.ts";
import { NieuweLesDialog } from "../components/NieuweLesDialog.tsx";
import { useUi } from "../components/ui.tsx";

interface Props {
  onOpen: (lesId: string) => void;
  onNaarKlassen: () => void;
}

const STATUS_LABEL = { voorbereiding: "Voorbereiding", bezig: "Bezig", afgerond: "Afgerond" } as const;

export function LessenView({ onOpen, onNaarKlassen }: Props) {
  const { lessen, klassen, updateLessen } = useStore();
  const { bevestig, toast } = useUi();
  const [nieuwOpen, setNieuwOpen] = useState(false);

  const gesorteerd = useMemo(() => {
    const rang = { bezig: 0, voorbereiding: 1, afgerond: 2 } as const;
    return [...lessen].sort((a, b) => rang[a.status] - rang[b.status] || b.datum.localeCompare(a.datum) || b.aangemaakt.localeCompare(a.aangemaakt));
  }, [lessen]);

  const verwijder = async (id: string) => {
    const les = lessen.find((l) => l.id === id);
    if (!les) return;
    const ja = await bevestig({
      titel: "Les verwijderen?",
      tekst: `"${les.titel || "Les"}" van ${les.datum} en de bijbehorende aanwezigheid worden verwijderd.`,
      knop: "Verwijderen",
      gevaar: true,
    });
    if (!ja) return;
    updateLessen((ls) => ls.filter((l) => l.id !== id));
    toast("Les verwijderd", "ok");
  };

  return (
    <div className="pagina">
      <div className="pagina-kop">
        <h1>Lessen</h1>
        <button className="knop primair" onClick={() => setNieuwOpen(true)}>
          ＋ Nieuwe les
        </button>
      </div>

      {gesorteerd.length === 0 ? (
        <div className="leeg-scherm">
          <h2>Welkom bij Klasplattegrond</h2>
          <p>Zo begin je:</p>
          <ol>
            <li>
              <strong>Importeer je studenten</strong> uit Excel bij <em>Klassen</em>. Alles blijft lokaal op deze computer.
            </li>
            <li>
              Maak een <strong>nieuwe les</strong> en kies de grootte van het lokaal (18, 24, 32, 48 of een eigen getal). Je krijgt direct een standaard tafelindeling.
            </li>
            <li>
              Sleep tafels naar wens, en druk op <strong>Start les</strong>. Klik op een tafel om een naam te koppelen.
            </li>
            <li>
              Genereer de <strong>aanwezigheidslijst</strong> met onderscheid tussen ‘bij aanvang’ en ‘later’.
            </li>
          </ol>
          <div className="knoppenrij">
            <button className="knop" onClick={onNaarKlassen}>
              Naar Klassen
            </button>
            <button className="knop primair" onClick={() => setNieuwOpen(true)}>
              Nieuwe les
            </button>
          </div>
        </div>
      ) : (
        <ul className="kaartlijst">
          {gesorteerd.map((les) => {
            const klas = klassen.find((k) => k.id === les.klasId);
            const t = klas ? tel(berekenAanwezigheid(les, klas)) : null;
            return (
              <li key={les.id} className="kaart" onClick={() => onOpen(les.id)}>
                <div className="kaart-hoofd">
                  <div>
                    <div className="kaart-titel">{les.titel || "Les zonder titel"}</div>
                    <div className="klein">
                      {klas?.naam ?? "(klas verwijderd)"} · {datumNl(les.datum)}
                    </div>
                  </div>
                  <span className={`status-chip ${les.status}`}>{STATUS_LABEL[les.status]}</span>
                </div>
                <div className="kaart-voet">
                  <span>{les.capaciteit} tafels</span>
                  {t && les.status !== "voorbereiding" && (
                    <span>
                      {t.aanwezig}/{t.totaal} aanwezig{t.later > 0 ? ` (${t.later} later)` : ""}
                    </span>
                  )}
                  <button
                    className="knop klein gevaar-tekst"
                    onClick={(e) => {
                      e.stopPropagation();
                      void verwijder(les.id);
                    }}
                  >
                    Verwijderen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nieuwOpen && (
        <NieuweLesDialog
          onSluit={() => setNieuwOpen(false)}
          onAangemaakt={(id) => {
            setNieuwOpen(false);
            onOpen(id);
          }}
          onNaarKlassen={() => {
            setNieuwOpen(false);
            onNaarKlassen();
          }}
        />
      )}
    </div>
  );
}

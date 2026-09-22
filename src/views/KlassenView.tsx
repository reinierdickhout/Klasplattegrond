import { useState } from "react";
import type { Klas, Student } from "../types.ts";
import { nieuwId, sorteerOpAchternaam } from "../names.ts";
import { useStore } from "../store.tsx";
import { voorbeeldKlas } from "../sampleData.ts";
import { ImportDialog } from "../components/ImportDialog.tsx";
import { useUi } from "../components/ui.tsx";

export function KlassenView() {
  const { klassen, lessen, updateKlassen, updateLessen } = useStore();
  const { bevestig, toast } = useUi();
  const [gekozenId, setGekozenId] = useState<string | null>(klassen[0]?.id ?? null);
  const [importOpen, setImportOpen] = useState(false);
  const [nieuw, setNieuw] = useState({ voornaam: "", achternaam: "", nummer: "" });

  const klas = klassen.find((k) => k.id === gekozenId) ?? null;

  const wijzigKlas = (fn: (k: Klas) => Klas) => {
    if (!klas) return;
    updateKlassen((ks) => ks.map((k) => (k.id === klas.id ? { ...fn(k), bijgewerkt: new Date().toISOString() } : k)));
  };

  const wijzigStudent = (id: string, patch: Partial<Student>) => wijzigKlas((k) => ({ ...k, studenten: k.studenten.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const verwijderStudent = async (s: Student) => {
    const gebruikt = lessen.filter((l) => l.plaatsingen.some((p) => p.studentId === s.id)).length;
    if (gebruikt > 0) {
      const ja = await bevestig({
        titel: "Student verwijderen?",
        tekst: `${s.voornaam} ${s.achternaam} staat in ${gebruikt} les(sen). Bij verwijderen verdwijnt die persoon ook uit die aanwezigheidslijsten.`,
        knop: "Verwijderen",
        gevaar: true,
      });
      if (!ja) return;
    }
    wijzigKlas((k) => ({ ...k, studenten: k.studenten.filter((x) => x.id !== s.id) }));
    updateLessen((ls) => ls.map((l) => (l.plaatsingen.some((p) => p.studentId === s.id) ? { ...l, plaatsingen: l.plaatsingen.filter((p) => p.studentId !== s.id) } : l)));
  };

  const voegStudentToe = () => {
    if (!nieuw.voornaam.trim() && !nieuw.achternaam.trim()) return;
    const s: Student = { id: nieuwId(), voornaam: nieuw.voornaam.trim(), achternaam: nieuw.achternaam.trim(), ...(nieuw.nummer.trim() ? { nummer: nieuw.nummer.trim() } : {}) };
    wijzigKlas((k) => ({ ...k, studenten: [...k.studenten, s] }));
    setNieuw({ voornaam: "", achternaam: "", nummer: "" });
  };

  const verwijderKlas = async () => {
    if (!klas) return;
    const aantalLessen = lessen.filter((l) => l.klasId === klas.id).length;
    const ja = await bevestig({
      titel: `Klas "${klas.naam}" verwijderen?`,
      tekst: `${klas.studenten.length} studenten${aantalLessen > 0 ? ` en ${aantalLessen} bijbehorende lessen` : ""} worden gewist. Dit kan niet ongedaan worden gemaakt.`,
      knop: "Verwijderen",
      gevaar: true,
    });
    if (!ja) return;
    updateLessen((ls) => ls.filter((l) => l.klasId !== klas.id));
    updateKlassen((ks) => ks.filter((k) => k.id !== klas.id));
    setGekozenId(klassen.find((k) => k.id !== klas.id)?.id ?? null);
    toast("Klas verwijderd", "ok");
  };

  const maakVoorbeeld = () => {
    const k = voorbeeldKlas();
    updateKlassen((ks) => [...ks, k]);
    setGekozenId(k.id);
  };

  const maakLeeg = () => {
    const k: Klas = { id: nieuwId(), naam: `Nieuwe klas ${klassen.length + 1}`, studenten: [], bijgewerkt: new Date().toISOString() };
    updateKlassen((ks) => [...ks, k]);
    setGekozenId(k.id);
  };

  const gesorteerd = klas ? sorteerOpAchternaam(klas.studenten) : [];

  return (
    <div className="pagina klassen-pagina">
      <aside className="klassen-lijst">
        <div className="pagina-kop klein-kop">
          <h1>Klassen</h1>
        </div>
        <button className="knop primair breed" onClick={() => setImportOpen(true)}>
          ⤓ Importeren uit Excel / CSV
        </button>
        <div className="knoppenrij">
          <button className="knop" onClick={maakLeeg}>
            ＋ Lege klas
          </button>
          <button className="knop" onClick={maakVoorbeeld} title="Fictieve namen om de app uit te proberen">
            Voorbeeldklas
          </button>
        </div>
        <ul>
          {klassen.map((k) => (
            <li key={k.id}>
              <button className={`klas-rij ${k.id === gekozenId ? "actief" : ""}`} onClick={() => setGekozenId(k.id)}>
                <span>{k.naam}</span>
                <span className="klein">{k.studenten.length}</span>
              </button>
            </li>
          ))}
        </ul>
        {klassen.length === 0 && <p className="klein">Nog geen klassen. Importeer een lijst of maak de voorbeeldklas om te oefenen.</p>}
      </aside>

      <section className="klas-detail">
        {klas ? (
          <>
            <div className="pagina-kop">
              <input
                key={klas.id + klas.naam}
                className="titel-input groot"
                defaultValue={klas.naam}
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== klas.naam && wijzigKlas((k) => ({ ...k, naam: e.target.value.trim() }))}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
              <div className="knoppenrij">
                <button className="knop" onClick={() => setImportOpen(true)}>
                  ⤓ Studenten toevoegen/bijwerken
                </button>
                <button className="knop gevaar" onClick={verwijderKlas}>
                  Klas verwijderen
                </button>
              </div>
            </div>
            <p className="klein">{klas.studenten.length} studenten</p>
            <table className="studenten-tabel">
              <thead>
                <tr>
                  <th>Voornaam</th>
                  <th>Achternaam</th>
                  <th>Studentnummer</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {gesorteerd.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input key={s.voornaam} defaultValue={s.voornaam} onBlur={(e) => e.target.value !== s.voornaam && wijzigStudent(s.id, { voornaam: e.target.value.trim() })} />
                    </td>
                    <td>
                      <input key={s.achternaam} defaultValue={s.achternaam} onBlur={(e) => e.target.value !== s.achternaam && wijzigStudent(s.id, { achternaam: e.target.value.trim() })} />
                    </td>
                    <td>
                      <input
                        key={s.nummer ?? ""}
                        defaultValue={s.nummer ?? ""}
                        onBlur={(e) => e.target.value !== (s.nummer ?? "") && wijzigStudent(s.id, { nummer: e.target.value.trim() || undefined })}
                      />
                    </td>
                    <td className="actie-cel">
                      <button className="knop klein gevaar-tekst" onClick={() => void verwijderStudent(s)} aria-label={`Verwijder ${s.voornaam} ${s.achternaam}`}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="nieuwe-rij">
                  <td>
                    <input placeholder="Voornaam" value={nieuw.voornaam} onChange={(e) => setNieuw({ ...nieuw, voornaam: e.target.value })} onKeyDown={(e) => e.key === "Enter" && voegStudentToe()} />
                  </td>
                  <td>
                    <input placeholder="Achternaam" value={nieuw.achternaam} onChange={(e) => setNieuw({ ...nieuw, achternaam: e.target.value })} onKeyDown={(e) => e.key === "Enter" && voegStudentToe()} />
                  </td>
                  <td>
                    <input placeholder="Nummer (optioneel)" value={nieuw.nummer} onChange={(e) => setNieuw({ ...nieuw, nummer: e.target.value })} onKeyDown={(e) => e.key === "Enter" && voegStudentToe()} />
                  </td>
                  <td className="actie-cel">
                    <button className="knop klein primair" onClick={voegStudentToe}>
                      ＋
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <div className="leeg-scherm">
            <h2>Geen klas gekozen</h2>
            <p>Importeer een studentenlijst uit Excel of CSV, of maak een lege klas.</p>
            <button className="knop primair" onClick={() => setImportOpen(true)}>
              Importeren
            </button>
          </div>
        )}
      </section>

      {importOpen && (
        <ImportDialog
          klassen={klassen}
          voorgekozenKlasId={klas?.id}
          onSluit={() => setImportOpen(false)}
          onKlaar={(id) => {
            setImportOpen(false);
            setGekozenId(id);
          }}
        />
      )}
    </div>
  );
}

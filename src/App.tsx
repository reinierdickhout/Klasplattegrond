import { useState } from "react";
import { useStore } from "./store.tsx";
import { LessenView } from "./views/LessenView.tsx";
import { KlassenView } from "./views/KlassenView.tsx";
import { LesView } from "./views/LesView.tsx";
import { PrivacyDialog } from "./components/PrivacyDialog.tsx";

type Weergave = { soort: "lessen" } | { soort: "klassen" } | { soort: "les"; id: string };

export function App() {
  const { geladen, opslag } = useStore();
  const [weergave, setWeergave] = useState<Weergave>({ soort: "lessen" });
  const [privacyOpen, setPrivacyOpen] = useState(false);

  if (!geladen) return <div className="laden">Gegevens laden…</div>;

  const inLes = weergave.soort === "les";

  return (
    <div className="app">
      <header className="topbalk geen-print">
        <div className="merk">
          <span className="merk-icoon">▦</span> Klasplattegrond
        </div>
        <nav>
          <button className={weergave.soort === "lessen" || inLes ? "actief" : ""} onClick={() => setWeergave({ soort: "lessen" })}>
            Lessen
          </button>
          <button className={weergave.soort === "klassen" ? "actief" : ""} onClick={() => setWeergave({ soort: "klassen" })}>
            Klassen
          </button>
        </nav>
        <div className="topbalk-rechts">
          <span className={`opslag ${opslag.status}`} title={opslag.fout}>
            {opslag.status === "ok" && "✓ Lokaal opgeslagen"}
            {opslag.status === "bezig" && "Opslaan…"}
            {opslag.status === "fout" && "⚠ Opslaan mislukt"}
          </span>
          <button className="knop" onClick={() => setPrivacyOpen(true)}>
            🔒 Privacy
          </button>
        </div>
      </header>

      {opslag.status === "fout" && (
        <div className="foutbalk geen-print">
          <strong>Let op: je wijzigingen worden niet weggeschreven.</strong> {opslag.fout}
        </div>
      )}

      <main className={inLes ? "hoofd vol" : "hoofd"}>
        {weergave.soort === "lessen" && <LessenView onOpen={(id) => setWeergave({ soort: "les", id })} onNaarKlassen={() => setWeergave({ soort: "klassen" })} />}
        {weergave.soort === "klassen" && <KlassenView />}
        {weergave.soort === "les" && <LesView lesId={weergave.id} onTerug={() => setWeergave({ soort: "lessen" })} />}
      </main>

      {privacyOpen && <PrivacyDialog onSluit={() => setPrivacyOpen(false)} />}
    </div>
  );
}

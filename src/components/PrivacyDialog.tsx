import { useStore } from "../store.tsx";
import { Modal, useUi } from "./ui.tsx";

export function PrivacyDialog({ onSluit }: { onSluit: () => void }) {
  const { dataPad, klassen, lessen, updateKlassen, updateLessen, updateLokalen } = useStore();
  const { bevestig, toast } = useUi();
  const aantalStudenten = klassen.reduce((n, k) => n + k.studenten.length, 0);

  const wisAlles = async () => {
    const ja = await bevestig({
      titel: "Alle gegevens wissen?",
      tekst: `Dit verwijdert ${klassen.length} klassen (${aantalStudenten} studenten), ${lessen.length} lessen en alle bewaarde indelingen uit de app. Dit kan niet ongedaan worden gemaakt.`,
      knop: "Alles wissen",
      gevaar: true,
    });
    if (!ja) return;
    updateKlassen(() => []);
    updateLessen(() => []);
    updateLokalen(() => []);
    toast("Alle gegevens zijn gewist", "ok");
    onSluit();
  };

  return (
    <Modal titel="Privacy en gegevens" onSluit={onSluit}>
      <p>
        Deze app draait volledig lokaal. Er is geen internetverbinding nodig, er worden geen gegevens verstuurd en er zijn geen accounts of cloud-diensten. Namen van studenten
        staan alleen in JSON-bestanden op deze computer.
      </p>
      <h3>Waar staan de gegevens?</h3>
      <p>
        <code className="pad">{dataPad}</code>
      </p>
      <ul className="klein-lijst">
        <li>
          <code>klassen.json</code> – klassen en studenten
        </li>
        <li>
          <code>lessen.json</code> – lessen, tafelindelingen, plaatsingen en aanwezigheid
        </li>
        <li>
          <code>lokalen.json</code> – bewaarde lokaalindelingen (geen namen)
        </li>
      </ul>
      <p className="waarschuwing">
        Bewaar de app-map niet in een gesynchroniseerde cloudmap (zoals OneDrive), anders staan de namen alsnog buiten je computer. Een <code>.bak</code>-bestand is de vorige versie, voor
        herstel.
      </p>
      <h3>Verwijderen</h3>
      <p>Verwijder gegevens van studenten zodra je ze niet meer nodig hebt.</p>
      <button className="knop gevaar" onClick={wisAlles}>
        Alle gegevens wissen…
      </button>
    </Modal>
  );
}

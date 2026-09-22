import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* ---------- Modal ---------- */

interface ModalProps {
  titel: string;
  onSluit: () => void;
  children: ReactNode;
  voet?: ReactNode;
  breed?: boolean;
}

export function Modal({ titel, onSluit, children, voet, breed }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onSluit();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onSluit]);

  return createPortal(
    <div className="modal-root">
      <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onSluit()}>
        <div className={`modal${breed ? " breed" : ""}`} role="dialog" aria-modal="true" aria-label={titel}>
          <div className="modal-kop">
            <h2>{titel}</h2>
            <button className="knop icoon geen-print" onClick={onSluit} aria-label="Sluiten">
              ✕
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {voet && <div className="modal-voet geen-print">{voet}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Toasts + bevestigen ---------- */

type ToastSoort = "ok" | "fout" | "info";
interface Toast {
  id: number;
  tekst: string;
  soort: ToastSoort;
}

interface BevestigOpties {
  titel: string;
  tekst: string;
  knop: string;
  gevaar?: boolean;
}

interface UiWaarde {
  toast: (tekst: string, soort?: ToastSoort) => void;
  bevestig: (opties: BevestigOpties) => Promise<boolean>;
}

const UiContext = createContext<UiWaarde | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bevestiging, setBevestiging] = useState<(BevestigOpties & { los: (ja: boolean) => void }) | null>(null);
  const teller = useRef(0);

  const toast = useCallback((tekst: string, soort: ToastSoort = "info") => {
    const id = ++teller.current;
    setToasts((t) => [...t, { id, tekst, soort }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), soort === "fout" ? 7000 : 3200);
  }, []);

  const bevestig = useCallback(
    (opties: BevestigOpties) => new Promise<boolean>((los) => setBevestiging({ ...opties, los })),
    [],
  );

  const waarde = useMemo(() => ({ toast, bevestig }), [toast, bevestig]);

  const sluit = (ja: boolean) => {
    bevestiging?.los(ja);
    setBevestiging(null);
  };

  return (
    <UiContext.Provider value={waarde}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.soort}`}>
              {t.tekst}
            </div>
          ))}
        </div>,
        document.body,
      )}
      {bevestiging && (
        <Modal
          titel={bevestiging.titel}
          onSluit={() => sluit(false)}
          voet={
            <>
              <button className="knop" onClick={() => sluit(false)}>
                Annuleren
              </button>
              <button className={`knop ${bevestiging.gevaar ? "gevaar" : "primair"}`} onClick={() => sluit(true)} autoFocus>
                {bevestiging.knop}
              </button>
            </>
          }
        >
          <p>{bevestiging.tekst}</p>
        </Modal>
      )}
    </UiContext.Provider>
  );
}

export function useUi(): UiWaarde {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi buiten UiProvider");
  return ctx;
}

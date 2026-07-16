import { useState, type ReactNode } from "react";

interface InfoCalloutProps {
  children: ReactNode;
}

function InfoCallout({ children }: InfoCalloutProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="info-callout">
      <button
        type="button"
        className="info-callout-icon"
        aria-expanded={open}
        aria-label={open ? "Hide how it works" : "Show how it works"}
        onClick={() => setOpen((v) => !v)}
      >
        ⓘ
      </button>
      <div>
        <p className="info-callout-title">How it works</p>
        {open && <p className="info-callout-body">{children}</p>}
      </div>
    </div>
  );
}

export default InfoCallout;

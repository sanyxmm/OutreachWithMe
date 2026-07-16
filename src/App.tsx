import { useEffect, useRef, useState } from "react";
import SalesQlTab from "./SalesQlTab";
import ContactOutTab from "./ContactOutTab";
import PdfTab from "./PdfTab";
import CombinedTab from "./CombinedTab";
import "./App.css";

type Tab = "salesql" | "contactout" | "pdf" | "combined";

interface NavItem {
  id: Tab;
  label: string;
  title: string;
  icon: string;
}

const PRIMARY_NAV: NavItem = {
  id: "combined",
  label: "Referral Launchpad",
  title: "Referral Launchpad",
  icon: "🚀",
};

const TOOL_NAV: NavItem[] = [
  { id: "salesql", label: "SalesQL", title: "SalesQL Tool", icon: "📇" },
  { id: "contactout", label: "ContactOut", title: "ContactOut Tool", icon: "🔍" },
  { id: "pdf", label: "PDF Stamp", title: "PDF Stamp Tool", icon: "📄" },
];

const ALL_NAV: NavItem[] = [PRIMARY_NAV, ...TOOL_NAV];

function App() {
  const [tab, setTab] = useState<Tab>("combined");
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const current = ALL_NAV.find((n) => n.id === tab)!;

  function selectTab(id: Tab) {
    setTab(id);
    setMenuOpen(false);
  }

  return (
    <div className="page">
      <header className="app-header">
        <div className="header-inner">
          <div className="app-heading">
            <div className="breadcrumb">
              <span className="logo-badge" aria-hidden="true">
                🚀
              </span>
              <span>Workspace</span>
              <span className="breadcrumb-sep" aria-hidden="true">
                →
              </span>
              <span>Referral Launchpad</span>
            </div>
            <div className="app-title-row">
              <h1>{current.title}</h1>
              <span className="status-pill status-pill-success">
                <span className="status-dot" aria-hidden="true" />
                {tab === "combined" ? "Active flow" : "Active tool"}
              </span>
            </div>
          </div>

          <div className="header-actions">
            <span className="status-pill status-pill-neutral">
              🛡 System ready
            </span>

            <div className="nav-wrap" ref={navRef}>
              <button
                className="tools-btn"
                aria-label="Switch tool"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                ▤ Tools ▾
              </button>
              {menuOpen && (
                <div className="nav-dropdown">
                  <div className="nav-section-label">Main flow</div>
                  <button
                    className={`nav-item ${tab === PRIMARY_NAV.id ? "active" : ""}`}
                    onClick={() => selectTab(PRIMARY_NAV.id)}
                  >
                    <span aria-hidden="true">{PRIMARY_NAV.icon}</span> {PRIMARY_NAV.label}
                  </button>

                  <div className="nav-divider" />
                  <div className="nav-section-label">Individual tools</div>
                  {TOOL_NAV.map((n) => (
                    <button
                      key={n.id}
                      className={`nav-item ${tab === n.id ? "active" : ""}`}
                      onClick={() => selectTab(n.id)}
                    >
                      <span aria-hidden="true">{n.icon}</span> {n.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="page-content">
        {tab === "salesql" && <SalesQlTab />}
        {tab === "contactout" && <ContactOutTab />}
        {tab === "pdf" && <PdfTab />}
        {tab === "combined" && <CombinedTab />}
      </div>
    </div>
  );
}

export default App;

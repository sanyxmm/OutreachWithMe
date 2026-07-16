import { useState } from "react";
import SalesQlTab from "./SalesQlTab";
import ContactOutTab from "./ContactOutTab";
import PdfTab from "./PdfTab";
import "./App.css";

type Tab = "salesql" | "contactout" | "pdf";

function App() {
  const [tab, setTab] = useState<Tab>("salesql");

  return (
    <div className="page">
      <h1>Outreach Sheet Builder</h1>
      <div className="tabs">
        <button
          className={tab === "salesql" ? "tab active" : "tab"}
          onClick={() => setTab("salesql")}
        >
          SalesQL
        </button>
        <button
          className={tab === "contactout" ? "tab active" : "tab"}
          onClick={() => setTab("contactout")}
        >
          ContactOut
        </button>
        <button
          className={tab === "pdf" ? "tab active" : "tab"}
          onClick={() => setTab("pdf")}
        >
          PDF Stamp
        </button>
      </div>
      {tab === "salesql" && <SalesQlTab />}
      {tab === "contactout" && <ContactOutTab />}
      {tab === "pdf" && <PdfTab />}
    </div>
  );
}

export default App;

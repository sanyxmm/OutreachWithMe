// Ported from salesql_to_outreach.py — parses a SalesQL contacts table (copied HTML)
// into outreach-ready rows.

export interface Contact {
  name: string;
  company: string;
  role: string;
}

export interface OutreachOptions {
  domain: string;
  jobRole: string;
  resumeId: string;
  interval: number;
  companyOnly?: string;
  emailPattern?: EmailPattern;
  skillCategory?: SkillCategoryChoice;
}

export const SKILL_CATEGORIES = [
  { id: "mern+devops", label: "MERN + DevOps" },
  { id: "java", label: "Java" },
  { id: "ai/ml", label: "AI/ML" },
  { id: "other", label: "Other (custom)" },
] as const;

export type SkillCategoryId = (typeof SKILL_CATEGORIES)[number]["id"];

export interface SkillCategoryChoice {
  id: SkillCategoryId;
  custom?: string;
}

export function resolveSkillCategory(role: string, choice?: SkillCategoryChoice): string {
  if (!choice) return skillCat(role);
  if (choice.id === "other") return choice.custom?.trim() || skillCat(role);
  return choice.id;
}

export const HEADERS = [
  "first_name", "company_name", "company_city_name", "role",
  "exp_years_expected", "verified_emails", "skill_category",
  "resume_file_id", "priority", "email_interval_days", "status",
  "first_email_sent", "last_email_sent", "followup_count",
  "next_followup", "due_today", "Job_Role_ID", "SKIP",
] as const;

export const WIDTHS = [28, 30, 16, 45, 16, 32, 26, 32, 9, 17, 8, 15, 15, 14, 13, 10, 38, 6];

const NAME_RE = /person-card__name-text[^>]*>([\s\S]*?)<\/span>[\s\S]*?person-card__title[^>]*>([\s\S]*?)<\/div>/;
const COMPANY_RE = /company-cell__info__name[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?company-cell__info__extra[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/;
const ROW_RE = /<tr\b[\s\S]*?<\/tr>/g;

function unescapeHtml(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

function clean(text: string): string {
  const stripped = text.replace(/<[^>]+>/g, " ");
  const unescaped = unescapeHtml(stripped);
  return unescaped.replace(/\s+/g, " ").trim();
}

export function parseRows(html: string): Contact[] {
  const contacts: Contact[] = [];
  const rows = html.match(ROW_RE) || [];
  for (const row of rows) {
    const m = NAME_RE.exec(row);
    if (!m) continue;
    const c = COMPANY_RE.exec(row);
    const name = clean(m[1]);
    const headline = clean(m[2]);
    const company = c ? clean(c[1]) : "";
    let role = c ? clean(c[2]) : headline;
    if (!role || role === "--") {
      role = headline !== "--" ? headline : "";
    }
    if (name) contacts.push({ name, company, role });
  }
  return contacts;
}

// ----------------------------------------------------------------- emails ---

const CREDS = new Set([
  "pe", "p.e", "pmp", "pmp®", "phd", "ph.d", "pg", "se", "s.e", "ccm",
  "te", "msc", "m.sc", "masc", "m.eng", "meng", "meee", "rcdd", "cd1",
  "mba", "peng", "p.eng", "p.en", "pgmp", "rmp", "env", "sp", "dbia",
  "leed", "ap", "ceng", "fice", "jr", "sr", "iii", "ii", "iv", "dba",
  "pfmp", "pba", "efqm", "tquk", "acc", "cipd", "l-d", "eng",
]);
const PARTICLES = new Set(["van", "de", "del", "der", "al", "el", "bin", "abu"]);

export function nameParts(full: string): [string, string] {
  const s = full.replace(/\(.*?\)/g, " ").replace(/,/g, " ");
  let toks = s.split(/\s+/).filter((t) => t.trim().length > 0);
  toks = toks.filter((t) => {
    const key = t.replace(/\.+$/, "").toLowerCase().replace(/®$/, "");
    return !CREDS.has(key);
  });
  toks = toks.map((t) => t.replace(/[^A-Za-z-]/g, ""));
  toks = toks.filter((t) => t.length > 0);
  if (toks.length === 0) return ["", ""];
  const first = toks[0];
  const rest = toks.slice(1);
  const multi = rest.filter((t) => t.length > 1);
  let last = multi.length > 0 ? multi[multi.length - 1] : (rest.length > 0 ? rest[rest.length - 1] : "");
  if (last) {
    const i = toks.indexOf(last);
    if (i > 1 && PARTICLES.has(toks[i - 1].toLowerCase())) {
      last = toks[i - 1] + last;
    }
  }
  return [first, last];
}

export const EMAIL_PATTERNS = [
  { id: "first.last", label: "first.last (jane.doe)" },
  { id: "firstlast", label: "firstlast (janedoe)" },
  { id: "first", label: "first (jane)" },
  { id: "flast", label: "flast (jdoe)" },
  { id: "first.l", label: "first.l (jane.d)" },
  { id: "last.first", label: "last.first (doe.jane)" },
  { id: "first_last", label: "first_last (jane_doe)" },
  { id: "lastf", label: "lastf (doej)" },
] as const;

export type EmailPattern = (typeof EMAIL_PATTERNS)[number]["id"];

function applyPattern(first: string, last: string, pattern: EmailPattern): string {
  const f = first.toLowerCase();
  const l = last.toLowerCase();
  switch (pattern) {
    case "firstlast":
      return f + l;
    case "first":
      return f;
    case "flast":
      return l ? f[0] + l : f;
    case "first.l":
      return l ? f + "." + l[0] : f;
    case "last.first":
      return l ? l + "." + f : f;
    case "first_last":
      return l ? f + "_" + l : f;
    case "lastf":
      return l ? l + f[0] : f;
    case "first.last":
    default:
      return l ? f + "." + l : f;
  }
}

export function formatJobRole(role: string, jobId: string): string {
  const r = role.trim();
  const id = jobId.trim();
  if (!id) return r;
  if (!r) return `(JobID: ${id})`;
  return `${r} ( JobID: ${id})`;
}

export function makeEmail(full: string, domain: string, pattern: EmailPattern = "first.last"): string {
  const [f, l] = nameParts(full);
  if (!f) return "";
  return applyPattern(f, l, pattern) + "@" + domain;
}

// -------------------------------------------------------------- heuristics ---

export function expYears(role: string): number {
  const r = role.toLowerCase();
  if (r.includes("intern") || r.includes("student")) return 1;
  if (["principal", "director", "chief", "fellow", "chairman", "vice president"].some((k) => r.includes(k))) return 12;
  if (r.includes("senior") || r.includes("sr.") || r.includes("sr ")) return 8;
  if (r.includes("manager") || r.includes("lead")) return 10;
  return 5;
}

export function skillCat(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("software") || r.includes("devsecops") || r.includes("developer")) return "Software Engineering";
  if (r.includes("cyber") || r.includes("security")) return "Cybersecurity";
  if (r.includes("data") || r.includes("gis")) return "Data / GIS";
  if (r.includes("program") || r.includes("project")) return "Program & Project Management";
  if (r.includes("engineering manager") || r.includes("engineer") || r.includes("technical")) return "Engineering Management";
  if (r.includes("lead")) return "Team Leadership";
  return "Other";
}

// ------------------------------------------------------------------ rows ---

export type OutputRow = (string | number)[];

export function dedupeContacts(contacts: Contact[], companyOnly?: string): Contact[] {
  const seen = new Set<string>();
  const out: Contact[] = [];
  for (const c of contacts) {
    const key = c.name.toLowerCase().replace(/[^a-z]/g, "");
    if (seen.has(key)) continue;
    if (companyOnly && !c.company.toLowerCase().includes(companyOnly.toLowerCase())) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function buildRows(contacts: Contact[], opts: OutreachOptions): OutputRow[] {
  return contacts.map(({ name, company, role }) => [
    name, company, "", role, expYears(role),
    makeEmail(name, opts.domain, opts.emailPattern), resolveSkillCategory(role, opts.skillCategory),
    opts.resumeId, "", opts.interval, "", "", "", "", "", "",
    opts.jobRole, "",
  ]);
}

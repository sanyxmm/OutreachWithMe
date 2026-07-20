// Parses a pasted ContactOut curl response (Inertia.js page payload) into
// outreach rows, reusing the same 18-column output shape as the SalesQL tab.
import {
  HEADERS,
  WIDTHS,
  expYears,
  resolveSkillCategory,
  SKILL_CATEGORIES,
  type OutputRow,
  type SkillCategoryChoice,
} from "./outreach";

export { SKILL_CATEGORIES };
export type { SkillCategoryChoice };

export { HEADERS, WIDTHS };

interface RawEmailEntry {
  value: string;
  type: number; // 1 = work (company domain), 2 = personal
}

interface RawLead {
  id: number;
  company?: string;
  fullName: string;
  headline?: string;
  location?: string;
  experience?: string[];
  emails?: string[];
  contactInfo?: {
    emails?: RawEmailEntry[];
  };
}

export interface Lead {
  id: number;
  fullName: string;
  company: string;
  role: string;
  personalEmail: string;
  workEmail: string;
}

function roleFromExperience(lead: RawLead): string {
  const first = lead.experience?.[0];
  if (first) {
    const title = first.split(" - ")[0].trim();
    if (title) return title;
  }
  return lead.headline?.trim() || "";
}

function pickEmails(lead: RawLead): { personalEmail: string; workEmail: string } {
  const entries = lead.contactInfo?.emails;
  if (entries && entries.length > 0) {
    const personal = entries.find((e) => e.type === 2)?.value ?? "";
    const work = entries.find((e) => e.type === 1)?.value ?? "";
    if (personal || work) return { personalEmail: personal, workEmail: work };
  }
  const fallback = lead.emails ?? [];
  return { personalEmail: fallback[0] ?? "", workEmail: fallback[1] ?? "" };
}

function findLeadsArray(payload: unknown): RawLead[] {
  if (Array.isArray(payload)) return payload as RawLead[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const paths = [
      ["props", "leads", "data"],
      ["leads", "data"],
      ["data"],
    ];
    for (const path of paths) {
      let cur: unknown = obj;
      for (const key of path) {
        if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[key];
        } else {
          cur = undefined;
          break;
        }
      }
      if (Array.isArray(cur)) return cur as RawLead[];
    }
  }
  throw new Error("Couldn't find a leads array in this JSON (expected props.leads.data).");
}

export function transformRawLeads(rawLeads: unknown[]): Lead[] {
  return (rawLeads as RawLead[])
    .filter((l) => l && l.fullName)
    .map((l) => {
      const { personalEmail, workEmail } = pickEmails(l);
      return {
        id: l.id,
        fullName: l.fullName,
        company: l.company ?? "",
        role: roleFromExperience(l),
        personalEmail,
        workEmail,
      };
    });
}

export function parseContactOutPayload(raw: string): Lead[] {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("That doesn't look like valid JSON.");
  }
  return transformRawLeads(findLeadsArray(payload));
}

export function mergeLeads(existing: Lead[], incoming: Lead[]): Lead[] {
  const byId = new Map<number, Lead>();
  for (const l of existing) byId.set(l.id, l);
  for (const l of incoming) byId.set(l.id, l);
  return Array.from(byId.values());
}

export interface ContactOutOptions {
  jobRole: string;
  resumeId: string;
  interval: number;
  skillCategory?: SkillCategoryChoice;
}

export function buildContactOutRows(leads: Lead[], opts: ContactOutOptions): OutputRow[] {
  return leads.map((lead) => {
    const verifiedEmails = [lead.personalEmail, lead.workEmail].filter(Boolean).join("; ");
    return [
      lead.fullName, lead.company, "", lead.role, expYears(lead.role),
      verifiedEmails, resolveSkillCategory(lead.role, opts.skillCategory),
      opts.resumeId, "", opts.interval, "", "", "", "", "", "",
      opts.jobRole, "",
    ];
  });
}

import { supabase } from "@/integrations/supabase/client";

const API_PATH = "/api/workbook-author";

export type WorkbookSectionDraft = {
  id?: string;
  position: number;
  kind: string;
  title: string;
  purpose?: string;
  searchQuery?: string;
  body_md: string;
  sources?: Array<Record<string, unknown>>;
  provider?: string | null;
  model?: string | null;
};

export type WorkbookRecord = {
  id: string;
  owner_id?: string;
  title: string;
  topic: string;
  method: string;
  audience: string;
  status: "draft" | "final";
  created_at?: string;
  updated_at?: string;
  sections?: WorkbookSectionDraft[];
};

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in required.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function postAuthor(body: Record<string, unknown>) {
  const headers = await authHeaders();
  const res = await fetch(API_PATH, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function authorOutline(input: {
  topic: string;
  method: string;
  audience: string;
  length: string;
}) {
  return postAuthor({ action: "outline", ...input });
}

export async function authorDraftSection(input: {
  topic: string;
  method: string;
  audience: string;
  section: WorkbookSectionDraft;
  sections: WorkbookSectionDraft[];
  sectionIndex: number;
  action?: "draft_section" | "rewrite_section" | "continue_section";
  instruction?: string;
}) {
  return postAuthor({
    action: input.action || "draft_section",
    topic: input.topic,
    method: input.method,
    audience: input.audience,
    section: input.section,
    sections: input.sections,
    sectionIndex: input.sectionIndex,
    instruction: input.instruction,
  });
}

export async function authorChat(input: {
  topic: string;
  method: string;
  audience: string;
  message: string;
  messages: Array<{ role: string; content: string }>;
}) {
  return postAuthor({ action: "chat", ...input });
}

const LS_KEY = "shifted_clinician_workbooks_v1";

function readLocal(): WorkbookRecord[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocal(rows: WorkbookRecord[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

export async function listWorkbooks(): Promise<WorkbookRecord[]> {
  const { data, error } = await supabase
    .from("clinician_workbooks" as never)
    .select("*")
    .order("updated_at", { ascending: false });
  const local = readLocal();
  if (error) return local;
  const remote = (data as WorkbookRecord[]) || [];
  const remoteIds = new Set(remote.map((w) => w.id));
  return [...remote, ...local.filter((w) => !remoteIds.has(w.id))];
}

export async function getWorkbook(id: string): Promise<WorkbookRecord | null> {
  const { data, error } = await supabase
    .from("clinician_workbooks" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return readLocal().find((w) => w.id === id) || null;
  }
  const { data: sections } = await supabase
    .from("clinician_workbook_sections" as never)
    .select("*")
    .eq("workbook_id", id)
    .order("position", { ascending: true });
  return { ...(data as WorkbookRecord), sections: (sections as WorkbookSectionDraft[]) || [] };
}

export async function createWorkbook(input: {
  title: string;
  topic: string;
  method: string;
  audience: string;
  sections?: WorkbookSectionDraft[];
}): Promise<WorkbookRecord> {
  const { data: userData } = await supabase.auth.getUser();
  const ownerId = userData.user?.id;
  const payload = {
    title: input.title,
    topic: input.topic,
    method: input.method,
    audience: input.audience,
    status: "draft" as const,
    owner_id: ownerId,
  };

  const { data, error } = await supabase
    .from("clinician_workbooks" as never)
    .insert(payload as never)
    .select("*")
    .single();

  if (error || !data) {
    const local: WorkbookRecord = {
      id: crypto.randomUUID(),
      ...payload,
      owner_id: ownerId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sections: input.sections || [],
    };
    const all = readLocal();
    all.unshift(local);
    writeLocal(all);
    return local;
  }

  const wb = data as WorkbookRecord;
  if (input.sections?.length) {
    await saveSections(wb.id, input.sections);
    wb.sections = input.sections;
  }
  return wb;
}

export async function saveSections(workbookId: string, sections: WorkbookSectionDraft[]) {
  const local = readLocal();
  const idx = local.findIndex((w) => w.id === workbookId);
  if (idx >= 0) {
    local[idx] = {
      ...local[idx],
      sections,
      updated_at: new Date().toISOString(),
    };
    writeLocal(local);
  }

  const { error: delErr } = await supabase
    .from("clinician_workbook_sections" as never)
    .delete()
    .eq("workbook_id", workbookId);
  if (delErr) return;

  const rows = sections.map((s, i) => ({
    workbook_id: workbookId,
    position: i,
    kind: s.kind,
    title: s.title,
    body_md: s.body_md || "",
    sources: s.sources || [],
    provider: s.provider || null,
    model: s.model || null,
  }));
  if (rows.length) {
    await supabase.from("clinician_workbook_sections" as never).insert(rows as never);
  }
  await supabase
    .from("clinician_workbooks" as never)
    .update({ updated_at: new Date().toISOString(), title: sections[0] ? undefined : undefined } as never)
    .eq("id", workbookId);
}

export async function updateWorkbookMeta(
  id: string,
  patch: Partial<Pick<WorkbookRecord, "title" | "status" | "topic" | "method" | "audience">>,
) {
  const local = readLocal();
  const idx = local.findIndex((w) => w.id === id);
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...patch, updated_at: new Date().toISOString() };
    writeLocal(local);
  }
  await supabase
    .from("clinician_workbooks" as never)
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
}

export async function deleteWorkbook(id: string) {
  const local = readLocal().filter((w) => w.id !== id);
  writeLocal(local);
  await supabase.from("clinician_workbooks" as never).delete().eq("id", id);
}

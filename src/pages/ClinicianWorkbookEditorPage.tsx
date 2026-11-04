import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Download, RefreshCw, Save, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  authorChat,
  authorDraftSection,
  getWorkbook,
  saveSections,
  updateWorkbookMeta,
  type WorkbookRecord,
  type WorkbookSectionDraft,
} from "@/lib/workbookAuthorApi";
import { exportWorkbookDocx, exportWorkbookPdf } from "@/lib/workbookExport";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ClinicianWorkbookEditorPage() {
  const { id } = useParams();
  const [workbook, setWorkbook] = useState<WorkbookRecord | null>(null);
  const [sections, setSections] = useState<WorkbookSectionDraft[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const wb = await getWorkbook(id);
    if (!wb) {
      toast.error("Workbook not found");
      return;
    }
    setWorkbook(wb);
    setSections(wb.sections || []);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = sections[active];

  const metaLine = useMemo(() => {
    if (!current?.provider) return null;
    return `Drafted by ${current.provider}${current.model ? ` · ${current.model}` : ""}`;
  }, [current]);

  const persist = async (next: WorkbookSectionDraft[]) => {
    if (!workbook) return;
    setSections(next);
    await saveSections(workbook.id, next);
  };

  const updateBody = (body_md: string) => {
    const next = sections.map((s, i) => (i === active ? { ...s, body_md } : s));
    setSections(next);
  };

  const draftSection = async (action: "draft_section" | "rewrite_section" | "continue_section") => {
    if (!workbook || !current) return;
    setBusy(true);
    try {
      const result = await authorDraftSection({
        topic: workbook.topic,
        method: workbook.method,
        audience: workbook.audience,
        section: current,
        sections,
        sectionIndex: active,
        action,
      });
      if (result.async) {
        toast.error("Set WORKBOOK_LLM_PROVIDER=fallback for synchronous drafting.");
        return;
      }
      const body = String(result.body_md || result.text || "");
      const next = sections.map((s, i) =>
        i === active
          ? {
              ...s,
              body_md: action === "continue_section" && s.body_md ? `${s.body_md.trim()}\n\n${body}` : body,
              sources: result.sources || s.sources,
              provider: result.provider,
              model: result.model,
            }
          : s,
      );
      await persist(next);
      toast.success(action === "continue_section" ? "Continued" : "Section drafted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Draft failed");
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!workbook) return;
    await saveSections(workbook.id, sections);
    await updateWorkbookMeta(workbook.id, { title: workbook.title });
    toast.success("Saved");
  };

  const onChat = async () => {
    if (!workbook || !chatInput.trim()) return;
    const message = chatInput.trim();
    setChatInput("");
    const history = [...chat, { role: "user" as const, content: message }];
    setChat(history);
    setBusy(true);
    try {
      const result = await authorChat({
        topic: workbook.topic,
        method: workbook.method,
        audience: workbook.audience,
        message,
        messages: history,
      });
      setChat([...history, { role: "assistant", content: String(result.text || "") }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  };

  if (!workbook) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link to="/testing/workbooks" className="text-xs text-muted-foreground hover:underline">
            ← All workbooks
          </Link>
          <Input
            className="mt-1 min-h-11 border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
            value={workbook.title}
            onChange={(e) => setWorkbook({ ...workbook, title: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {workbook.topic} · {workbook.method} · {workbook.audience}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => void onSave()}>
            <Save className="h-4 w-4" /> Save
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2"
            onClick={() => exportWorkbookPdf({ ...workbook, sections })}
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2"
            onClick={() => void exportWorkbookDocx({ ...workbook, sections })}
          >
            <Download className="h-4 w-4" /> Word
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="flex min-h-[28rem] flex-col rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">Writing chat</div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {chat.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask for tone changes, shorter worksheets, or crisis box wording. Use Generate on a section for full drafts.
              </p>
            )}
            {chat.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted",
                )}
              >
                {m.content}
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <Textarea
              className="min-h-11"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message the writing model…"
              rows={2}
            />
            <Button
              type="button"
              className="min-h-11 min-w-11 shrink-0"
              disabled={busy}
              onClick={() => void onChat()}
              aria-label="Send"
            >
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
            {sections.map((s, i) => (
              <button
                key={`${s.title}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "min-h-11 shrink-0 rounded-xl px-3 text-left text-xs",
                  i === active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80",
                )}
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </div>

          {current ? (
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium">{current.title}</h2>
                  <p className="text-xs text-muted-foreground">{current.kind}{metaLine ? ` · ${metaLine}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11"
                    disabled={busy}
                    onClick={() => void draftSection("draft_section")}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    Generate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={busy}
                    onClick={() => void draftSection("rewrite_section")}
                  >
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={busy || !current.body_md}
                    onClick={() => void draftSection("continue_section")}
                  >
                    Continue
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => setPreview((p) => !p)}
                  >
                    {preview ? "Edit" : "Preview"}
                  </Button>
                </div>
              </div>

              {preview ? (
                <div className="prose prose-sm max-w-none rounded-xl bg-muted/40 p-4 dark:prose-invert">
                  <ReactMarkdown>{current.body_md || "_Empty section_"}</ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  className="min-h-[22rem] font-mono text-sm"
                  value={current.body_md}
                  onChange={(e) => updateBody(e.target.value)}
                  placeholder="Section markdown appears here after Generate…"
                />
              )}

              {(current.sources || []).length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Sources:{" "}
                  {(current.sources || [])
                    .map((s) => `${s.cite || ""} ${s.agency || ""} — ${s.title || ""}`)
                    .join("; ")}
                </div>
              )}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No sections in this outline.</p>
          )}
        </section>
      </div>
    </div>
  );
}

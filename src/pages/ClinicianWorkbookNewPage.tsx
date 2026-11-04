import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authorOutline, createWorkbook } from "@/lib/workbookAuthorApi";
import { toast } from "sonner";

const TOPICS = [
  "low mood",
  "worry",
  "panic",
  "sleep",
  "PTSD",
  "alcohol",
  "anger",
  "stress",
];

const METHODS = [
  "thought record / HCPR",
  "behavioural activation",
  "graded exposure",
  "problem solving",
  "mindfulness",
  "relapse prevention",
];

export default function ClinicianWorkbookNewPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [method, setMethod] = useState(METHODS[0]);
  const [audience, setAudience] = useState("adult client");
  const [length, setLength] = useState("medium");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    setBusy(true);
    try {
      toast.message("Drafting outline…");
      const result = await authorOutline({ topic, method, audience, length });
      if (result.async && result.jobId) {
        toast.error("Async RunPod jobs need polling — set WORKBOOK_LLM_PROVIDER=fallback for drafting.");
        return;
      }
      const outline = result.outline;
      if (!outline?.sections?.length) throw new Error("No outline returned.");
      const wb = await createWorkbook({
        title: title.trim() || outline.title || `${topic} — ${method}`,
        topic,
        method,
        audience,
        sections: outline.sections.map((s: { position: number; kind: string; title: string; purpose?: string; searchQuery?: string }) => ({
          position: s.position,
          kind: s.kind,
          title: s.title,
          purpose: s.purpose,
          searchQuery: s.searchQuery,
          body_md: "",
          sources: [],
          provider: result.provider,
          model: result.model,
        })),
      });
      toast.success("Outline ready");
      navigate(`/testing/workbooks/${wb.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create workbook");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">New workbook</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose topic and method. The model drafts a section outline first; you edit each section next.
      </p>

      <div className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="wb-title">Title (optional)</Label>
          <Input
            id="wb-title"
            className="min-h-11"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leave blank to use the model title"
          />
        </div>

        <div className="space-y-2">
          <Label>Topic</Label>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOPICS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Audience</Label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adult client">Adult client</SelectItem>
              <SelectItem value="clinician">Clinician</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Length</Label>
          <Select value={length} onValueChange={setLength}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short (5–6 sections)</SelectItem>
              <SelectItem value="medium">Medium (7–8 sections)</SelectItem>
              <SelectItem value="long">Long (9–10 sections)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="button" className="min-h-11 w-full" disabled={busy} onClick={() => void onCreate()}>
          {busy ? "Creating outline…" : "Create outline"}
        </Button>
      </div>
    </div>
  );
}

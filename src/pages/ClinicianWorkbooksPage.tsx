import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2, NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWorkbook, listWorkbooks, type WorkbookRecord } from "@/lib/workbookAuthorApi";
import { toast } from "sonner";

export default function ClinicianWorkbooksPage() {
  const [rows, setRows] = useState<WorkbookRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setRows(await listWorkbooks());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load workbooks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this workbook draft?")) return;
    await deleteWorkbook(id);
    toast.success("Deleted");
    void refresh();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Admin only</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Workbooks</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Draft CBT-style workbooks with the writing model. Clients never see these. Export PDF or Word when ready.
          </p>
        </div>
        <Button asChild className="min-h-11 gap-2">
          <Link to="/testing/workbooks/new">
            <FilePlus2 className="h-4 w-4" />
            New workbook
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <NotebookPen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No drafts yet. Create one to get started.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <Link to={`/testing/workbooks/${w.id}`} className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{w.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {w.topic} · {w.method} · {w.status}
                </div>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                aria-label="Delete workbook"
                onClick={() => void onDelete(w.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

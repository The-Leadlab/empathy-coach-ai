import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, ListTodo, Loader2, MessageCircle, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTrainerAdmin } from "@/hooks/useTrainerAdmin";
import {
  createNewJourney,
  deleteChatSession,
  fetchChatHistory,
  fetchUserJourneys,
  renameChatSession,
  type ChatSession,
} from "@/hooks/useChatSession";
import { isAutoNamedJourney } from "@/lib/journeyNaming";
import { downloadTranscriptPdf, downloadTranscriptTxt } from "@/lib/exportSessionTranscript";
import { PHASE_LABELS } from "@/types/journey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

function journeyDisplayName(journey: ChatSession): string {
  const name = journey.session_name?.trim();
  if (name && !isAutoNamedJourney(name)) return name;
  if (journey.presenting_challenge?.trim()) {
    const snippet = journey.presenting_challenge.trim();
    return snippet.length > 48 ? `${snippet.slice(0, 48)}…` : snippet;
  }
  return name || "New journey";
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function JourneysDashboardPage() {
  const { user } = useAuth();
  const { isTrainerAdmin } = useTrainerAdmin(user?.email, user?.id);
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloadingJourneyId, setDownloadingJourneyId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<ChatSession | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);

  const loadJourneys = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await fetchUserJourneys(user.id);
      setJourneys(rows);
    } catch (err) {
      console.error(err);
      toast.error("Could not load your journeys.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJourneys();
  }, [user]);

  const handleCreateJourney = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const journey = await createNewJourney(user.id);
      navigate(`/testing/avatar/session/${journey.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Could not start a new journey.");
    } finally {
      setCreating(false);
    }
  };

  const openRename = (journey: ChatSession) => {
    setRenameTarget(journey);
    setRenameValue(journeyDisplayName(journey));
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error("Enter a journey name.");
      return;
    }
    try {
      await renameChatSession(renameTarget.id, trimmed);
      setJourneys((prev) =>
        prev.map((j) => (j.id === renameTarget.id ? { ...j, session_name: trimmed } : j)),
      );
      toast.success("Journey renamed.");
      setRenameTarget(null);
    } catch (err) {
      console.error(err);
      toast.error("Could not rename journey.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteChatSession(deleteTarget.id);
      setJourneys((prev) => prev.filter((j) => j.id !== deleteTarget.id));
      toast.success("Journey deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete journey.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDownloadTranscript = async (journey: ChatSession, format: "pdf" | "txt") => {
    setDownloadingJourneyId(journey.id);
    try {
      const history = await fetchChatHistory(journey.id);
      const sessionMeta = {
        id: journey.id,
        user_id: journey.user_id,
        userLabel: user?.email || journey.user_id,
        scenario: journey.scenario,
        session_name: journey.session_name,
        created_at: journey.created_at,
      };
      const messages = history.map((message) => ({
        role: message.role,
        content: message.content,
        created_at: message.created_at,
      }));
      if (format === "pdf") {
        downloadTranscriptPdf(sessionMeta, messages);
      } else {
        downloadTranscriptTxt(sessionMeta, messages);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not download transcript.");
    } finally {
      setDownloadingJourneyId(null);
    }
  };

  const welcomeLine =
    journeys.length === 0
      ? "Welcome — start your first coaching journey whenever you're ready."
      : journeys.length === 1
        ? "Welcome back. Continue your journey or start a fresh one on a new topic."
        : `You have ${journeys.length} journeys. Pick one to continue or start something new.`;

  return (
    <div className="min-h-[calc(100vh-8rem)] px-4 py-8 pb-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="py-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold md:text-3xl">Your journeys</h1>
            <p className="mt-2 text-foreground">{welcomeLine}</p>
          </div>
          <Button
            className="mt-6 rounded-xl relative z-10"
            onClick={handleCreateJourney}
            disabled={creating || loading}
          >
            <Plus className="w-4 h-4 mr-2" />
            {creating ? "Starting…" : "New journey"}
          </Button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            Loading your journeys…
          </div>
        ) : journeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No journeys yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Each journey is a separate coaching thread — like a ChatGPT conversation with its own topic.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {journeys.map((journey) => (
              <li
                key={journey.id}
                className="rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{journeyDisplayName(journey)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {PHASE_LABELS[journey.platform_phase ?? 1]}
                        {" · "}
                        Last active {formatRelativeDate(journey.updated_at)}
                      </p>
                      {journey.presenting_challenge && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {journey.presenting_challenge}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        aria-label="Rename journey"
                        onClick={() => openRename(journey)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-xl text-destructive hover:text-destructive"
                        aria-label="Delete journey"
                        onClick={() => setDeleteTarget(journey)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="rounded-xl flex-1 sm:flex-none" size="sm">
                      <Link to={`/testing/avatar/session/${journey.id}`}>
                        <MessageCircle className="w-4 h-4 mr-1.5" />
                        Open chat
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl flex-1 sm:flex-none" size="sm">
                      <Link to={`/testing/journeys/${journey.id}`}>
                        <ListTodo className="w-4 h-4 mr-1.5" />
                        Tasks
                      </Link>
                    </Button>
                    {isTrainerAdmin ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl flex-1 sm:flex-none"
                          size="sm"
                          disabled={downloadingJourneyId === journey.id}
                          onClick={() => void handleDownloadTranscript(journey, "pdf")}
                        >
                          {downloadingJourneyId === journey.id ? (
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-1.5" />
                          )}
                          PDF
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl flex-1 sm:flex-none"
                          size="sm"
                          disabled={downloadingJourneyId === journey.id}
                          onClick={() => void handleDownloadTranscript(journey, "txt")}
                        >
                          Transcript
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename journey</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Journey name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this journey?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the conversation and its progress. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  addUserTask,
  fetchChatHistory,
  fetchJourneyById,
  removeUserTask,
  toggleGoalInList,
  updateProgressDashboard,
  type ChatSession,
} from "@/hooks/useChatSession";
import { isAutoNamedJourney } from "@/lib/journeyNaming";
import SessionTasksPanel from "@/components/journey/SessionTasksPanel";
import { syncSessionTasks } from "@/lib/coachTaskSync";
import { extractLatestProgressFromHistory } from "@/lib/goalExtraction";
import { journeyStateFromSession, moveGoalInList, reorderGoalsByDrag } from "@/types/journey";
import {
  loadPathFromLocal,
  normalizeSustainabilityPath,
  savePathToLocal,
  togglePathItemComplete,
  type SustainabilityPathItem,
} from "@/lib/sustainabilityPath";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function sessionTitle(session: ChatSession | null): string {
  if (!session) return "Session";
  const name = session.session_name?.trim();
  if (name && !isAutoNamedJourney(name)) return name;
  if (session.presenting_challenge?.trim()) {
    const snippet = session.presenting_challenge.trim();
    return snippet.length > 56 ? `${snippet.slice(0, 56)}…` : snippet;
  }
  return name || "New journey";
}

export default function SessionWorkspacePage() {
  const { journeyId } = useParams<{ journeyId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pathBusy, setPathBusy] = useState(false);

  const chatPath = journeyId ? `/testing/avatar/session/${journeyId}` : "/testing/journeys";

  const openChat = () => navigate(chatPath);

  useEffect(() => {
    if (authLoading) return;

    if (!journeyId) {
      navigate("/testing/journeys", { replace: true });
      return;
    }

    if (!user) {
      navigate("/testing/login", { replace: true });
      return;
    }

    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const row = await fetchJourneyById(journeyId, user.id);
        if (!mounted) return;
        if (!row) {
          toast.error("Session not found.");
          setLoadError(true);
          return;
        }

        const baseState = journeyStateFromSession(row);
        const history = await fetchChatHistory(journeyId);
        const assistantHistory = history
          .filter((m) => m.role === "assistant")
          .map((m) => m.content);
        const recovered = extractLatestProgressFromHistory(assistantHistory, baseState);

        let sessionRow = row;
        const pruneSync = syncSessionTasks(baseState);
        const nextGoals = recovered.goals ?? pruneSync?.user_goals ?? baseState.user_goals;
        const nextSummary =
          recovered.progressSummary ?? pruneSync?.progress_summary ?? baseState.progress_summary;

        const goalsChanged =
          JSON.stringify(nextGoals) !== JSON.stringify(baseState.user_goals);
        const summaryChanged = nextSummary !== baseState.progress_summary;

        if (goalsChanged || summaryChanged) {
          await updateProgressDashboard(journeyId, {
            goals: nextGoals,
            progressSummary: nextSummary,
          });
          sessionRow = {
            ...row,
            user_goals: nextGoals,
            progress_summary: nextSummary ?? row.progress_summary,
          };
        } else if (pruneSync) {
          await updateProgressDashboard(journeyId, {
            goals: pruneSync.user_goals,
            progressSummary: pruneSync.progress_summary,
          });
          sessionRow = {
            ...row,
            user_goals: pruneSync.user_goals,
            progress_summary: pruneSync.progress_summary ?? row.progress_summary,
          };
        }

        if (!mounted) return;
        const localPath = loadPathFromLocal(journeyId);
        const rawPath = (sessionRow as ChatSession).sustainability_path;
        const hasDbPath = Array.isArray(rawPath) && rawPath.length > 0;
        const path = hasDbPath ? normalizeSustainabilityPath(rawPath) : localPath ?? normalizeSustainabilityPath(rawPath);
        setSession({ ...sessionRow, sustainability_path: path });
      } catch (err) {
        console.error(err);
        if (mounted) {
          setLoadError(true);
          toast.error("Could not load tasks — you can still open chat.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [user, authLoading, journeyId, navigate]);

  const journey = journeyStateFromSession(session);
  const title = sessionTitle(session);

  const persistTasks = async (nextGoals: typeof journey.user_goals) => {
    if (!session) return;
    await updateProgressDashboard(session.id, { goals: nextGoals });
    setSession((prev) => (prev ? { ...prev, user_goals: nextGoals, updated_at: new Date().toISOString() } : prev));
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    if (!session) return;
    const previous = session.user_goals ?? [];
    const next = toggleGoalInList(previous, taskId, completed);
    setBusyTaskId(taskId);
    setSession((prev) => (prev ? { ...prev, user_goals: next } : prev));
    try {
      await persistTasks(next);
    } catch (err) {
      console.error(err);
      setSession((prev) => (prev ? { ...prev, user_goals: previous } : prev));
      toast.error("Could not update that task.");
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleAddTask = async (taskTitle: string) => {
    if (!session) return;
    setAdding(true);
    const previous = session.user_goals ?? [];
    const next = addUserTask(previous, taskTitle);
    setSession((prev) => (prev ? { ...prev, user_goals: next } : prev));
    try {
      await persistTasks(next);
    } catch (err) {
      console.error(err);
      setSession((prev) => (prev ? { ...prev, user_goals: previous } : prev));
      toast.error("Could not add task. Check your database migration.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveTask = async (taskId: string) => {
    if (!session) return;
    const previous = session.user_goals ?? [];
    const next = removeUserTask(previous, taskId);
    setBusyTaskId(taskId);
    setSession((prev) => (prev ? { ...prev, user_goals: next } : prev));
    try {
      await persistTasks(next);
    } catch (err) {
      console.error(err);
      setSession((prev) => (prev ? { ...prev, user_goals: previous } : prev));
      toast.error("Could not remove task.");
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleMoveTask = async (taskId: string, direction: "up" | "down") => {
    if (!session) return;
    const previous = session.user_goals ?? [];
    const next = moveGoalInList(previous, taskId, direction);
    setBusyTaskId(taskId);
    setSession((prev) => (prev ? { ...prev, user_goals: next } : prev));
    try {
      await persistTasks(next);
    } catch (err) {
      console.error(err);
      setSession((prev) => (prev ? { ...prev, user_goals: previous } : prev));
      toast.error("Could not reorder task.");
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleReorderTasks = async (fromId: string, toId: string) => {
    if (!session) return;
    const previous = session.user_goals ?? [];
    const next = reorderGoalsByDrag(previous, fromId, toId);
    setSession((prev) => (prev ? { ...prev, user_goals: next } : prev));
    try {
      await persistTasks(next);
    } catch (err) {
      console.error(err);
      setSession((prev) => (prev ? { ...prev, user_goals: previous } : prev));
      toast.error("Could not reorder tasks.");
    }
  };

  const persistPath = async (items: SustainabilityPathItem[]) => {
    if (!session) return;
    savePathToLocal(session.id, items);
    setSession((prev) => (prev ? { ...prev, sustainability_path: items } : prev));
    try {
      await updateProgressDashboard(session.id, { sustainabilityPath: items });
    } catch (err) {
      console.warn("Path saved locally; run DB migration for cloud sync.", err);
    }
  };

  const handleReorderPath = async (items: SustainabilityPathItem[]) => {
    setPathBusy(true);
    try {
      await persistPath(items);
    } finally {
      setPathBusy(false);
    }
  };

  const handleTogglePathComplete = async (id: string, completed: boolean) => {
    if (!session) return;
    const current = normalizeSustainabilityPath(session.sustainability_path);
    const next = togglePathItemComplete(current, id, completed);
    setPathBusy(true);
    try {
      await persistPath(next);
    } finally {
      setPathBusy(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Loading your session…</p>
        <Button variant="outline" className="rounded-xl" onClick={openChat}>
          <MessageCircle className="w-4 h-4 mr-2" />
          Open chat now
        </Button>
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground max-w-sm">
          Tasks could not be loaded for this journey. You can still continue the conversation with your coach.
        </p>
        <Button className="rounded-xl" onClick={openChat}>
          <MessageCircle className="w-5 h-5 mr-2" />
          Open chat
        </Button>
        <Button variant="outline" className="rounded-xl" asChild>
          <Link to="/testing/journeys">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to journeys
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] px-3 md:px-5 py-6 pb-32 md:pb-24">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <Link to="/testing/journeys">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to journeys
            </Link>
          </Button>
          <Button size="sm" className="rounded-xl" onClick={openChat}>
            <MessageCircle className="w-4 h-4 mr-1.5" />
            Open chat
          </Button>
        </div>

        <SessionTasksPanel
          journey={journey}
          displayTitle={title}
          journeyId={journeyId}
          onToggleTask={handleToggleTask}
          onAddTask={handleAddTask}
          onRemoveTask={handleRemoveTask}
          onMoveTask={handleMoveTask}
          onReorderTasks={handleReorderTasks}
          onReorderPath={handleReorderPath}
          onTogglePathComplete={handleTogglePathComplete}
          busyTaskId={busyTaskId}
          adding={adding}
          pathBusy={pathBusy}
        />
      </div>

      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-4 pointer-events-none lg:bottom-6">
        <div className="max-w-5xl mx-auto pointer-events-auto">
          <Button className="h-12 w-full rounded-xl text-base" onClick={openChat}>
            <MessageCircle className="w-5 h-5 mr-2" />
            Talk to your coach
          </Button>
        </div>
      </div>
    </div>
  );
}

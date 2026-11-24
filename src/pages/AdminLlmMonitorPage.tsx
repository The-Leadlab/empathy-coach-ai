import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type LlmStatus = {
  live?: boolean;
  provider?: string;
  reason?: string;
  endpointId?: string;
  model?: string;
  workers?: {
    ready: number;
    idle: number;
    running: number;
    initializing: number;
    throttled: number;
    unhealthy: number;
  };
  jobs?: {
    inQueue: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
  checkedAt?: string;
};

type RecentReply = {
  id: string;
  created_at: string;
  session_id: string;
  content: string;
  provider: string;
  session_name: string | null;
};

const POLL_MS = 15_000;

async function fetchLlmStatus(): Promise<LlmStatus> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "llm_status" }),
  });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}

export default function AdminLlmMonitorPage() {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [recent, setRecent] = useState<RecentReply[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      setStatus(await fetchLlmStatus());
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not load RunPod status");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const refreshRecent = useCallback(async () => {
    setLoadingRecent(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,created_at,session_id,content,generation_metadata")
      .eq("role", "assistant")
      .not("generation_metadata", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error || !data) {
      setRecent([]);
      setLoadingRecent(false);
      return;
    }

    const sessionIds = [...new Set(data.map((row) => row.session_id))];
    const nameById: Record<string, string | null> = {};
    if (sessionIds.length) {
      const { data: sessions } = await supabase
        .from("chat_sessions")
        .select("id,session_name")
        .in("id", sessionIds);
      for (const s of sessions || []) {
        nameById[s.id] = s.session_name;
      }
    }

    setRecent(
      data.map((row) => {
        const meta = (row.generation_metadata || {}) as { provider?: string };
        return {
          id: row.id,
          created_at: row.created_at,
          session_id: row.session_id,
          content: row.content || "",
          provider: meta.provider || "unknown",
          session_name: nameById[row.session_id] ?? null,
        };
      }),
    );
    setLoadingRecent(false);
  }, []);

  useEffect(() => {
    void refreshStatus();
    void refreshRecent();
    const id = window.setInterval(() => {
      void refreshStatus();
      void refreshRecent();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshStatus, refreshRecent]);

  const live = !!status?.live;
  const workers = status?.workers;
  const jobs = status?.jobs;
  const statusRows: { label: string; value: string }[] = [
    { label: "Model live", value: live ? "Yes — RunPod 14B" : "No — cold / fallback" },
    { label: "Provider", value: status?.provider || "—" },
    { label: "Model id", value: status?.model || "—" },
    { label: "Endpoint", value: status?.endpointId || "—" },
    {
      label: "Workers",
      value: workers
        ? `ready ${workers.ready} · running ${workers.running} · idle ${workers.idle} · init ${workers.initializing}`
        : "—",
    },
    {
      label: "Queue",
      value: jobs ? `in queue ${jobs.inQueue} · in progress ${jobs.inProgress}` : "—",
    },
    {
      label: "Job totals",
      value: jobs ? `completed ${jobs.completed} · failed ${jobs.failed}` : "—",
    },
    {
      label: "Last checked",
      value: status?.checkedAt ? new Date(status.checkedAt).toLocaleString() : "—",
    },
  ];
  if (status?.reason) {
    statusRows.splice(2, 0, { label: "Note", value: status.reason });
  }

  const providerCounts = recent.reduce<Record<string, number>>((acc, row) => {
    acc[row.provider] = (acc[row.provider] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold text-foreground">LLM monitor</h1>
          <p className="text-sm text-muted-foreground">
            Live RunPod status and recent coach replies by provider. Auto-refreshes every 15s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              void refreshStatus();
              void refreshRecent();
            }}
            disabled={loadingStatus}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loadingStatus && "animate-spin")} />
            Refresh
          </Button>
          <Button asChild variant="ghost" className="rounded-xl">
            <Link to="/adminchat">Chat monitor</Link>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "rounded-2xl border px-4 py-3 text-sm font-medium",
          live
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
        )}
      >
        {statusError
          ? `Could not reach status API: ${statusError}`
          : live
            ? "ShiftED RunPod model is live"
            : loadingStatus
              ? "Checking RunPod…"
              : "RunPod is not live — chat may use Groq fallback"}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">RunPod snapshot</h2>
        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[10rem]">Metric</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statusRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium text-muted-foreground">{row.label}</TableCell>
                  <TableCell className="font-mono text-xs sm:text-sm break-all">{row.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Recent assistant replies</h2>
          <p className="text-xs text-muted-foreground">
            {Object.entries(providerCounts)
              .map(([p, n]) => `${p}: ${n}`)
              .join(" · ") || (loadingRecent ? "Loading…" : "No metadata yet")}
          </p>
        </div>
        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[9rem]">When</TableHead>
                <TableHead className="w-[6rem]">Provider</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Reply</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    {loadingRecent ? "Loading recent replies…" : "No assistant replies with provider metadata yet."}
                  </TableCell>
                </TableRow>
              ) : (
                recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                          row.provider === "runpod"
                            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                            : row.provider === "fallback"
                              ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {row.provider}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[12rem] truncate" title={row.session_name || row.session_id}>
                      <Link
                        className="underline-offset-2 hover:underline"
                        to={`/testing/journeys/${row.session_id}`}
                      >
                        {row.session_name || row.session_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                      {row.content.slice(0, 120)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

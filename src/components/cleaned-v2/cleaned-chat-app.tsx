/* eslint-disable */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

function usePreviousValue<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
   
  return ref.current;
}

import {
  approveRoom,
  createRoomRevision,
  debugActivity,
  debugCleanupStuck,
  debugClearUserData,
  debugHealth,
  deleteRoom,
  getChatSession,
  emailReport,
  postChatMessage,
  postChatUpload
} from "@/lib/cleaned-v2/backend";
import { useJobCache } from "@/lib/cleaned-v2/use-job-cache";
import { createCleanedClient as createClient } from "@/lib/cleaned-v2/supabase-client";
import { RoomEditor } from "@/components/cleaned-v2/room-editor";
import type {
  ChatMessageResponse,
  ChatSessionResponse,
  JobResponse,
  RecentJobResponse,
  ReportResponse,
  RoomResponse
} from "@/lib/cleaned-v2/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingMessage = ChatMessageResponse & { pending?: boolean };
type ActiveOperation = {
  kind: "message" | "upload";
  startedAt: number;
  baseMessageCount: number;
  baseRoomCount: number;
};
type ViewMode = "jobs" | "chat" | "gallery" | "debug";

// ---------------------------------------------------------------------------
// Pure helpers (no hooks, no side-effects)
// ---------------------------------------------------------------------------

function greetingForEmail(email: string) {
  const lower = email.toLowerCase();
  if (lower.includes("horng")) return "Hola Horng";
  if (lower.includes("lukas")) return "Hola Lukas";
  return "Hola";
}

function timeLabel(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function roomFromMessage(message: ChatMessageResponse, currentJob?: JobResponse | null) {
  const roomId = typeof message.metadata.room_id === "string" ? message.metadata.room_id : (message.metadata.room as RoomResponse | undefined)?.id;
  if (roomId && currentJob) {
    const liveRoom = currentJob.rooms.find((room) => room.id === roomId);
    if (liveRoom) return liveRoom;
  }
  return (message.metadata.room as RoomResponse | undefined) || null;
}

function reportFromMessage(message: ChatMessageResponse, currentJob?: JobResponse | null) {
  const metadataReport = message.metadata.report as ReportResponse | undefined;
  // Prefer metadata report if it has a pdf_asset with access_url, otherwise fall back to job's latest_report
  if (metadataReport?.pdf_asset?.access_url) return metadataReport;
  if (currentJob?.latest_report?.pdf_asset?.access_url) return currentJob.latest_report;
  if (metadataReport) return metadataReport;
  return currentJob?.latest_report || null;
}

function statusTextForMessage(message: ChatMessageResponse) {
  if (typeof message.metadata.status_label === "string" && message.metadata.status_label.trim()) {
    return message.metadata.status_label.trim();
  }
  switch (message.message_type) {
    case "system_event":
      return message.body || "Update";
    case "job_switched":
      return "Job switched";
    case "room_created":
      return "Room ready";
    case "room_updated":
      return "Room updated";
    case "room_approved":
      return "Room approved";
    case "report_ready":
      return "Report ready";
    case "report_blocked":
      return "Report blocked";
    default:
      return "";
  }
}

function detailTextForMessage(message: ChatMessageResponse) {
  if (typeof message.metadata.status_detail === "string" && message.metadata.status_detail.trim()) {
    return message.metadata.status_detail.trim();
  }
  return message.body || "";
}

/** Convert in-progress pipeline labels to past tense for completed steps. */
const COMPLETED_LABELS: Record<string, string> = {
  "Room 1 added": "Room 1 added",
  "Room 2 added": "Room 2 added",
  "Room 3 added": "Room 3 added",
  "Analyzing room": "Room analyzed",
  "Rendering annotation": "Annotation rendered",
  "Saving room": "Room saved",
  "Generating report": "Report generated",
};

function completedLabel(label: string, isActive: boolean): string {
  if (isActive) return label;
  // Try exact match first
  if (COMPLETED_LABELS[label]) return COMPLETED_LABELS[label];
  // Handle "Room N added" pattern generically
  if (/^Room \d+ added$/i.test(label)) return label;
  // Handle generic "Analyzing ..." / "Rendering ..." / "Saving ..." / "Generating ..."
  if (label.startsWith("Analyzing ")) return label.replace("Analyzing ", "") + " analyzed";
  if (label.startsWith("Rendering ")) return label.replace("Rendering ", "") + " rendered";
  if (label.startsWith("Saving ")) return label.replace("Saving ", "") + " saved";
  if (label.startsWith("Generating ")) return label.replace("Generating ", "") + " generated";
  return label;
}

function isCompactStatusMessage(message: PendingMessage) {
  return (
    message.message_type === "system_event" ||
    message.message_type === "job_switched" ||
    message.message_type === "room_created" ||
    message.message_type === "room_updated" ||
    message.message_type === "room_approved" ||
    message.message_type === "report_ready" ||
    message.message_type === "report_blocked" ||
    Boolean(message.metadata.thinking)
  );
}

/** Filter chat messages to the ones relevant for the current context. */
function filterMessagesForJob(
  messages: PendingMessage[],
  currentJobId: string | undefined
): PendingMessage[] {
  if (currentJobId) {
    // Active job: show messages tagged to this job, plus optimistic pending
    // messages which haven't been persisted yet (they have no job_id).
    return messages.filter(
      (m) => m.job_id === currentJobId || Boolean(m.pending)
    );
  }
  // Intake / no job: only show messages with no job association.
  return messages.filter((m) => !m.job_id);
}

/** Group consecutive system_event status messages by room_id into activity cards. */
function buildActivityGroups(messages: PendingMessage[]) {
  const skipIds = new Set<string>();
  const groups = new Map<string, PendingMessage[]>();
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.message_type !== "system_event" || typeof msg.metadata?.status_label !== "string") {
      i++;
      continue;
    }
    const roomId = typeof msg.metadata?.room_id === "string" ? msg.metadata.room_id : null;
    const groupMsgs: PendingMessage[] = [msg];
    if (roomId) {
      let j = i + 1;
      while (j < messages.length) {
        const next = messages[j];
        const nextRoomId = typeof next.metadata?.room_id === "string" ? next.metadata.room_id : null;
        if (next.message_type === "system_event" && typeof next.metadata?.status_label === "string" && nextRoomId === roomId) {
          groupMsgs.push(next);
          skipIds.add(next.id);
          j++;
        } else {
          break;
        }
      }
      i = j;
    } else {
      i++;
    }
    groups.set(msg.id, groupMsgs);
  }
  return { skipIds, groups };
}

// ---------------------------------------------------------------------------
// Activity Log component for debug tab
// ---------------------------------------------------------------------------

type ActivityEvent = {
  ts: string;
  level: string;
  category: string;
  action: string;
  user: string | null;
  duration_ms: number | null;
  detail: Record<string, unknown>;
  error: string | null;
};

function ActivityLog() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{ category: string; level: string }>({ category: "", level: "" });
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await debugActivity({
        limit: 200,
        category: filter.category || undefined,
        level: filter.level || undefined,
      }) as { events: ActivityEvent[] };
      setEvents(result.events || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter.category, filter.level]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchEvents, 3000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchEvents]);

  const levelColor = (level: string) => {
    if (level === "error") return "#e55";
    if (level === "warn") return "#ea0";
    return "var(--muted)";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 14, margin: 0 }}>Activity Log ({events.length})</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select value={filter.category} onChange={(e) => setFilter(f => ({ ...f, category: e.target.value }))}
            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--separator)", background: "var(--bg)" }}>
            <option value="">All categories</option>
            {["auth", "chat", "upload", "job", "room", "report", "pipeline", "render"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={filter.level} onChange={(e) => setFilter(f => ({ ...f, level: e.target.value }))}
            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--separator)", background: "var(--bg)" }}>
            <option value="">All levels</option>
            <option value="error">errors only</option>
            <option value="warn">warnings</option>
            <option value="info">info</option>
          </select>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto
          </label>
          <button className="ghost-chip" onClick={fetchEvents} disabled={loading} type="button" style={{ fontSize: 11, padding: "3px 8px" }}>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>
      <div style={{
        maxHeight: 400, overflow: "auto", fontSize: 11, fontFamily: "monospace",
        background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--separator)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "var(--bg-secondary)", borderBottom: "1px solid var(--separator)" }}>
              <th style={{ padding: "6px 8px", textAlign: "left" }}>Time</th>
              <th style={{ padding: "6px 8px", textAlign: "left" }}>Category</th>
              <th style={{ padding: "6px 8px", textAlign: "left" }}>Action</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Duration</th>
              <th style={{ padding: "6px 8px", textAlign: "left" }}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--separator)", color: levelColor(ev.level) }}>
                <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{new Date(ev.ts).toLocaleTimeString()}</td>
                <td style={{ padding: "4px 8px" }}>{ev.category}</td>
                <td style={{ padding: "4px 8px" }}>{ev.action}</td>
                <td style={{ padding: "4px 8px", textAlign: "right" }}>
                  {ev.duration_ms != null ? `${(ev.duration_ms / 1000).toFixed(1)}s` : "—"}
                </td>
                <td style={{ padding: "4px 8px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.error ? <span style={{ color: "#e55" }}>{ev.error}</span> : JSON.stringify(ev.detail)}
                </td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "20px 8px", textAlign: "center", color: "var(--muted)" }}>No events yet</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CleanedChatApp({
  viewerEmail,
  initialJobId
}: {
  viewerEmail: string;
  initialJobId?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const hasAppliedInitialJob = useRef(false);
  const prevInitialJobId = usePreviousValue(initialJobId);
  const jobSelectorRef = useRef<HTMLDivElement>(null);
  const bootstrappedRef = useRef(false);
  const lastSessionFetchRef = useRef(0);
  const sessionVersionRef = useRef(0);

  // ---- Cache --------------------------------------------------------------
  const cache = useJobCache();

  // ---- Core state ---------------------------------------------------------
  const [accessToken, setAccessToken] = useState("");
  const [chatSession, setChatSession] = useState<ChatSessionResponse | null>(null);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(initialJobId ? "chat" : "jobs");
  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId || null);

  // ---- UI state -----------------------------------------------------------
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingRoom, setEditingRoom] = useState<RoomResponse | null>(null);
  const [editorRoomName, setEditorRoomName] = useState("");
  const [editorRoomNote, setEditorRoomNote] = useState("");
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [pendingUploadName, setPendingUploadName] = useState("");
  const [jobSelectorOpen, setJobSelectorOpen] = useState(false);
  const [emailingReportId, setEmailingReportId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  // ---- Debug tab state ----------------------------------------------------
  const debugFileRef = useRef<HTMLInputElement | null>(null);
  const [debugFile, setDebugFile] = useState<File | null>(null);
  const [debugDescription, setDebugDescription] = useState("Inspect this room for cleaning issues");
  const [debugAnalyzing, setDebugAnalyzing] = useState(false);
  const [debugRendering, setDebugRendering] = useState(false);
  const [debugSceneJson, setDebugSceneJson] = useState("");
  const [debugRawImageB64, setDebugRawImageB64] = useState("");
  const [debugRenderedUrl, setDebugRenderedUrl] = useState("");
  const [debugError, setDebugError] = useState("");
  const [debugTimings, setDebugTimings] = useState<{ analyze?: number; render?: number }>({});
  const [connectionOk, setConnectionOk] = useState(true);
  const [backendRevision, setBackendRevision] = useState("");

  // ---- Derived data -------------------------------------------------------
  // Resolve currentJob from cache (instant) or fall back to session response.
  const currentJob = activeJobId
    ? (cache.getJob(activeJobId) || chatSession?.current_job)
    : chatSession?.current_job;
  const currentJobId = activeJobId || currentJob?.id;
  const greeting = greetingForEmail(viewerEmail);
  const { recentJobs, recentJobsLoading } = cache;

  const allMessages = useMemo<PendingMessage[]>(
    () => [...(chatSession?.messages || []), ...pendingMessages] as PendingMessage[],
    [chatSession?.messages, pendingMessages]
  );

  const chatMessages = useMemo(
    () => filterMessagesForJob(allMessages, currentJobId),
    [allMessages, currentJobId]
  );

  const latestCardIndexByRoomId = useMemo(() => {
    const map = new Map<string, number>();
    chatMessages.forEach((msg, index) => {
      const roomId = msg.metadata?.room_id || (msg.metadata?.room as RoomResponse | undefined)?.id;
      if (typeof roomId === "string" && ["room_created", "room_updated", "room_approved", "room_needs_review"].includes(msg.message_type)) {
        map.set(roomId, index);
      }
    });
    return map;
  }, [chatMessages]);

  // Only expand the most recent room card globally — older rooms show as compact status lines
  const latestRoomCardIndex = useMemo(() => {
    let latest = -1;
    latestCardIndexByRoomId.forEach((idx) => { if (idx > latest) latest = idx; });
    return latest;
  }, [latestCardIndexByRoomId]);

  const activityGroupInfo = useMemo(
    () => buildActivityGroups(chatMessages),
    [chatMessages]
  );

  // ---- Navigation helper --------------------------------------------------
  // Only navigate when the job actually changes relative to the URL.
  const navigateToJob = useCallback(
    (jobId: string | undefined) => {
      if (!jobId) return;
      if (jobId !== initialJobId) {
        router.replace(`/demo-v2/cleaned/jobs/${jobId}`);
      }
    },
    [initialJobId, router]
  );

  // ---- Auth bootstrap -----------------------------------------------------
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    async function bootstrap() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/demo-v2/cleaned/login");
        return;
      }
      setAccessToken(session.access_token);
      try {
        const data = await getChatSession(session.access_token);
        lastSessionFetchRef.current = Date.now();
        setChatSession(data);
        setConnectionOk(true);
        // Seed cache with session's current job if present.
        if (data.current_job) {
          cache.putJob(data.current_job);
          setActiveJobId(data.current_job.id);
        }
      } catch (e) {
        setConnectionOk(false);
        setError(typeof e === "string" ? e : "Failed to load chat session");
      }

      // Fire-and-forget: fetch backend revision for the status indicator.
      debugHealth().then(h => setBackendRevision((h as any)?.service_info?.k_revision || "unknown")).catch(() => {});
    }

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setAccessToken(session.access_token);
      } else {
        router.replace("/demo-v2/cleaned/login");
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Apply initialJobId from URL (once per ID) --------------------------
  useEffect(() => {
    // Reset the guard when the URL-level job changes (navigating between jobs)
    if (prevInitialJobId && prevInitialJobId !== initialJobId) {
      hasAppliedInitialJob.current = false;
    }
    if (!accessToken || !chatSession || !initialJobId || hasAppliedInitialJob.current) return;
    hasAppliedInitialJob.current = true;
    // Instantly switch the active job from cache if available.
    setActiveJobId(initialJobId);
    if (chatSession.current_job?.id === initialJobId) return;
    void handleSend({ selectedJobId: initialJobId });
     
  }, [accessToken, chatSession, initialJobId, prevInitialJobId]);

  // ---- Load recent jobs eagerly (for the dropdown + Jobs tab) -------------
  useEffect(() => {
    if (!accessToken) return;
    void cache.refreshRecentJobs(accessToken);
   
  }, [accessToken, activeJobId]);

  // ---- Close job selector on outside click --------------------------------
  useEffect(() => {
    if (!jobSelectorOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (jobSelectorRef.current && !jobSelectorRef.current.contains(e.target as Node)) {
        setJobSelectorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [jobSelectorOpen]);

  // ---- Auto-scroll chat ---------------------------------------------------
  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, selectedFile, currentJobId]);

  // ---- Polling during active operations -----------------------------------
  useEffect(() => {
    if (!accessToken || !activeOperation) return;
    let cancelled = false;
    let noChangePollCount = 0;
    let timeoutId: number;

    const poll = async () => {
      if (cancelled) return;
      const versionBefore = sessionVersionRef.current;
      try {
        const data = await getChatSession(accessToken);
        if (cancelled) return;
        // If the session was updated by another handler (e.g. upload) while we
        // were polling, discard this stale response.
        if (sessionVersionRef.current !== versionBefore) return;
        const hasFreshMessages =
          data.messages.length > activeOperation.baseMessageCount ||
          data.messages.some((m) => Date.parse(m.created_at) >= activeOperation.startedAt - 1500);
        const hasRoomChange = (data.current_job?.rooms.length ?? 0) !== activeOperation.baseRoomCount;

        setChatSession(data);
        if (hasFreshMessages || hasRoomChange) {
          noChangePollCount = 0;
          setPendingMessages([]);
        } else {
          noChangePollCount++;
        }

        // Auto-clear activeOperation when the expected result arrives
        const recentEnough = (m: { created_at: string }) =>
          Date.parse(m.created_at) >= activeOperation.startedAt - 1500;

        if (activeOperation.kind === "upload" && hasRoomChange) {
          // Room processing complete — new room appeared
          setActiveOperation(null);
          setPendingMessages([]);
          return;
        }
        const hasRoomCard = activeOperation.kind === "upload" && data.messages.some(
          (m: { message_type: string; created_at: string }) =>
            m.message_type === "room_created" && recentEnough(m)
        );
        if (hasRoomCard) {
          setActiveOperation(null);
          setPendingMessages([]);
          return;
        }
        const hasReportReady = data.messages.some(
          (m: { message_type: string; created_at: string }) =>
            m.message_type === "report_ready" && recentEnough(m)
        );
        if (hasReportReady) {
          setActiveOperation(null);
          return;
        }

        // Safety timeout: if upload polling has been running > 90s with no result, stop
        if (activeOperation.kind === "upload" && Date.now() - activeOperation.startedAt > 90_000) {
          setActiveOperation(null);
          setPendingMessages([]);
          return;
        }
      } catch {
        // Keep optimistic state during network drops
      } finally {
        if (!cancelled) {
          const delay = Math.min(1200 * Math.pow(1.6, noChangePollCount), 5000);
          timeoutId = window.setTimeout(() => void poll(), delay);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [accessToken, activeOperation]);

  // ---- Actions ------------------------------------------------------------

  /** Sync chat session state from backend (messages, stage, etc). */
  async function refreshSession(token = accessToken) {
    if (Date.now() - lastSessionFetchRef.current < 1000) return;
    const data = await getChatSession(token);
    lastSessionFetchRef.current = Date.now();
    setChatSession(data);
    setPendingMessages([]);
    setPendingUploadName("");
    // Update cache with the fresh job from the session response.
    if (data.current_job) {
      cache.putJob(data.current_job);
      setActiveJobId(data.current_job.id);
    } else {
      setActiveJobId(null);
    }
  }

  // ---- Debug tab handlers --------------------------------------------------

  async function debugAnalyze() {
    if (!debugFile) return;
    setDebugError("");
    setDebugAnalyzing(true);
    setDebugRenderedUrl("");
    setDebugSceneJson("");
    setDebugRawImageB64("");
    const t0 = Date.now();
    try {
      const formData = new FormData();
      formData.append("image", debugFile);
      formData.append("description", debugDescription);
      const res = await fetch("/demo-v2/cleaned/api/process", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const data = await res.json();
      const analyzeMs = Date.now() - t0;
      setDebugTimings((prev) => ({ ...prev, analyze: analyzeMs }));
      setDebugRawImageB64(data.raw_image || "");
      // Build scene JSON from the response
      const scene = {
        issues: data.issues || [],
        exclusions: data.exclusions || [],
        praise: data.praise || [],
        location_name: data.location_name || "Room",
        location_specified: false,
        header_title: "Debug Test",
        is_inspection_complete: data.is_inspection_complete || false,
        frontend_panel_rect: data.frontend_panel_rect || [],
      };
      const sceneStr = JSON.stringify(scene, null, 2);
      setDebugSceneJson(sceneStr);
      // Auto-render
      await debugRender(data.raw_image, sceneStr);
    } catch (e: unknown) {
      setDebugError(e instanceof Error ? e.message : String(e));
    } finally {
      setDebugAnalyzing(false);
    }
  }

  async function debugRender(rawB64?: string, sceneStr?: string) {
    const raw = rawB64 || debugRawImageB64;
    const scene = sceneStr || debugSceneJson;
    if (!raw || !scene) {
      setDebugError("Need both a raw image and scene JSON to render");
      return;
    }
    setDebugError("");
    setDebugRendering(true);
    const t0 = Date.now();
    try {
      const parsedScene = JSON.parse(scene);
      const formData = new FormData();
      formData.append("scene", JSON.stringify(parsedScene));
      formData.append("raw_image", `data:image/png;base64,${raw}`);
      const res = await fetch("/demo-v2/cleaned/api/render-annotated", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const blob = await res.blob();
      const renderMs = Date.now() - t0;
      setDebugTimings((prev) => ({ ...prev, render: renderMs }));
      // Revoke previous URL
      if (debugRenderedUrl) URL.revokeObjectURL(debugRenderedUrl);
      setDebugRenderedUrl(URL.createObjectURL(blob));
    } catch (e: unknown) {
      setDebugError(e instanceof Error ? e.message : String(e));
    } finally {
      setDebugRendering(false);
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSignOut() {
    cache.clearAll();
    await supabase.auth.signOut();
    router.replace("/demo-v2/cleaned/login");
    router.refresh();
  }

  async function handleClearData() {
    if (!accessToken) return;
    if (!window.confirm("This will delete ALL your jobs, chat history, rooms, and reports. Continue?")) return;
    setBusy(true);
    try {
      const result = await debugClearUserData(accessToken);
      console.log("[debug] clear-user-data result:", result);
      cache.clearAll();
      setChatSession(null);
      setPendingMessages([]);
      setActiveJobId(null);
      setActiveOperation(null);
      // Re-bootstrap a fresh session
      const fresh = await getChatSession(accessToken);
      setChatSession(fresh);
      setViewMode("jobs");
      void cache.refreshRecentJobs(accessToken);
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to clear data");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend({
    presetBody,
    selectedJobId
  }: {
    presetBody?: string;
    selectedJobId?: string;
  } = {}) {
    if (!accessToken || busy) return;
    const body = (presetBody ?? messageText).trim();
    if (!body && !selectedJobId) return;

    // -- Optimistic UI --
    const optimistic: PendingMessage | null = body
      ? {
          id: `pending-${Date.now()}`,
          direction: "user",
          message_type: "user_text",
          body,
          metadata: {},
          created_at: new Date().toISOString(),
          pending: true
        }
      : null;
    const statusMessage: PendingMessage = selectedJobId
      ? {
          id: `pending-status-${Date.now()}`,
          direction: "system",
          message_type: "job_switched",
          body: "Switching job context",
          metadata: {
            thinking: true,
            status_label: "Switching job",
            status_detail: "Loading the selected inspection context."
          },
          created_at: new Date().toISOString(),
          pending: true
        }
      : {
          id: `pending-status-${Date.now()}`,
          direction: "system",
          message_type: "system_event",
          body: currentJob ? "Updating inspection chat" : "Updating job setup",
          metadata: {
            thinking: true,
            status_label: currentJob ? "Working on it" : "Updating job",
            status_detail: currentJob
              ? "Saving your latest message and deciding the next step."
              : "Adding details and moving the job setup forward."
          },
          created_at: new Date().toISOString(),
          pending: true
        };

    setPendingMessages((prev) =>
      optimistic ? [...prev, optimistic, statusMessage] : [...prev, statusMessage]
    );
    setActiveOperation({
      kind: "message",
      startedAt: Date.now(),
      baseMessageCount: chatSession?.messages.length ?? 0,
      baseRoomCount: currentJob?.rooms.length ?? 0
    });
    setBusy(true);
    setError("");
    setMessageText("");

    try {
      const next = await postChatMessage(accessToken, {
        body: body || null,
        selected_job_id: selectedJobId || null
      });
      setChatSession(next);
      setPendingMessages([]);
      setConnectionOk(true);

      // Update cache with the fresh job from the response.
      if (next.current_job) {
        cache.putJob(next.current_job);
        setActiveJobId(next.current_job.id);
        navigateToJob(next.current_job.id);
      } else {
        setActiveJobId(null);
      }
      // Refresh recent jobs list after any job-related action.
      void cache.refreshRecentJobs(accessToken);
    } catch (e) {
      setConnectionOk(false);
      setError(typeof e === "string" ? e : "Failed to send message");
      setPendingMessages([]);
      if (body) setMessageText(body);
    } finally {
      setBusy(false);
      setActiveOperation(null);
    }
  }

  async function handleUpload() {
    if (!accessToken || !selectedFile || !currentJob || busy) return;
    const file = selectedFile;
    const note = messageText.trim();
    const optimistic: PendingMessage = {
      id: `pending-upload-${Date.now()}`,
      direction: "user",
      message_type: "user_text",
      body: note || "Uploaded a room photo",
      metadata: { has_image: true, file_name: file.name },
      created_at: new Date().toISOString(),
      pending: true
    };
    const processingMessage: PendingMessage = {
      id: `pending-processing-${Date.now()}`,
      direction: "system",
      message_type: "system_event",
      body: `Processing ${file.name}...`,
      metadata: {
        processing_upload: true,
        thinking: true,
        file_name: file.name,
        status_label: "Processing room photo",
        status_detail: "Analyzing the image, writing findings, and preparing the review card."
      },
      created_at: new Date().toISOString(),
      pending: true
    };
    setPendingMessages((prev) => [...prev, optimistic, processingMessage]);
    setActiveOperation({
      kind: "upload",
      startedAt: Date.now(),
      baseMessageCount: chatSession?.messages.length ?? 0,
      baseRoomCount: currentJob.rooms.length
    });
    setBusy(true);
    setError("");
    setMessageText("");
    clearSelectedFile();
    setPendingUploadName(file.name);

    try {
      const next = await postChatUpload(accessToken, { file, note });
      // Bump version so any in-flight poll discards its stale response
      sessionVersionRef.current++;
      setChatSession(next);
      // Keep pending "Processing..." message visible — polling will clear it
      // when room_card arrives or room count changes.
      setPendingUploadName("");
      setConnectionOk(true);
      // Cache the updated job (which now includes the new room).
      if (next.current_job) {
        cache.putJob(next.current_job);
      }
      // Don't clear activeOperation here — let polling continue until
      // the background room processing completes and a room_card arrives.
    } catch (e) {
      setConnectionOk(false);
      setError(typeof e === "string" ? e : "Failed to upload room");
      setPendingMessages([]);
      setMessageText(note);
      setSelectedFile(file);
      setPendingUploadName("");
      setActiveOperation(null);
    } finally {
      setBusy(false);
    }
  }

  function handleNewInspection() {
    if (!accessToken || busy) return;
    setViewMode("chat");
    void handleSend({ presetBody: "start new job" });
  }

  function handleJobSelect(jobId: string) {
    setJobSelectorOpen(false);
    if (jobId === currentJobId) return;
    // Instantly switch to cached job data.
    setActiveJobId(jobId);
    setViewMode("chat");
    // Sync the backend session in the background.
    void handleSend({ selectedJobId: jobId });
  }

  function openEditor(room: RoomResponse) {
    if (!room.latest_revision) return;
    setEditingRoom(room);
    setEditorRoomName(room.room_name);
    setEditorRoomNote(room.supervisor_note);
  }

  async function saveEditor(roomName: string, supervisorNote: string, sceneJson: Record<string, unknown>) {
    if (!accessToken || !editingRoom) return;
    const targetRoomId = editingRoom.id;
    setEditingRoom(null);
    setBusyRoomId(targetRoomId);
    setError("");
    try {
      const updatedJob = await createRoomRevision(accessToken, targetRoomId, {
        scene_json: sceneJson,
        room_name: roomName.trim() || null,
        supervisor_note: supervisorNote.trim() || null
      });
      // Use mutation response directly — no full session refetch needed.
      cache.putJob(updatedJob);
      // Refresh chat messages (session state) in the background.
      refreshSession().catch(() => {});
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to save room revision");
    } finally {
      setBusyRoomId(null);
    }
  }

  async function handleApprove(room: RoomResponse) {
    if (!accessToken || busyRoomId) return;
    setBusyRoomId(room.id);
    setError("");
    try {
      const updatedJob = await approveRoom(accessToken, room.id);
      // Use mutation response directly — instant UI update.
      cache.putJob(updatedJob);
      // Refresh chat messages in the background.
      refreshSession().catch(() => {});
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to approve room");
    } finally {
      setBusyRoomId(null);
    }
  }

  async function handleDeleteRoom(room: RoomResponse) {
    if (!accessToken || busyRoomId) return;
    if (!window.confirm(`Delete "${room.room_name}"? This cannot be undone.`)) return;
    setBusyRoomId(room.id);
    setError("");
    try {
      const updatedJob = await deleteRoom(accessToken, room.id);
      // Use mutation response directly.
      cache.putJob(updatedJob);
      setChatSession((prev) => (prev ? { ...prev, current_job: updatedJob } : prev));
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to delete room");
    } finally {
      setBusyRoomId(null);
    }
  }

  function handleRespond(room: RoomResponse) {
    setViewMode("chat");
    setMessageText(`Regarding "${room.room_name}": `);
    setTimeout(() => {
      chatInputRef.current?.focus();
      chatScrollRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  // ---- Render helpers -----------------------------------------------------

  const renderRoomCard = (room: RoomResponse) => (
    <article key={room.id} className="room-card">
      {room.latest_revision?.rendered_asset?.access_url ? (
        <div style={{ position: "relative" }}>
          <img alt={room.room_name} src={room.latest_revision.rendered_asset.access_url} />
          {busyRoomId === room.id ? (
            <div className="room-saving-overlay">Saving…</div>
          ) : null}
        </div>
      ) : null}
      <div className="room-card-body">
        <div className="badge-row">
          <span className={`badge ${room.status}`}>{room.status.replace("_", " ")}</span>
          <span className={`badge ${room.approval_status === "approved" ? "approved" : "needs_review"}`}>
            {room.approval_status}
          </span>
        </div>
        <h3>
          {room.sequence_number}. {room.room_name}
        </h3>
        <p>{room.supervisor_note}</p>
        {room.latest_revision?.summary_json?.checklist?.length ? (
          <ul className="room-checklist">
            {room.latest_revision.summary_json.checklist.map((item, index) => (
              <li key={`${room.id}-${index}`}>
                <span>{item.type}</span>
                <strong>{item.text}</strong>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="room-actions">
          <button className="ghost-chip" onClick={() => openEditor(room)} type="button">
            Edit
          </button>
          <button className="ghost-chip" onClick={() => handleRespond(room)} type="button">
            Respond
          </button>
          {viewMode === "gallery" ? (
            <button
              className="ghost-chip danger"
              disabled={!!busyRoomId}
              onClick={() => void handleDeleteRoom(room)}
              type="button"
            >
              {busyRoomId === room.id ? "Deleting..." : "Delete"}
            </button>
          ) : null}
          <button
            className="primary-button compact"
            disabled={room.status === "processing" || room.status === "failed" || room.approval_status === "approved" || busyRoomId === room.id}
            onClick={() => handleApprove(room)}
            type="button"
          >
            {busyRoomId === room.id ? "Processing..." : room.approval_status === "approved" ? "Approved" : "Approve"}
          </button>
        </div>
      </div>
    </article>
  );

  // ---- JSX ----------------------------------------------------------------

  return (
    <div className="chat-shell">
      {/* Header */}
      <header className="chat-header">
        <div className="brand-row">
          <div className="brand-mark">C</div>
          <h1>{viewMode === "jobs" ? `${greeting}` : (currentJob?.site_name || `${greeting}`)}</h1>
        </div>
        <div className="header-actions">
          <div className="view-toggle">
            <button className={viewMode === "jobs" ? "active" : ""} onClick={() => setViewMode("jobs")} type="button">Jobs</button>
            <button className={viewMode === "chat" ? "active" : ""} onClick={() => setViewMode("chat")} type="button">Chat</button>
            <button className={viewMode === "gallery" ? "active" : ""} onClick={() => setViewMode("gallery")} type="button">Gallery</button>
            <button className={viewMode === "debug" ? "active" : ""} onClick={() => setViewMode("debug")} type="button">Debug</button>
          </div>
          {/* Job selector dropdown */}
          <div className={`job-selector${jobSelectorOpen ? " open" : ""}`} ref={jobSelectorRef}>
            <button
              className="job-selector-trigger"
              onClick={() => setJobSelectorOpen((v) => !v)}
              type="button"
            >
              <span className="job-selector-name">
                {currentJob?.site_name || "Select job"}
              </span>
              <span className="job-selector-chevron" aria-hidden>▼</span>
            </button>
            <div className="job-selector-panel">
              {recentJobs.length === 0 ? (
                <div className="job-selector-empty">
                  {recentJobsLoading ? "Loading…" : "No jobs yet"}
                </div>
              ) : (
                recentJobs.map((job) => (
                  <button
                    key={job.id}
                    className={`job-selector-item${job.id === currentJobId ? " active" : ""}`}
                    disabled={busy}
                    onClick={() => handleJobSelect(job.id)}
                    type="button"
                  >
                    <span className="job-selector-item-name">{job.site_name}</span>
                    <span className="job-selector-item-meta">
                      {job.site_address || "No address"} · {job.cleaner_name || "No cleaner"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <span
            className="connection-dot"
            title={connectionOk ? `Connected${backendRevision ? ` (${backendRevision})` : ""}` : "Connection error"}
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: connectionOk ? "#34c759" : "#ff3b30",
              marginRight: 8,
              flexShrink: 0,
            }}
          />
          <button className="ghost-chip" onClick={handleClearData} disabled={busy} type="button" style={{ color: "#e55" }}>
            Clear data
          </button>
          <button className="ghost-chip" onClick={async () => {
            if (!accessToken) return;
            try {
              const r = await debugCleanupStuck(accessToken);
              console.log("[debug] cleanup-stuck:", r);
              refreshSession();
            } catch (e) { console.error(e); }
          }} disabled={busy} type="button" style={{ fontSize: "0.7rem" }}>
            Fix stuck
          </button>
          <button className="ghost-chip" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      {/* Jobs panel */}
      {viewMode === "jobs" ? (
        <main className="gallery-main jobs-panel">
          <button
            className="job-new-card"
            disabled={busy}
            onClick={handleNewInspection}
            type="button"
          >
            <span className="job-new-icon">+</span>
            <strong>New Inspection</strong>
            <span>Start a fresh job via chat</span>
          </button>
          {recentJobsLoading ? (
            <div className="jobs-loading">Loading jobs…</div>
          ) : recentJobs.map((job) => (
            <Link key={job.id} href={`/demo-v2/cleaned/jobs/${job.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <article className="room-card job-card">
                <div className="room-card-body">
                  <div className="badge-row">
                    <span className={`badge ${job.status}`}>{job.status}</span>
                  </div>
                  <h3>{job.site_name}</h3>
                  <p>{job.site_address || "No address"}</p>
                  <p className="job-card-meta">
                    {job.cleaner_name || "No cleaner"} · Updated {new Date(job.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </main>

      /* Chat view */
      ) : viewMode === "chat" ? (
        <>
          <main className="chat-main" ref={chatScrollRef}>
            {chatMessages.map((message, index) => {
              if (activityGroupInfo.skipIds.has(message.id)) return null;

              const activityGroup = activityGroupInfo.groups.get(message.id);
              if (activityGroup) {
                return (
                  <div key={message.id} className={`thread-row status${message.pending ? " pending" : ""}`}>
                    <div className="activity-card status-stack">
                      {activityGroup.map((step, stepIdx) => {
                        const isActive = Boolean(step.metadata.thinking);
                        return (
                          <div
                            key={step.id}
                            className={`activity-step${isActive ? " active" : ""}`}
                            style={{ animationDelay: `${stepIdx * 55}ms` }}
                          >
                            <div className="activity-step-icon" aria-hidden="true">
                              {isActive ? (
                                <span className="activity-step-spinner" />
                              ) : (
                                <svg className="activity-step-check" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                                  <path d="M4.5 7l1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div className="activity-step-body">
                              <span className="activity-step-label">{completedLabel(String(step.metadata.status_label), isActive)}</span>
                              {step.metadata.status_detail ? (
                                <span className="activity-step-detail">{String(step.metadata.status_detail)}</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const room = roomFromMessage(message, currentJob);
              const report = reportFromMessage(message, currentJob);
              const candidates = Array.isArray(message.metadata.candidates)
                ? (message.metadata.candidates as RecentJobResponse[])
                : [];
              const isCompactStatus = isCompactStatusMessage(message);
              const isThinking = Boolean(message.metadata.thinking);
              const isRoomVisualType = ["room_created", "room_updated", "room_approved", "room_needs_review"].includes(message.message_type);
              const isObsoleteCard = isRoomVisualType && room && (latestCardIndexByRoomId.get(room.id) !== index || index !== latestRoomCardIndex);

              const hasCard =
                (room && isRoomVisualType && !isObsoleteCard) ||
                (message.message_type === "report_ready" && Boolean(report?.pdf_asset)) ||
                message.message_type === "report_blocked" ||
                (message.message_type === "clarification_needed" && candidates.length > 0);

              return (
                <div
                  key={message.id}
                  className={`thread-row ${isCompactStatus ? "status" : message.direction} ${message.pending ? "pending" : ""}`}
                >
                  <div className={isCompactStatus ? "status-stack" : `bubble ${message.direction} ${message.pending ? "pending" : ""}`}>
                    {isCompactStatus ? (
                      isThinking ? (
                        <div className="typing-bubble" aria-live="polite">
                          <div className="typing-dots" aria-hidden="true">
                            <span /><span /><span />
                          </div>
                          {detailTextForMessage(message) ? (
                            <span className="typing-subtitle">{detailTextForMessage(message)}</span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="status-line">
                          <div className="status-copy">
                            <span className="status-label">
                              {statusTextForMessage(message)}
                            </span>
                            {detailTextForMessage(message) && !hasCard ? (
                              <span className="status-detail">{detailTextForMessage(message)}</span>
                            ) : null}
                            {isRoomVisualType && isObsoleteCard && room ? (
                              <button className="ghost-chip" onClick={() => openEditor(room)} type="button" style={{ marginLeft: 8, fontSize: "0.75rem" }}>View &rarr;</button>
                            ) : null}
                          </div>
                          <span className="status-time">{timeLabel(message.created_at)}</span>
                        </div>
                      )
                    ) : message.body ? (
                      <p>{message.body} {isObsoleteCard ? "(Superseded)" : ""}</p>
                    ) : null}

                    {room && isRoomVisualType && !isObsoleteCard ? renderRoomCard(room) : null}

                    {message.message_type === "report_ready" && report?.pdf_asset ? (
                      <div className="report-card">
                        <span className="report-pill">PDF ready</span>
                        <div>
                          <strong>Report v{report.version_number}</strong>
                          <p>Open or email the inspection report.</p>
                        </div>
                        <div className="report-actions">
                          <a className="primary-button compact" href={report.pdf_asset.access_url} rel="noreferrer" target="_blank">
                            Open PDF
                          </a>
                          <button
                            className="primary-button compact secondary"
                            onClick={() => {
                              setEmailingReportId(emailingReportId === report.id ? null : report.id);
                              setEmailSent(null);
                            }}
                          >
                            Email
                          </button>
                        </div>
                        {emailingReportId === report.id ? (
                          <div className="email-input-row">
                            {emailSent ? (
                              <p className="email-sent">Sent to {emailSent}</p>
                            ) : (
                              <>
                                <input
                                  type="email"
                                  placeholder="recipient@example.com"
                                  value={emailInput}
                                  onChange={(e) => setEmailInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && emailInput && !emailSending) {
                                      e.preventDefault();
                                      document.getElementById("email-send-btn")?.click();
                                    }
                                  }}
                                />
                                <button
                                  id="email-send-btn"
                                  className="primary-button compact"
                                  disabled={emailSending || !emailInput}
                                  onClick={async () => {
                                    setEmailSending(true);
                                    try {
                                      await emailReport(accessToken, report.id, emailInput);
                                      setEmailSent(emailInput);
                                      setEmailInput("");
                                    } catch (e) {
                                      setError(typeof e === "string" ? e : "Failed to send email");
                                    } finally {
                                      setEmailSending(false);
                                    }
                                  }}
                                >
                                  {emailSending ? "Sending…" : "Send"}
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {message.message_type === "report_blocked" ? (
                      <div className="report-card blocked">
                        <span className="report-pill blocked">Blocked</span>
                        <div>
                          <strong>Unapproved rooms</strong>
                          <p>{message.body}</p>
                          {Array.isArray(message.metadata.unapproved_rooms) ? (
                            <ul className="blocked-list">
                              {(message.metadata.unapproved_rooms as Array<{ sequence_number: number; room_name: string }>).map((item) => {
                                const targetRoom = currentJob?.rooms.find((r) => r.sequence_number === item.sequence_number && r.room_name === item.room_name);
                                return (
                                  <li key={`${item.sequence_number}-${item.room_name}`}>
                                    {targetRoom ? (
                                      <button
                                        className="ghost-chip"
                                        onClick={() => openEditor(targetRoom)}
                                        type="button"
                                        style={{ margin: "2px 0", textAlign: "left" }}
                                      >
                                        {item.sequence_number}. {item.room_name} <span>&rarr;</span>
                                      </button>
                                    ) : (
                                      <span>{item.sequence_number}. {item.room_name}</span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {message.message_type === "clarification_needed" && candidates.length ? (
                      <div className="choice-card">
                        {candidates.map((candidate) => (
                          <button
                            key={candidate.id}
                            className="choice-button"
                            disabled={busy}
                            onClick={() => handleSend({ selectedJobId: candidate.id })}
                            type="button"
                          >
                            <strong>{candidate.site_name}</strong>
                            <span>{candidate.site_address || "No address"} • {candidate.cleaner_name || "No cleaner"}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {!isCompactStatus ? <span className="timestamp">{timeLabel(message.created_at)}</span> : null}
                  </div>
                </div>
              );
            })}
          </main>

          <footer className="composer-shell">
            {chatSession?.suggested_actions?.length ? (
              <div className="suggested-actions">
                {chatSession.suggested_actions.map((action) => (
                  <button
                    key={action.value}
                    className="ghost-chip"
                    disabled={busy}
                    onClick={() => handleSend({ presetBody: action.value })}
                    type="button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            {selectedFile ? (
              <div className="attachment-preview">
                <span>{selectedFile.name}</span>
                <button onClick={clearSelectedFile} type="button">
                  Remove
                </button>
              </div>
            ) : null}

            {error ? <p className="chat-error">{error}</p> : null}

            <div className="composer-row">
              <button
                className="attach-button"
                disabled={!currentJob || busy}
                onClick={() => fileInputRef.current?.click()}
                title={currentJob ? "Attach room photo" : "Create or switch to a job first"}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
              <input
                accept="image/*"
                hidden
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                ref={fileInputRef}
                type="file"
              />
              <textarea
                className="composer-input"
                ref={chatInputRef}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (selectedFile) {
                      void handleUpload();
                    } else {
                      void handleSend();
                    }
                  }
                }}
                placeholder={
                  currentJob
                    ? "Add a room note, switch jobs, or ask for the report..."
                    : "Reply to the assistant to set up the job..."
                }
                rows={1}
                value={messageText}
              />
              <button
                className="primary-button send-button"
                disabled={busy || (!selectedFile && !messageText.trim())}
                onClick={() => {
                  if (selectedFile) {
                    void handleUpload();
                  } else {
                    void handleSend();
                  }
                }}
                type="button"
              >
                {busy ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 6v6"/><circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" style={{animation: 'activitySpin 1s linear infinite'}}/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                )}
              </button>
            </div>
          </footer>
        </>

      /* Debug view */
      ) : viewMode === "debug" ? (
        <main className="gallery-main" style={{ display: "block", padding: "var(--space-4)", overflow: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900, margin: "0 auto" }}>
            {/* Upload + Analyze */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                ref={debugFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => setDebugFile(e.target.files?.[0] || null)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <input
                type="text"
                value={debugDescription}
                onChange={(e) => setDebugDescription(e.target.value)}
                placeholder="Description for Gemini"
                style={{ flex: 2, minWidth: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--separator)", fontSize: 13, background: "var(--bg)" }}
              />
              <button
                className="primary-button compact"
                disabled={!debugFile || debugAnalyzing}
                onClick={() => void debugAnalyze()}
                type="button"
              >
                {debugAnalyzing ? "Analyzing..." : "Analyze + Render"}
              </button>
            </div>

            {debugError ? <p style={{ color: "#e55", fontSize: 13, margin: 0 }}>{debugError}</p> : null}

            {debugTimings.analyze || debugTimings.render ? (
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                {debugTimings.analyze ? `Analysis: ${(debugTimings.analyze / 1000).toFixed(1)}s` : ""}
                {debugTimings.analyze && debugTimings.render ? " · " : ""}
                {debugTimings.render ? `Render: ${(debugTimings.render / 1000).toFixed(1)}s` : ""}
              </p>
            ) : null}

            {/* Rendered result */}
            {debugRenderedUrl ? (
              <div>
                <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>Rendered Output</h3>
                <img
                  src={debugRenderedUrl}
                  alt="Rendered"
                  style={{ width: "100%", borderRadius: 8, border: "1px solid var(--separator)" }}
                />
              </div>
            ) : null}

            {/* Scene JSON editor + re-render */}
            {debugSceneJson ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: 14, margin: 0 }}>Scene JSON</h3>
                  <button
                    className="primary-button compact"
                    disabled={debugRendering || !debugRawImageB64}
                    onClick={() => void debugRender()}
                    type="button"
                  >
                    {debugRendering ? "Rendering..." : "Re-render"}
                  </button>
                </div>
                <textarea
                  value={debugSceneJson}
                  onChange={(e) => setDebugSceneJson(e.target.value)}
                  spellCheck={false}
                  style={{
                    width: "100%",
                    minHeight: 300,
                    fontFamily: "monospace",
                    fontSize: 11,
                    lineHeight: 1.4,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid var(--separator)",
                    background: "var(--bg-secondary)",
                    color: "var(--text)",
                    resize: "vertical",
                  }}
                />
              </div>
            ) : null}

            {/* Activity Log */}
            <ActivityLog />
          </div>
        </main>

      /* Gallery view */
      ) : (
        <main className="gallery-main">
          {currentJob?.rooms.length ? (
            currentJob.rooms.map((room) => renderRoomCard(room))
          ) : (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "var(--muted)" }}>
              No rooms yet. Switch to Chat to upload some.
            </div>
          )}
        </main>
      )}

      {/* Room editor modal */}
      {editingRoom ? (
        <RoomEditor
          room={editingRoom}
          initialRoomName={editorRoomName}
          initialSupervisorNote={editorRoomNote}
          onClose={() => setEditingRoom(null)}
          onSave={saveEditor}
          onApprove={async () => {
            const target = chatSession?.current_job?.rooms.find((r) => r.id === editingRoom.id);
            setEditingRoom(null);
            if (target) {
              await handleApprove(target);
            }
          }}
          onRespond={async (note) => {
            const currentEditingRoom = editingRoom;
            setEditingRoom(null);
            if (currentEditingRoom) {
              const contextualMessage = `Regarding room "${currentEditingRoom.room_name}": ${note}`;
              await handleSend({ presetBody: contextualMessage });
            }
          }}
        />
      ) : null}
    </div>
  );
}

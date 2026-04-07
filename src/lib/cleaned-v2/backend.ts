"use client";

import type { ChatSessionResponse, JobResponse, RecentJobResponse } from "./types";

// All API calls go through the local Next.js proxy to avoid CORS.
const API_PREFIX = "/demo-v2/cleaned/api";

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? payload.detail : payload;
    throw detail;
  }
  return payload;
}

async function backendFetch<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);

  let attempt = 0;
  const maxRetries = 3;

  while (true) {
    try {
      const fetchUrl = new URL(`${API_PREFIX}${path}`, window.location.origin);
      if (attempt > 0) fetchUrl.searchParams.set("_cb", Date.now().toString());

      const response = await fetch(fetchUrl.toString(), { ...init, headers });

      if (!response.ok && [502, 503, 504].includes(response.status) && attempt < maxRetries) {
        throw new Error(`Transient HTTP ${response.status}`);
      }

      return (await parseResponse(response)) as Promise<T>;
    } catch (e: unknown) {
      const isTypeError = e instanceof TypeError && e.message.includes("Failed to fetch");
      const isTransient = e instanceof Error && e.message.includes("Transient HTTP");

      if ((isTypeError || isTransient) && attempt < maxRetries) {
        attempt++;
        const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 5000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw e;
    }
  }
}

export async function getChatSession(accessToken: string): Promise<ChatSessionResponse> {
  return backendFetch<ChatSessionResponse>("/v2/chat/session", accessToken);
}

export async function postChatMessage(
  accessToken: string,
  payload: { body?: string | null; selected_job_id?: string | null }
): Promise<ChatSessionResponse> {
  return backendFetch<ChatSessionResponse>("/v2/chat/messages", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export async function postChatUpload(
  accessToken: string,
  payload: { file: File; note?: string }
): Promise<ChatSessionResponse> {
  const formData = new FormData();
  formData.append("image", payload.file);
  if (payload.note) formData.append("note", payload.note);
  return backendFetch<ChatSessionResponse>("/v2/chat/uploads", accessToken, {
    method: "POST",
    headers: { "X-Idempotency-Key": crypto.randomUUID() },
    body: formData,
  });
}

export async function createRoomRevision(
  accessToken: string,
  roomId: string,
  payload: { scene_json: Record<string, unknown>; room_name?: string | null; supervisor_note?: string | null }
): Promise<JobResponse> {
  return backendFetch<JobResponse>(`/v2/rooms/${roomId}/revisions`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export async function deleteRoom(accessToken: string, roomId: string): Promise<JobResponse> {
  return backendFetch<JobResponse>(`/v2/rooms/${roomId}`, accessToken, { method: "DELETE" });
}

export async function approveRoom(accessToken: string, roomId: string): Promise<JobResponse> {
  return backendFetch<JobResponse>(`/v2/rooms/${roomId}/approve`, accessToken, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
}

export async function getJob(accessToken: string, jobId: string): Promise<JobResponse> {
  return backendFetch<JobResponse>(`/v2/jobs/${jobId}`, accessToken);
}

export async function createJob(accessToken: string, payload: { site_name: string }): Promise<JobResponse> {
  return backendFetch<JobResponse>("/v2/jobs", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export async function listRecentJobs(accessToken: string): Promise<RecentJobResponse[]> {
  return backendFetch<RecentJobResponse[]>("/v2/jobs/recent", accessToken);
}

export async function debugClearUserData(accessToken: string): Promise<Record<string, unknown>> {
  return backendFetch<Record<string, unknown>>("/v2/debug/clear-user-data", accessToken, { method: "POST" });
}

export async function debugHealth(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_PREFIX}/v2/debug/health`);
  return res.json();
}

export async function debugActivity(opts?: { limit?: number; category?: string; level?: string }): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.category) params.set("category", opts.category);
  if (opts?.level) params.set("level", opts.level);
  const qs = params.toString();
  const res = await fetch(`${API_PREFIX}/v2/debug/activity${qs ? `?${qs}` : ""}`);
  return res.json();
}

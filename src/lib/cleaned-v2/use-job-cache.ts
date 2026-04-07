"use client";

import { useCallback, useRef, useState } from "react";
import { getJob, listRecentJobs } from "@/lib/cleaned-v2/backend";
import type { JobResponse, RecentJobResponse } from "@/lib/cleaned-v2/types";

// ---------------------------------------------------------------------------
// Cache entry
// ---------------------------------------------------------------------------

interface JobCacheEntry {
  data: JobResponse;
  fetchedAt: number;
  stale: boolean;
}

const STALE_AFTER_MS = 30_000; // 30 seconds before background revalidation
const EXPIRE_AFTER_MS = 5 * 60_000; // 5 minutes before eviction

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useJobCache() {
  const cacheRef = useRef<Map<string, JobCacheEntry>>(new Map());
  // Bump this counter to force React re-renders when cache changes.
  const [, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);

  // In-flight fetches deduplication
  const inflightRef = useRef<Map<string, Promise<JobResponse>>>(new Map());

  // Recent jobs cache
  const [recentJobs, setRecentJobs] = useState<RecentJobResponse[]>([]);
  const [recentJobsLoading, setRecentJobsLoading] = useState(false);
  const recentJobsFetchedAt = useRef(0);

  // ---- Core cache operations -----------------------------------------------

  const getCachedJob = useCallback((jobId: string): JobResponse | null => {
    const entry = cacheRef.current.get(jobId);
    if (!entry) return null;
    // Evict expired entries
    if (Date.now() - entry.fetchedAt > EXPIRE_AFTER_MS) {
      cacheRef.current.delete(jobId);
      return null;
    }
    return entry.data;
  }, []);

  const putJob = useCallback((job: JobResponse) => {
    cacheRef.current.set(job.id, {
      data: job,
      fetchedAt: Date.now(),
      stale: false,
    });
    bump();
  }, [bump]);

  const invalidateJob = useCallback((jobId: string) => {
    const entry = cacheRef.current.get(jobId);
    if (entry) {
      entry.stale = true;
    }
  }, []);

  // ---- Smart fetch with stale-while-revalidate ----------------------------

  const fetchJobWithCache = useCallback(
    async (accessToken: string, jobId: string): Promise<JobResponse> => {
      const entry = cacheRef.current.get(jobId);
      const now = Date.now();

      // Fresh cache hit: return immediately, no fetch
      if (entry && !entry.stale && now - entry.fetchedAt < STALE_AFTER_MS) {
        return entry.data;
      }

      // Deduplicate in-flight requests for the same job
      const existing = inflightRef.current.get(jobId);
      if (existing) return existing;

      const promise = getJob(accessToken, jobId)
        .then((freshJob) => {
          cacheRef.current.set(jobId, {
            data: freshJob,
            fetchedAt: Date.now(),
            stale: false,
          });
          bump();
          return freshJob;
        })
        .finally(() => {
          inflightRef.current.delete(jobId);
        });

      inflightRef.current.set(jobId, promise);

      // If we have a stale entry, return it immediately and let the
      // background fetch update the cache (stale-while-revalidate).
      if (entry) {
        // Fire-and-forget the background revalidation
        promise.catch(() => {});
        return entry.data;
      }

      // No cache entry at all: must await the network response
      return promise;
    },
    [bump]
  );

  // ---- Background revalidation helper (non-blocking) ----------------------

  const revalidateJob = useCallback(
    (accessToken: string, jobId: string) => {
      invalidateJob(jobId);
      fetchJobWithCache(accessToken, jobId).catch(() => {});
    },
    [fetchJobWithCache, invalidateJob]
  );

  // ---- Recent jobs ---------------------------------------------------------

  const refreshRecentJobs = useCallback(
    async (accessToken: string) => {
      // Debounce: skip if fetched within last 3 seconds
      if (Date.now() - recentJobsFetchedAt.current < 3_000) return;
      setRecentJobsLoading(true);
      try {
        const jobs = await listRecentJobs(accessToken);
        setRecentJobs(jobs);
        recentJobsFetchedAt.current = Date.now();
      } catch {
        // Keep stale list on error
      } finally {
        setRecentJobsLoading(false);
      }
    },
    []
  );

  // ---- Clear ---------------------------------------------------------------

  const clearAll = useCallback(() => {
    cacheRef.current.clear();
    inflightRef.current.clear();
    setRecentJobs([]);
    recentJobsFetchedAt.current = 0;
    bump();
  }, [bump]);

  return {
    getJob: getCachedJob,
    putJob,
    invalidateJob,
    fetchJobWithCache,
    revalidateJob,
    recentJobs,
    recentJobsLoading,
    refreshRecentJobs,
    clearAll,
  };
}

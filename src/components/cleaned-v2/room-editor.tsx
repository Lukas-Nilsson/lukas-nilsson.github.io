/* eslint-disable */
"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomResponse } from "@/lib/cleaned-v2/types";

declare global {
  interface Window {
    AnnotationRenderer?: {
      renderAnnotatedScene: (data: unknown, opts: unknown) => { svg: string; layoutMap: unknown };
      rectToPercentStyle: (rect: unknown, w: number, h: number) => unknown;
      THEME_V1: unknown;
    };
    buildInteractiveSVG?: (container: HTMLElement, data: unknown, isEditable: boolean) => void;
    destroyInteractiveSVG?: (container: HTMLElement) => void;
  }
}

export function RoomEditor({
  room,
  initialRoomName,
  initialSupervisorNote,
  onClose,
  onSave,
  onApprove,
  onRespond
}: {
  room: RoomResponse;
  initialRoomName: string;
  initialSupervisorNote: string;
  onClose: () => void;
  onSave: (name: string, note: string, sceneJson: Record<string, unknown>) => Promise<void>;
  onApprove?: () => Promise<void>;
  onRespond?: (note: string) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [roomName, setRoomName] = useState(initialRoomName);
  const [supervisorNote, setSupervisorNote] = useState(initialSupervisorNote);
  const [isSaving, setIsSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const rawUrl = room.latest_revision?.raw_asset?.access_url;
  const initialScene = room.latest_revision?.scene_json || {};

  useEffect(() => {
    if (!imageLoaded || imageError || !containerRef.current || !window.buildInteractiveSVG) return;
    const sceneData = JSON.parse(JSON.stringify(initialScene));
    window.buildInteractiveSVG(containerRef.current, sceneData, true);
    return () => {
      if (containerRef.current && window.destroyInteractiveSVG) {
        window.destroyInteractiveSVG(containerRef.current);
      }
    };
  }, [imageLoaded, imageError, initialScene]);

  async function handleSave() {
    if (isSaving || !containerRef.current) return;
    const container = containerRef.current as HTMLDivElement & { _editorLocalData?: Record<string, unknown> };
    const savedScene = container._editorLocalData || initialScene;
    setIsSaving(true);
    try {
      await onSave(roomName, supervisorNote, savedScene);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="editor-modal">
      <div className="editor-card">
        <div className="editor-toolbar">
          <div>
            <strong>Edit room</strong>
            <p>{roomName || "Unnamed Room"}</p>
          </div>
          <div className="editor-toolbar-actions">
            {onApprove && room.approval_status !== "approved" ? (
              <button
                className="secondary-button compact"
                disabled={isSaving || !imageLoaded}
                onClick={async () => { setIsSaving(true); try { await onApprove(); } finally { setIsSaving(false); } }}
                type="button"
                style={{ background: "var(--success)", color: "var(--foreground)", borderColor: "var(--success)" }}
              >
                Approve room
              </button>
            ) : null}
            {onRespond ? (
              <button
                className="secondary-button compact"
                disabled={isSaving || !imageLoaded || !feedbackText.trim()}
                onClick={async () => { setIsSaving(true); try { await onRespond(feedbackText); } finally { setIsSaving(false); setFeedbackText(""); } }}
                type="button"
                style={{ color: "var(--text)" }}
              >
                Respond
              </button>
            ) : null}
            <button className="ghost-chip" onClick={onClose} type="button" disabled={isSaving}>Close</button>
            <button className="primary-button compact" disabled={isSaving || !imageLoaded} onClick={handleSave} type="button">
              {isSaving ? "Saving..." : "Save revision"}
            </button>
          </div>
        </div>
        <div className="editor-form">
          {onRespond ? (
            <label style={{ gridColumn: "1 / -1", marginBottom: "8px" }}>
              <span>Chat Feedback</span>
              <textarea onChange={(e) => setFeedbackText(e.target.value)} rows={1} value={feedbackText} placeholder="e.g. Can you make the floor dirtier?" disabled={isSaving} className="composer-input" />
            </label>
          ) : null}
          <label><span>Room name</span><input onChange={(e) => setRoomName(e.target.value)} value={roomName} placeholder="e.g. Master Bedroom" disabled={isSaving} /></label>
          <label><span>Supervisor note</span><textarea onChange={(e) => setSupervisorNote(e.target.value)} rows={2} value={supervisorNote} placeholder="Private note for this inspection..." disabled={isSaving} /></label>
        </div>
        <div className="editor-inline-actions">
          <button className="ghost-chip" id="editorUndo" type="button" style={{ display: "none" }}>Undo</button>
          <button className="ghost-chip danger" id="editorDelete" type="button" style={{ display: "none" }}>Delete selected</button>
        </div>
        <div className="editor-canvas" id="editorContent">
          <div className="editor-image-wrapper" ref={containerRef} style={{ opacity: imageLoaded ? 1 : 0.5, position: "relative" }}>
            {imageError ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--danger)" }}>
                Failed to load the background photograph.
                <br /><br /><a href={rawUrl} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", fontSize: "0.7em", color: "var(--muted)" }}>{rawUrl}</a>
              </div>
            ) : rawUrl ? (
              <img src={rawUrl} alt={roomName} className="editor-image" onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)} />
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>No original image available.</div>
            )}
          </div>
        </div>
        <div className="bottom-sheet" id="bottomSheet">
          <div className="bottom-sheet-card">
            <div className="bottom-sheet-label" id="bottomSheetLabel">Edit label</div>
            <textarea id="bottomSheetInput" rows={3} />
            <div className="bottom-sheet-actions">
              <button className="ghost-chip" id="bottomSheetCancel" type="button">Cancel</button>
              <button className="primary-button compact" id="bottomSheetSave" type="button">Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

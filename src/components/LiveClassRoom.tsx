"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Video, Loader2, AlertCircle, Circle, Square,
  Minimize2, Maximize2, GripVertical, CameraOff,
  MonitorOff, MicOff, Mic, X, CheckCircle,
} from "lucide-react";
import { uploadVideoToCloudinary } from "@/lib/cloudinary";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface LiveClassRoomProps {
  roomId: string;
  userId: string;
  userName: string;
  isHost: boolean;
  instructorName?: string;
  courseId?: string;       // used to associate recording with a course
  sessionTitle?: string;  // used as the recording title
  moduleId?: string;      // optional: link recording to a specific module
}

interface OverlayProps {
  stream: MediaStream | null;
  isScreenSharing: boolean;
  isHost: boolean;
  instructorName: string;
  onMuteToggle: () => void;
  onStopSharing: () => void;
  isMuted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating Facecam Overlay (draggable + resizable)
// ─────────────────────────────────────────────────────────────────────────────
function FacecamOverlay({
  stream,
  isScreenSharing,
  isHost,
  instructorName,
  onMuteToggle,
  onStopSharing,
  isMuted,
}: OverlayProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [minimized, setMinimized] = useState(false);
  const [size, setSize]           = useState({ w: 220, h: 165 });
  // Default: bottom-right (computed after mount)
  const [pos, setPos]             = useState({ x: -1, y: -1 });
  const posInitialized            = useRef(false);

  const dragging   = useRef(false);
  const resizing   = useRef(false);
  const dragOff    = useRef({ x: 0, y: 0 });
  const resizeStart= useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Position bottom-right on first render
  useEffect(() => {
    if (!posInitialized.current) {
      setPos({ x: window.innerWidth - 240, y: window.innerHeight - 210 });
      posInitialized.current = true;
    }
  }, []);

  // Attach stream to <video>
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream && !isMuted) {
      v.srcObject = stream;
      v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [stream, isMuted]);

  // Drag
  const onDragDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (rect) dragOff.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const maxX = window.innerWidth  - (minimized ? 130 : size.w + 8);
    const maxY = window.innerHeight - (minimized ? 52  : size.h + 8);
    setPos({
      x: Math.max(0, Math.min(e.clientX - dragOff.current.x, maxX)),
      y: Math.max(0, Math.min(e.clientY - dragOff.current.y, maxY)),
    });
  }, [minimized, size]);

  const onDragUp = useCallback(() => { dragging.current = false; }, []);

  // Resize (bottom-right handle)
  const onResizeDown = useCallback((e: React.PointerEvent) => {
    resizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  }, [size]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizing.current) return;
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    setSize({
      w: Math.max(160, Math.min(420, resizeStart.current.w + dx)),
      h: Math.max(120, Math.min(320, resizeStart.current.h + dy)),
    });
  }, []);

  const onResizeUp = useCallback(() => { resizing.current = false; }, []);

  if (!isScreenSharing) return null;
  if (!stream && !isHost) return null; // students hide if no stream found

  const label = isHost ? "Your Camera" : `${instructorName} (Instructor)`;
  const hasVideo = !!stream && !isMuted;

  return (
    <div
      ref={overlayRef}
      id="facecam-overlay"
      onPointerMove={(e) => { onDragMove(e); onResizeMove(e); }}
      onPointerUp={() => { onDragUp(); onResizeUp(); }}
      style={{
        position: "fixed",
        left: pos.x < 0 ? "auto" : pos.x,
        right: pos.x < 0 ? 16 : "auto",
        top:  pos.y < 0 ? "auto" : pos.y,
        bottom: pos.y < 0 ? 80 : "auto",
        zIndex: 99999,
        width:  minimized ? 136 : size.w,
        userSelect: "none",
        touchAction: "none",
      }}
      className="drop-shadow-2xl"
    >
      {/* Card */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900/95 backdrop-blur-md flex flex-col">

        {/* Header — drag handle */}
        <div
          onPointerDown={onDragDown}
          className="flex items-center justify-between px-2 py-1.5 bg-slate-800/90 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            {!minimized && (
              <span className="text-[10px] text-slate-300 font-medium truncate">{label}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Mute toggle — host only */}
            {isHost && !minimized && (
              <button
                id="facecam-mute-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onMuteToggle}
                title={isMuted ? "Show camera" : "Hide camera"}
                className="text-slate-400 hover:text-white transition-colors p-0.5"
              >
                {isMuted ? <CameraOff className="w-3.5 h-3.5 text-red-400" /> : <Video className="w-3.5 h-3.5" />}
              </button>
            )}
            {/* Minimize / Maximize */}
            <button
              id="facecam-minimize-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setMinimized((m) => !m)}
              title={minimized ? "Maximize" : "Minimize"}
              className="text-slate-400 hover:text-white transition-colors p-0.5"
            >
              {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            {/* Stop share — host only */}
            {isHost && (
              <button
                id="facecam-stop-share-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onStopSharing}
                title="Stop screen sharing"
                className="text-slate-400 hover:text-red-400 transition-colors p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Video body */}
        {!minimized && (
          <div
            style={{ height: size.h }}
            className="relative bg-slate-950 w-full overflow-hidden"
          >
            {hasVideo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                id="instructor-pip-video"
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full gap-2">
                <CameraOff className="w-7 h-7 text-slate-600" />
                <span className="text-[11px] text-slate-500">
                  {isMuted ? "Camera muted" : "No camera signal"}
                </span>
              </div>
            )}

            {/* Live badge */}
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] text-white font-bold uppercase tracking-wider">Live</span>
            </div>

            {/* Mic indicator */}
            {!isHost && (
              <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1 pointer-events-none">
                <Mic className="w-2.5 h-2.5 text-green-400" />
              </div>
            )}

            {/* Resize handle */}
            <div
              onPointerDown={onResizeDown}
              className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10 flex items-end justify-end pr-0.5 pb-0.5"
              title="Resize"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-slate-500 opacity-60">
                <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        )}

        {/* Minimized strip */}
        {minimized && (
          <div className="flex items-center justify-center h-9 bg-slate-950 gap-2 px-2">
            {hasVideo ? (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-auto object-cover rounded" />
            ) : (
              <CameraOff className="w-4 h-4 text-slate-600" />
            )}
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main LiveClassRoom
// ─────────────────────────────────────────────────────────────────────────────
export default function LiveClassRoom({
  roomId, userId, userName, isHost, instructorName = "Instructor",
  courseId, sessionTitle, moduleId,
}: LiveClassRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef        = useRef<any>(null);

  const [status, setStatus]               = useState<"loading"|"ready"|"error">("loading");
  const [error, setError]                 = useState("");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facecamStream, setFacecamStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted]             = useState(false);
  const [isRecording, setIsRecording]     = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading]     = useState(false);
  const [uploadDone, setUploadDone]       = useState(false);

  const facecamRef       = useRef<MediaStream | null>(null);
  const screenActiveRef  = useRef(false);
  const mountedRef       = useRef(true);
  const mediaRecRef      = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStreamRef  = useRef<MediaStream | null>(null);
  const scanTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so the onstop closure can read the final duration without stale state
  const recordingTimeRef = useRef(0);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Host: acquire independent webcam for PiP ───────────────────────────────
  const acquireFacecam = useCallback(async () => {
    if (!isHost) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!mountedRef.current) { s.getTracks().forEach((t) => t.stop()); return; }
      facecamRef.current = s;
      setFacecamStream(s);
    } catch {
      // Camera denied or unavailable — overlay shows "no signal"
      setFacecamStream(null);
    }
  }, [isHost]);

  const releaseFacecam = useCallback(() => {
    facecamRef.current?.getTracks().forEach((t) => t.stop());
    facecamRef.current = null;
    setFacecamStream(null);
  }, []);

  // ── Student: scan ZEGOCLOUD DOM for instructor video element ───────────────
  const scanForInstructorStream = useCallback(() => {
    if (!containerRef.current || isHost) return;

    const videos = Array.from(
      containerRef.current.querySelectorAll<HTMLVideoElement>("video")
    );

    for (const v of videos) {
      const s = v.srcObject;
      if (!(s instanceof MediaStream)) continue;
      const tracks = s.getVideoTracks();
      const isCamera = tracks.some(
        (t) =>
          t.enabled &&
          !t.label.toLowerCase().includes("screen") &&
          !t.label.toLowerCase().includes("display") &&
          !t.label.toLowerCase().includes("window") &&
          !t.label.toLowerCase().includes("monitor")
      );
      if (isCamera) {
        try {
          const cloned = s.clone();
          setFacecamStream(cloned);
          return;
        } catch {
          setFacecamStream(s);
          return;
        }
      }
    }

    // Not found yet — retry
    if (screenActiveRef.current) {
      scanTimerRef.current = setTimeout(scanForInstructorStream, 600);
    }
  }, [isHost]);

  // ── Screen sharing lifecycle ───────────────────────────────────────────────
  const onShareStarted = useCallback(() => {
    if (!mountedRef.current) return;
    screenActiveRef.current = true;
    setIsScreenSharing(true);
    if (isHost) {
      acquireFacecam();
    } else {
      // Give ZEGOCLOUD a moment to render video tiles
      scanTimerRef.current = setTimeout(scanForInstructorStream, 1000);
    }
  }, [isHost, acquireFacecam, scanForInstructorStream]);

  const onShareStopped = useCallback(() => {
    if (!mountedRef.current) return;
    screenActiveRef.current = false;
    setIsScreenSharing(false);
    if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
    if (isHost) {
      releaseFacecam();
    } else {
      setFacecamStream((prev) => {
        if (prev) { try { prev.getTracks().forEach((t) => t.stop()); } catch {} }
        return null;
      });
    }
  }, [isHost, releaseFacecam]);

  // ── Mute/unmute facecam ────────────────────────────────────────────────────
  const handleMuteToggle = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      if (facecamRef.current) {
        facecamRef.current.getVideoTracks().forEach((t) => { t.enabled = !next; });
      }
      return next;
    });
  }, []);

  // ── Stop screen sharing programmatically ───────────────────────────────────
  const handleStopSharing = useCallback(() => {
    try { zpRef.current?.stopScreenSharing?.(); } catch {}
    onShareStopped();
  }, [onShareStopped]);

  // Keep recordingTimeRef in sync so the onstop closure can read final duration
  useEffect(() => { recordingTimeRef.current = recordingTime; }, [recordingTime]);

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      recordStreamRef.current = stream;
      chunksRef.current = [];
      setUploadDone(false);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus" : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType });
      mediaRecRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());

        // ── Auto-upload to Cloudinary (non-blocking) ──────────────────────
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        if (blob.size > 0) {
          const finalDuration = recordingTimeRef.current;
          const title =
            sessionTitle ||
            `Recording – ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`;

          setIsUploading(true);
          (async () => {
            try {
              const videoUrl = await uploadVideoToCloudinary(blob, "lms-recordings");

              // Save metadata to DB if we have a courseId
              if (courseId) {
                const res = await fetch("/api/recordings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    courseId,
                    title,
                    videoUrl,
                    duration: finalDuration,
                    ...(moduleId ? { moduleId } : {}),
                  }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  console.error("[LiveClassRoom] Failed to save recording metadata:", err);
                } else {
                  console.log("[LiveClassRoom] Recording saved to DB.");
                  setUploadDone(true);
                  setTimeout(() => setUploadDone(false), 5000);
                }
              } else {
                console.log("[LiveClassRoom] Recording uploaded (no courseId to save metadata):", videoUrl);
                setUploadDone(true);
                setTimeout(() => setUploadDone(false), 5000);
              }
            } catch (err) {
              console.error("[LiveClassRoom] Cloudinary upload failed:", err);
            } finally {
              setIsUploading(false);
            }
          })();
        }
        // ─────────────────────────────────────────────────────────────────
      };
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (rec.state !== "inactive") rec.stop();
      });
      rec.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { /* cancelled */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, sessionTitle]);

  const stopRecording = useCallback(() => {
    if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── ZEGOCLOUD init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    mountedRef.current = true;
    let rafId: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    const initZego = async () => {
      try {
        if (zpRef.current) return;

        // Guard: container must be attached to the live DOM before ZEGOCLOUD
        // touches it — the SDK calls createSpan internally on the container
        // and throws if the element is null or detached.
        const el = containerRef.current;
        if (!el || !document.body.contains(el)) return;
        if (!mountedRef.current) return;

        const res = await fetch(
          `/api/zego-token?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`
        );
        if (!res.ok) throw new Error("Token fetch failed");
        const { serverSecret, appId } = await res.json();

        // Re-check after async gap
        if (!mountedRef.current || !containerRef.current) return;
        if (!document.body.contains(containerRef.current)) return;

        const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");

        // Re-check after dynamic import
        if (!mountedRef.current || !containerRef.current) return;
        if (!document.body.contains(containerRef.current)) return;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appId, serverSecret, roomId, userId, userName
        );

        let zp: any;
        try {
          zp = ZegoUIKitPrebuilt.create(kitToken);
        } catch (createErr) {
          console.error("[LiveClassRoom] ZegoUIKitPrebuilt.create failed:", createErr);
          if (mountedRef.current) {
            setError("Failed to connect. Please refresh and try again.");
            setStatus("error");
          }
          return;
        }

        zpRef.current = zp;
        setStatus("ready");

        // Final guard before joinRoom — this is where createSpan is called internally
        if (!mountedRef.current || !containerRef.current) return;
        if (!document.body.contains(containerRef.current)) return;

        try {
          zp.joinRoom({
            container: containerRef.current,
            sharedLinks: [{ name: "Copy Room Link", url: `${window.location.origin}/meet/${roomId}` }],
            scenario: { mode: ZegoUIKitPrebuilt.VideoConference },
            showTurnOffRemoteCameraButton: isHost,
            showTurnOffRemoteMicrophoneButton: isHost,
            showRemoveUserButton: isHost,
            turnOnCameraWhenJoining: true,
            turnOnMicrophoneWhenJoining: isHost,
            showMyCameraToggleButton: true,
            showMyMicrophoneToggleButton: true,
            showAudioVideoSettingsButton: true,
            showScreenSharingButton: true,
            showTextChat: true,
            showUserList: true,
            maxUsers: 50,
            layout: "Auto",
            showLayoutButton: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            screenSharingConfig: { resolution: "1080p" as any },

            onScreenSharingStreamUpdated: (
              state: "created" | "published" | "closed",
              _streamId: string,
              _stream?: MediaStream
            ) => {
              if (!mountedRef.current) return;
              if (state === "created" || state === "published") {
                onShareStarted();
              } else if (state === "closed") {
                onShareStopped();
              }
            },

            onRemoteScreenSharingStarted: () => {
              if (!mountedRef.current) return;
              if (!isHost) onShareStarted();
            },

            onRemoteScreenSharingStopped: () => {
              if (!mountedRef.current) return;
              if (!isHost) onShareStopped();
            },

            onLeaveRoom: () => {
              screenActiveRef.current = false;
              setIsScreenSharing(false);
              if (isHost) releaseFacecam();
            },
          });
        } catch (joinErr) {
          // Swallow benign ZEGOCLOUD internal DOM errors (e.g. createSpan on
          // a briefly-null span reference) — the room still functions.
          console.warn("[LiveClassRoom] joinRoom threw (non-fatal):", joinErr);
        }
      } catch (err) {
        console.error("[LiveClassRoom]", err);
        if (mountedRef.current) {
          setError("Failed to connect. Please refresh and try again.");
          setStatus("error");
        }
      }
    };

    // Two rAF passes give React time to fully commit the container div to the DOM
    rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        timeoutId = setTimeout(initZego, 150);
      });
    });

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      screenActiveRef.current = false;
      if (isHost) releaseFacecam();
      if (zpRef.current) {
        try { zpRef.current.destroy(); } catch {}
        zpRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, userName, isHost]);

  // ── Cleanup timers on unmount ─────────────────────────────────────────────
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // ── Error screen ──────────────────────────────────────────────────────────
  if (status === "error")
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold">Unable to Join Classroom</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="text-blue-400 underline text-sm">
            Refresh Page
          </button>
        </div>
      </div>
    );

  return (
    <div className="relative w-full h-full bg-slate-950">
      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-950">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Video className="w-8 h-8 text-blue-400" />
            </div>
            <div className="flex items-center gap-2 text-white">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm">Connecting to live classroom...</span>
            </div>
            <p className="text-slate-500 text-xs">
              Joining as <span className="text-blue-400 font-semibold">{userName}</span>
              {isHost && <span className="ml-2 text-amber-400">(Host)</span>}
            </p>
          </div>
        </div>
      )}

      {/* Screen-share banner for students */}
      {!isHost && isScreenSharing && status === "ready" && (
        <div
          id="screen-share-banner"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-2 bg-blue-600/90 backdrop-blur-sm text-white text-xs font-medium px-4 py-1.5 rounded-full shadow-lg border border-blue-400/30 pointer-events-none"
        >
          <MonitorOff className="w-3.5 h-3.5" />
          Instructor is sharing their screen
        </div>
      )}

      {/* Record button — host only */}
      {isHost && status === "ready" && (
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
          {isRecording ? (
            <div className="flex items-center gap-2 bg-red-600/95 backdrop-blur text-white pl-4 pr-2 py-2 rounded-full shadow-2xl border border-red-500/50">
              <Circle className="w-2.5 h-2.5 fill-white animate-pulse" />
              <span className="text-sm font-mono font-bold">{fmt(recordingTime)}</span>
              <button
                id="stop-recording-btn"
                onClick={stopRecording}
                className="ml-2 flex items-center gap-1.5 bg-white/20 hover:bg-white/35 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              >
                <Square className="w-3 h-3 fill-white" /> Stop & Save
              </button>
            </div>
          ) : isUploading ? (
            <div className="flex items-center gap-2 bg-indigo-600/95 backdrop-blur text-white px-4 py-2 rounded-full shadow-2xl border border-indigo-400/50">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-sm font-semibold">Uploading…</span>
            </div>
          ) : uploadDone ? (
            <div className="flex items-center gap-2 bg-emerald-600/95 backdrop-blur text-white px-4 py-2 rounded-full shadow-2xl border border-emerald-400/50">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">Saved to Recorded Classes!</span>
            </div>
          ) : (
            <button
              id="start-recording-btn"
              onClick={startRecording}
              className="flex items-center gap-2 bg-slate-900/90 backdrop-blur hover:bg-red-700 border border-slate-600 hover:border-red-500 text-white px-4 py-2.5 rounded-full shadow-xl text-sm font-semibold transition-all active:scale-95"
            >
              <Circle className="w-3 h-3 fill-red-500 text-red-500" /> Record Class
            </button>
          )}
        </div>
      )}

      {/* ZEGOCLOUD room container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Persistent Facecam Overlay */}
      <FacecamOverlay
        stream={facecamStream}
        isScreenSharing={isScreenSharing}
        isHost={isHost}
        instructorName={instructorName}
        onMuteToggle={handleMuteToggle}
        onStopSharing={handleStopSharing}
        isMuted={isMuted}
      />

      {/* Mic icon import usage (prevent unused import warning) */}
      <span className="hidden"><Mic /><MicOff /></span>
    </div>
  );
}

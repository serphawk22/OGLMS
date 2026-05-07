"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Video, Loader2, AlertCircle, Circle, Square } from "lucide-react";

interface LiveClassRoomProps {
  roomId: string;
  userId: string;
  userName: string;
  isHost: boolean;
}

export default function LiveClassRoom({ roomId, userId, userName, isHost }: LiveClassRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        download(new Blob(chunksRef.current, { type: "video/webm" }));
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
      };
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (rec.state !== "inactive") rec.stop();
      });
      rec.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { /* user cancelled */ }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const zpRef = useRef<any>(null);

  // ZEGOCLOUD init — fetch token server-side, then join room
  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    const initZego = async () => {
      try {
        if (zpRef.current) return; // Prevent double init

        // 1. Get auth details from our secure API
        const res = await fetch(
          `/api/zego-token?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`
        );
        if (!res.ok) throw new Error("Token fetch failed");
        const { serverSecret, appId } = await res.json();
        if (!mounted || !containerRef.current) return;

        // 2. Load ZEGOCLOUD UIKit
        const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");
        if (!mounted || !containerRef.current) return;

        // 3. Generate test kit token properly using the Server Secret
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appId,
          serverSecret,
          roomId,
          userId,
          userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;
        setStatus("ready");

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
        });
      } catch (err) {
        console.error("[LiveClassRoom]", err);
        if (mounted) { setError("Failed to connect. Please refresh and try again."); setStatus("error"); }
      }
    };

    initZego();
    return () => { 
      mounted = false; 
      if (zpRef.current) {
        zpRef.current.destroy();
        zpRef.current = null;
      }
    };
  }, [roomId, userId, userName, isHost]);

  if (status === "error") return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="text-center space-y-4 max-w-md p-8">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold">Unable to Join Classroom</h2>
        <p className="text-slate-400 text-sm">{error}</p>
        <button onClick={() => window.location.reload()} className="text-blue-400 underline text-sm">Refresh Page</button>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-full bg-slate-950">
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

      {/* Record button — host only */}
      {isHost && status === "ready" && (
        <div className="absolute top-4 right-4 z-50">
          {isRecording ? (
            <div className="flex items-center gap-2 bg-red-600/95 backdrop-blur text-white pl-4 pr-2 py-2 rounded-full shadow-2xl border border-red-500/50">
              <Circle className="w-2.5 h-2.5 fill-white animate-pulse" />
              <span className="text-sm font-mono font-bold">{fmt(recordingTime)}</span>
              <button onClick={stopRecording} className="ml-2 flex items-center gap-1.5 bg-white/20 hover:bg-white/35 px-3 py-1.5 rounded-full text-xs font-semibold transition-all">
                <Square className="w-3 h-3 fill-white" /> Stop &amp; Save
              </button>
            </div>
          ) : (
            <button onClick={startRecording} className="flex items-center gap-2 bg-slate-900/90 backdrop-blur hover:bg-red-700 border border-slate-600 hover:border-red-500 text-white px-4 py-2.5 rounded-full shadow-xl text-sm font-semibold transition-all active:scale-95">
              <Circle className="w-3 h-3 fill-red-500 text-red-500" />
              Record Class
            </button>
          )}
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

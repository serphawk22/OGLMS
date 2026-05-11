"use client";

import { useEffect, useState, useRef } from "react";
import {
  MonitorPlay, Loader2, Play, Pause, Calendar,
  Clock, Video, RefreshCw,
} from "lucide-react";

interface Recording {
  id: string;
  title: string;
  videoUrl: string;
  duration: number | null;
  createdAt: string;
  instructor: { name: string | null };
}

interface Props {
  courseId: string;
  isInstructor: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ── Individual video card ─────────────────────────────────────────────────────
function RecordingCard({ rec }: { rec: Recording }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      v.play();
      setPlaying(true);
    }
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all group"
      id={`recording-card-${rec.id}`}
    >
      {/* Video player */}
      <div className="relative bg-slate-950 aspect-video w-full overflow-hidden">
        <video
          ref={videoRef}
          src={rec.videoUrl}
          className="w-full h-full object-contain"
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          controls
          preload="metadata"
        />
        {/* Play/Pause overlay — only shown when controls are hidden */}
        {!playing && (
          <button
            onClick={toggle}
            id={`play-btn-${rec.id}`}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/60 hover:bg-white/30 transition-colors">
              <Play className="w-7 h-7 text-white ml-1" />
            </div>
          </button>
        )}
        {playing && (
          <button
            onClick={toggle}
            id={`pause-btn-${rec.id}`}
            className="absolute top-2 right-2 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full p-2 hover:bg-black/70 transition-colors z-10"
          >
            <Pause className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="p-5">
        <h3 className="font-bold text-lg text-slate-800 leading-snug line-clamp-2">
          {rec.title}
        </h3>

        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-400" />
            {formatDate(rec.createdAt)}
          </span>
          {rec.duration && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              {formatDuration(rec.duration)}
            </span>
          )}
          {rec.instructor.name && (
            <span className="flex items-center gap-1.5">
              <Video className="w-4 h-4 text-indigo-400" />
              {rec.instructor.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main tab component ────────────────────────────────────────────────────────
export function RecordedClassesTab({ courseId, isInstructor }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecordings = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/recordings?courseId=${courseId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecordings(data.recordings ?? []);
    } catch (e) {
      setError("Failed to load recordings. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  return (
    <div className="space-y-6" id="recorded-classes-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MonitorPlay className="w-6 h-6 text-indigo-600" />
          <h3 className="text-2xl font-bold text-slate-800">Recorded Classes</h3>
        </div>
        <button
          onClick={() => fetchRecordings(true)}
          disabled={refreshing}
          id="refresh-recordings-btn"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-200"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isInstructor && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-700">
          <strong>Auto-recording enabled:</strong> When you stop a recording during a live class,
          it uploads automatically to Cloudinary and appears here.
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span>Loading recordings…</span>
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16 bg-red-50 rounded-xl border border-red-200 text-red-600 text-sm">
          {error}
          <button
            onClick={() => fetchRecordings()}
            className="block mx-auto mt-3 underline text-red-700 hover:text-red-900"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && recordings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400 gap-4">
          <div className="w-20 h-20 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <MonitorPlay className="w-10 h-10 text-indigo-300" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-600">No recorded classes yet</p>
            <p className="text-sm mt-1">
              {isInstructor
                ? "Start a live class and use the Record button — recordings appear here automatically."
                : "Check back after your instructor records a live session."}
            </p>
          </div>
        </div>
      )}

      {!loading && !error && recordings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {recordings.map((rec) => (
            <RecordingCard key={rec.id} rec={rec} />
          ))}
        </div>
      )}
    </div>
  );
}

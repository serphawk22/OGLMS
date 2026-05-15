"use client";
import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Loader2 } from "lucide-react";

interface FeedbackItem {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null };
  course:  { id: string; title: string };
}

interface Props {
  courseId: string;
}

export function StudentFeedbackTab({ courseId }: Props) {
  const [comments, setComments] = useState<FeedbackItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/student/course-feedback?courseId=${courseId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load feedback.");
        return;
      }
      setComments(data.comments ?? []);
    } catch {
      setError("Network error — please refresh.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  function fmt(iso: string) {
    try {
      return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    } catch { return iso; }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-3 text-sm text-slate-400">Loading feedback…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-red-100">
        <p className="text-red-500 font-medium text-sm">{error}</p>
        <button onClick={fetchFeedback} className="mt-3 text-xs text-blue-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-6 h-6 text-violet-600" />
        <h3 className="text-2xl font-bold text-slate-800">Instructor / Admin Feedback</h3>
        {comments.length > 0 && (
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold ml-1">
            {comments.length}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500">
        Comments from your instructor or admin about your performance in this course.
      </p>

      {comments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">No feedback yet.</p>
          <p className="text-sm text-slate-400 mt-1">
            Your instructor will leave comments here when available.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((fb) => (
            <div key={fb.id} className="bg-white border border-violet-100 rounded-xl px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                    <span className="text-xs font-black text-violet-700">
                      {(fb.author.name ?? "A").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{fb.author.name ?? "Admin"}</p>
                    <p className="text-[10px] text-slate-400">{fb.course.title}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{fmt(fb.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mt-1">{fb.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Loader2 } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author:  { id: string; name: string | null };
  student: { id: string; name: string | null } | null;
}

interface Props {
  courseId: string;
}

export function InstructorFeedbackTab({ courseId }: Props) {
  const [courseComments,   setCourseComments]   = useState<Comment[]>([]);
  const [studentComments,  setStudentComments]  = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/instructor/course-feedback?courseId=${courseId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load feedback.");
        return;
      }
      setCourseComments(data.courseComments  ?? []);
      setStudentComments(data.studentComments ?? []);
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

  const totalCount = courseComments.length + studentComments.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-6 h-6 text-violet-600" />
        <h2 className="text-xl font-bold">Admin Feedback</h2>
        <span className="text-xs text-slate-400 font-medium">— comments from admin</span>
        {totalCount > 0 && (
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">{totalCount}</span>
        )}
      </div>

      {/* ── Course Comments ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Course Comments ({courseComments.length})
        </p>
        {courseComments.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-slate-200 text-slate-400 text-sm">
            No course-level comments from admin yet.
          </div>
        ) : (
          <div className="space-y-3">
            {courseComments.map((fb) => (
              <div key={fb.id} className="bg-white border border-violet-100 rounded-xl px-5 py-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                      <span className="text-xs font-black text-violet-700">
                        {(fb.author.name ?? "A").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{fb.author.name ?? "Admin"}</span>
                    <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">
                      Course
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{fmt(fb.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{fb.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Student Comments ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Student Performance Comments ({studentComments.length})
        </p>
        {studentComments.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-slate-200 text-slate-400 text-sm">
            No student performance comments from admin yet.
          </div>
        ) : (
          <div className="space-y-3">
            {studentComments.map((fb) => (
              <div key={fb.id} className="bg-white border border-blue-100 rounded-xl px-5 py-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-black text-blue-700">
                        {(fb.author.name ?? "A").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{fb.author.name ?? "Admin"}</span>
                    {fb.student && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                        → {fb.student.name ?? "Student"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{fmt(fb.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{fb.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty overall state */}
      {totalCount === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 text-slate-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-sm">No admin feedback for this course yet.</p>
        </div>
      )}
    </div>
  );
}

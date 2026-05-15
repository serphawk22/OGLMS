"use client";
import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Trash2, Loader2, BookOpen, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Course   { id: string; title: string }
interface Student  { memberId: string; userId: string; name: string; email: string }
interface Comment  {
  id: string; content: string; createdAt: string;
  author:  { id: string; name: string };
  student: { id: string; name: string } | null;
}

interface Props { orgId: string; courses: Course[] }
type Tab = "COURSE" | "STUDENT";

export function AdminCommentsPanel({ orgId, courses }: Props) {
  // Start with "" so user explicitly picks a course
  const [tab, setTab]             = useState<Tab>("COURSE");
  const [courseId, setCourseId]   = useState<string>("");
  const [students, setStudents]   = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [comments, setComments]   = useState<Comment[]>([]);
  const [text, setText]           = useState("");
  const [loadingS, setLoadingS]   = useState(false);
  const [loadingC, setLoadingC]   = useState(false);
  const [posting, setPosting]     = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  // Load students for the student-comment tab whenever course changes
  useEffect(() => {
    if (tab !== "STUDENT" || !courseId) { setStudents([]); setStudentId(""); return; }
    setStudents([]);
    setStudentId("");
    setLoadingS(true);
    fetch(`/api/admin/students?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d) => { setStudents(d.students ?? []); setLoadingS(false); })
      .catch(() => setLoadingS(false));
  }, [orgId, courseId, tab]);

  // Load comments whenever course/student/tab changes
  useEffect(() => {
    if (!courseId) { setComments([]); return; }
    if (tab === "STUDENT" && !studentId) { setComments([]); return; }

    setLoadingC(true);
    const url = tab === "COURSE"
      ? `/api/admin/comments?courseId=${courseId}&targetType=COURSE`
      : `/api/admin/comments?courseId=${courseId}&targetType=STUDENT&studentId=${studentId}`;

    fetch(url)
      .then((r) => r.json())
      .then((d) => { setComments(d.comments ?? []); setLoadingC(false); })
      .catch(() => { setComments([]); setLoadingC(false); });
  }, [courseId, studentId, tab]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments]);

  async function handlePost() {
    if (!text.trim() || !courseId) return;
    if (tab === "STUDENT" && !studentId) return;
    setPosting(true);
    const body: Record<string, string> = { courseId, content: text.trim(), targetType: tab };
    if (tab === "STUDENT") body.studentId = studentId;
    try {
      const res  = await fetch("/api/admin/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.comment) setComments((prev) => [...prev, data.comment]);
    } catch { /* silent */ }
    setText("");
    setPosting(false);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/admin/comments?id=${id}&courseId=${courseId}`, { method: "DELETE" });
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch { /* silent */ }
    setDeleting(null);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    setComments([]);
    setStudents([]);
    setStudentId("");
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    } catch { return iso; }
  }

  const canPost = !!text.trim() && !!courseId && (tab === "COURSE" || !!studentId) && !posting;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 bg-slate-50 border-b border-slate-100">
        <MessageSquare className="w-4 h-4 text-violet-500" />
        <span className="text-base font-bold text-slate-900">Admin Comments</span>
        <span className="text-xs text-slate-400 ml-1">— visible only to admin &amp; instructor / student</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-white">
        {(["COURSE", "STUDENT"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors border-b-2 ${
              tab === t
                ? "border-violet-500 text-violet-700 bg-violet-50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t === "COURSE" ? <BookOpen className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5" />}
            {t === "COURSE" ? "Course Comments" : "Student Comments"}
          </button>
        ))}
      </div>

      {/* Selectors */}
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-3">
        {/* Course selector */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
            Select Course
          </label>
          {courses.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No courses in this organization yet.</p>
          ) : (
            <select
              value={courseId}
              onChange={(e) => { setCourseId(e.target.value); setStudentId(""); setComments([]); }}
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
            >
              <option value="">— Choose a course —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          )}
        </div>

        {/* Student selector (only for Student Comments tab) */}
        {tab === "STUDENT" && courseId && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Select Student
            </label>
            {loadingS ? (
              <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading students…
              </div>
            ) : students.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No students in this workspace yet.</p>
            ) : (
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              >
                <option value="">— Choose a student —</option>
                {students.map((s) => (
                  <option key={s.userId} value={s.userId}>{s.name} ({s.email})</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Comments list */}
      <div className="min-h-[180px] max-h-[300px] overflow-y-auto px-5 py-4 space-y-3 bg-white">
        {!courseId ? (
          <p className="text-center text-slate-400 text-sm py-10">Select a course to view comments.</p>
        ) : tab === "STUDENT" && !studentId ? (
          <p className="text-center text-slate-400 text-sm py-10">Select a student to view their comments.</p>
        ) : loadingC ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-10">No comments yet — add one below.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3 group">
              <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-black text-violet-700">
                  {c.author.name?.charAt(0).toUpperCase() ?? "A"}
                </span>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">{c.author.name}</span>
                    {c.student && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                        → {c.student.name}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{formatDate(c.createdAt)}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 flex-shrink-0"
                  >
                    {deleting === c.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Trash2 className="w-3 h-3" />
                    }
                  </button>
                </div>
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
            placeholder={
              !courseId ? "Select a course first…"
              : tab === "STUDENT" && !studentId ? "Select a student first…"
              : "Write a comment and press Enter…"
            }
            disabled={!courseId || (tab === "STUDENT" && !studentId) || posting}
            className="flex-1 text-sm px-4 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 disabled:opacity-50"
          />
          <Button
            onClick={handlePost}
            disabled={!canPost}
            className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-4"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          {tab === "COURSE"
            ? "Course comments are visible to admin and the course instructor."
            : "Student comments are visible to admin, course instructor, and that student only."}
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, Star, MessageSquare, Loader2,
  ChevronDown, ChevronUp, Link2, Eye, Download,
} from "lucide-react";
import { FileViewerModal } from "@/components/modals/FileViewerModal";
import { getFileIcon, formatFileSize } from "@/lib/file-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedFileInfo {
  id: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  url: string;
  publicId: string;
  resourceType?: string | null;
}

interface Submission {
  id: string;
  studentId: string;
  driveLink: string;
  // New normalized file relation
  fileId?: string | null;
  file?: UploadedFileInfo | null;
  // Legacy fallback fields
  fileUrl?: string | null;
  fileType?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  originalFileName?: string | null;
  grade: number | null;
  maxGrade: number;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
  student: { name: string | null; email: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolves display-friendly file info from submission (new relation or legacy fields). */
function resolveFile(sub: Submission) {
  if (sub.file) {
    return {
      url:  sub.file.url,
      name: sub.file.originalName,
      mime: sub.file.mimeType,
      size: sub.file.size,
      ext:  sub.file.extension,
    };
  }
  return {
    url:  sub.fileUrl ?? null,
    name: sub.originalFileName ?? "Uploaded file",
    mime: sub.mimeType ?? "",
    size: sub.fileSize ?? null,
    ext:  sub.fileType ?? "",
  };
}

// ─── Submission file actions ──────────────────────────────────────────────────

function SubmissionActions({ sub }: { sub: Submission }) {
  const hasFile = !!(sub.file ?? sub.fileUrl);
  const file    = resolveFile(sub);

  if (hasFile && file.url) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Inline preview via FileViewerModal */}
        <FileViewerModal
          url={file.url}
          title={`${sub.student.name ?? "Student"}'s Submission`}
          fileName={file.name}
          mimeType={file.mime}
          fileSize={file.size}
        >
          <Button variant="outline" size="sm"
            className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
            <Eye className="w-3 h-3 mr-1" /> Preview
          </Button>
        </FileViewerModal>

        {/* Download */}
        <a href={file.url} download={file.name}>
          <Button variant="outline" size="sm"
            className="h-8 text-xs border-slate-200 text-slate-600 hover:bg-slate-50">
            <Download className="w-3 h-3 mr-1" /> Download
          </Button>
        </a>
      </div>
    );
  }

  // Legacy Drive link
  if (sub.driveLink) {
    return (
      <a href={sub.driveLink} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm"
          className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
          <Eye className="w-3 h-3 mr-1" /> View
        </Button>
      </a>
    );
  }

  return null;
}

// ─── Grade form ───────────────────────────────────────────────────────────────

interface GradeFormProps {
  submission: Submission;
  onGraded: (updated: Submission) => void;
}

function GradeForm({ submission, onGraded }: GradeFormProps) {
  const [grade,    setGrade]    = useState(submission.grade?.toString() ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/assignments/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, grade, feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      onGraded(data.submission);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save grade.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3 pt-3 border-t border-slate-200">
      <div className="flex gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
            Grade (0–100)
          </label>
          <input
            type="number" min="0" max="100" required
            value={grade} onChange={(e) => setGrade(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-center font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="e.g. 85"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
            Feedback (optional)
          </label>
          <textarea
            value={feedback} onChange={(e) => setFeedback(e.target.value)}
            rows={2} placeholder="Great work! Consider improving..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
          : <Star    className="w-4 h-4 mr-2" />}
        {submission.grade !== null ? "Update Grade" : "Save Grade"}
      </Button>
    </form>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface SubmissionsPanelProps {
  assignmentId: string;
  assignmentTitle: string;
  initialSubmissions: Submission[];
}

export function SubmissionsPanel({
  assignmentTitle,
  initialSubmissions,
}: SubmissionsPanelProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [open,        setOpen]        = useState(false);

  const handleGraded = (submissionId: string, updated: Submission) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === submissionId ? { ...s, ...updated } : s)),
    );
  };

  return (
    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        suppressHydrationWarning
      >
        <span className="font-semibold text-sm text-slate-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          {submissions.length} Submission{submissions.length !== 1 ? "s" : ""}
          {submissions.filter((s) => s.grade !== null).length > 0 && (
            <span className="text-xs text-emerald-600 font-medium">
              · {submissions.filter((s) => s.grade !== null).length} graded
            </span>
          )}
        </span>
        {open
          ? <ChevronUp   className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {submissions.length === 0 ? (
            <div className="p-4 text-sm text-slate-400 text-center">No submissions yet.</div>
          ) : (
            submissions.map((sub) => {
              const file    = resolveFile(sub);
              const hasFile = !!(sub.file ?? sub.fileUrl);
              const { Icon, color, bg } = hasFile
                ? getFileIcon(file.name, file.mime)
                : { Icon: Link2, color: "text-slate-400", bg: "bg-slate-50 border-slate-200" };

              return (
                <div key={sub.id} className="p-4 space-y-2">
                  {/* Student info + grade badge + actions */}
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">
                        {sub.student.name || "Student"}
                        <span className="text-xs font-normal text-slate-400 ml-2">{sub.student.email}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        Submitted:{" "}
                        {new Date(sub.submittedAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Grade badge */}
                      {sub.grade !== null ? (
                        <span className={`text-sm font-black px-3 py-1 rounded-full ${
                          sub.grade / sub.maxGrade >= 0.8 ? "bg-emerald-100 text-emerald-700"
                          : sub.grade / sub.maxGrade >= 0.5 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"}`}>
                          {sub.grade}/{sub.maxGrade}
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-1 rounded-full">
                          Pending
                        </span>
                      )}

                      <SubmissionActions sub={sub} />
                    </div>
                  </div>

                  {/* File info row */}
                  {hasFile && (
                    <div className={`flex items-center gap-2 text-xs text-slate-500 rounded-lg px-3 py-1.5 border ${bg}`}>
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                      <span className="truncate font-medium">{file.name}</span>
                      {file.size && (
                        <span className="shrink-0 text-slate-400">· {formatFileSize(file.size)}</span>
                      )}
                      {file.ext && (
                        <span className="shrink-0 uppercase text-slate-400 font-semibold tracking-wide">
                          · {file.ext}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Legacy Drive link label */}
                  {!hasFile && sub.driveLink && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Link2 className="w-3 h-3" />
                      <span>Google Drive link submission</span>
                    </div>
                  )}

                  {/* Feedback display */}
                  {sub.feedback && sub.grade !== null && (
                    <div className="flex items-start gap-1.5 text-sm text-slate-600 bg-slate-50 rounded-lg p-2 mt-1">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                      <span className="text-xs">{sub.feedback}</span>
                    </div>
                  )}

                  <GradeForm
                    submission={sub}
                    onGraded={(updated) => handleGraded(sub.id, updated)}
                  />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

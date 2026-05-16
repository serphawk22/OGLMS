"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Send, ExternalLink, Star, MessageSquare, RotateCcw, Loader2 } from "lucide-react";

interface Submission {
  id: string;
  driveLink: string;
  fileUrl?: string | null;
  publicId?: string | null;
  fileType?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  originalFileName?: string | null;
  grade: number | null;
  maxGrade: number;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
}

interface AssignmentSubmitFormProps {
  assignmentId: string;
  assignmentTitle: string;
  existingSubmission: Submission | null;
}

export function AssignmentSubmitForm({
  assignmentId,
  assignmentTitle,
  existingSubmission,
}: AssignmentSubmitFormProps) {
  const [submission, setSubmission] = useState<Submission | null>(existingSubmission);
  const [showForm, setShowForm] = useState(false);
  const [driveLink, setDriveLink] = useState(existingSubmission?.driveLink ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/assignments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, driveLink }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed.");
      setSubmission(data.submission);
      setSuccess("Assignment submitted successfully!");
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  // ---- GRADED STATE ----
  if (submission?.grade !== null && submission?.grade !== undefined) {
    const pct = Math.round((submission.grade / submission.maxGrade) * 100);
    const color =
      pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
    const bg =
      pct >= 80 ? "bg-emerald-50 border-emerald-200" : pct >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

    return (
      <div className={`mt-4 rounded-xl border-2 p-5 ${bg} space-y-3`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Star className={`w-5 h-5 ${color}`} />
            <span className="font-bold text-slate-800">Graded</span>
          </div>
          <span className={`text-3xl font-black ${color}`}>
            {submission.grade}/{submission.maxGrade}
            <span className="text-sm font-medium text-slate-500 ml-1">({pct}%)</span>
          </span>
        </div>

        {submission.feedback && (
          <div className="bg-white/80 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold uppercase text-slate-500 tracking-wide">Instructor Feedback</span>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">{submission.feedback}</p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 flex-wrap gap-2">
          <a href={submission.driveLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline font-medium">
            <ExternalLink className="w-3 h-3" /> View my submission
          </a>
          <span>Submitted: {new Date(submission.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>
    );
  }

  // ---- SUBMITTED (not yet graded) ----
  if (submission && !showForm) {
    return (
      <div className="mt-4 rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-blue-800">Submitted — Awaiting Grade</span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <a href={submission.driveLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline font-medium">
            <ExternalLink className="w-3.5 h-3.5" /> View Submission
          </a>
          <button
            onClick={() => { setShowForm(true); setDriveLink(submission.driveLink); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Resubmit
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Submitted on {new Date(submission.submittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
    );
  }

  // ---- SUBMIT FORM ----
  if (showForm) {
    return (
      <form onSubmit={handleSubmit} className="mt-4 rounded-xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="font-semibold text-slate-700 text-sm">Submit your work via Google Drive link:</p>
        <input
          type="url"
          value={driveLink}
          onChange={(e) => setDriveLink(e.target.value)}
          required
          placeholder="https://drive.google.com/..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        {success && <p className="text-xs text-emerald-600 font-medium">{success}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            {loading ? "Submitting…" : "Submit Assignment"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="px-4">
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  // ---- NOT YET SUBMITTED ----
  return (
    <div className="mt-4">
      <Button
        onClick={() => setShowForm(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
      >
        <Send className="w-4 h-4 mr-2" /> Submit Assignment
      </Button>
    </div>
  );
}

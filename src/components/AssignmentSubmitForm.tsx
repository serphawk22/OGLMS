"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, Send, ExternalLink, Star, MessageSquare,
  RotateCcw, Loader2, Upload, FileText, File, Image,
  Archive, Code, BarChart2, X, AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFileIcon(fileType: string | null, mimeType?: string) {
  const ext = (fileType ?? "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();
  if (ext === "pdf" || mime === "application/pdf")
    return { Icon: FileText, color: "text-red-500", bg: "bg-red-50 border-red-100" };
  if (["ppt", "pptx"].includes(ext) || mime.includes("powerpoint") || mime.includes("presentationml"))
    return { Icon: BarChart2, color: "text-orange-500", bg: "bg-orange-50 border-orange-100" };
  if (["doc", "docx"].includes(ext) || mime.includes("msword") || mime.includes("wordprocessingml"))
    return { Icon: FileText, color: "text-blue-500", bg: "bg-blue-50 border-blue-100" };
  if (["xls", "xlsx"].includes(ext) || mime.includes("excel") || mime.includes("spreadsheetml"))
    return { Icon: BarChart2, color: "text-green-500", bg: "bg-green-50 border-green-100" };
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || mime.includes("zip"))
    return { Icon: Archive, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" };
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext) || mime.startsWith("image/"))
    return { Icon: Image, color: "text-purple-500", bg: "bg-purple-50 border-purple-100" };
  if (["py", "js", "ts", "html", "css", "json", "txt", "md", "jsx", "tsx"].includes(ext) || mime.startsWith("text/"))
    return { Icon: Code, color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
  return { Icon: File, color: "text-slate-400", bg: "bg-slate-50 border-slate-200" };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getViewUrl(fileUrl: string, ext: string | null): string {
  const e = (ext ?? "").toLowerCase();
  // PDF → direct URL (browser native PDF viewer)
  if (e === "pdf") return fileUrl;
  // Office files → Microsoft Office Online Viewer (works with Cloudinary URLs)
  if (["xlsx", "xls", "doc", "docx", "ppt", "pptx", "csv"].includes(e))
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
  // Images and everything else → direct URL
  return fileUrl;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AssignmentSubmitForm({
  assignmentId,
  existingSubmission,
}: AssignmentSubmitFormProps) {
  const [submission, setSubmission] = useState<Submission | null>(existingSubmission);
  const [showForm, setShowForm] = useState(false);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File selection ─────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setSelectedFile(f); setError(""); }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setSelectedFile(f); setError(""); }
  };

  // ── Upload to Cloudinary → save via API ───────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) { setError("Please select a file."); return; }
    setError(""); setSuccess(""); setUploading(true); setProgress(0);

    const cloudName   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_SUBMISSIONS_PRESET;

    if (!cloudName || !uploadPreset) {
      setError("Upload is not configured. Please contact the administrator.");
      setUploading(false);
      return;
    }

    try {
      // Step 1: Upload to Cloudinary via XHR (real progress)
      const cloudResult = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const fd = new FormData();
        fd.append("file", selectedFile);
        fd.append("upload_preset", uploadPreset);

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 90));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.secure_url && data.public_id) resolve({ secure_url: data.secure_url, public_id: data.public_id });
              else reject(new Error("Cloudinary did not return a valid URL."));
            } catch {
              reject(new Error("Invalid response from Cloudinary."));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err?.error?.message ?? `Upload failed (${xhr.status}).`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status}).`));
            }
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")));
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
        xhr.send(fd);
      });

      setProgress(95);

      // Step 2: Save metadata via our API
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() ?? "";
      const res = await fetch("/api/assignments/submit-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          fileUrl: cloudResult.secure_url,
          publicId: cloudResult.public_id,
          originalFileName: selectedFile.name,
          fileType: ext,
          mimeType: selectedFile.type || "application/octet-stream",
          fileSize: selectedFile.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save submission.");

      setProgress(100);
      setSubmission(data.submission);
      setSuccess("Assignment submitted successfully!");
      setShowForm(false);
      setSelectedFile(null);
      setProgress(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }, [selectedFile, assignmentId]);

  // ── GRADED STATE ──────────────────────────────────────────────────────────

  if (submission?.grade !== null && submission?.grade !== undefined) {
    const pct   = Math.round((submission.grade / submission.maxGrade) * 100);
    const color = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
    const bg    = pct >= 80 ? "bg-emerald-50 border-emerald-200" : pct >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
    const fileUrl  = submission.fileUrl ?? submission.driveLink;
    const viewUrl  = fileUrl ? getViewUrl(fileUrl, submission.fileType ?? null) : null;

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
          {viewUrl && (
            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:underline font-medium">
              <ExternalLink className="w-3 h-3" />
              {submission.originalFileName ?? "View my submission"}
            </a>
          )}
          <span>Submitted: {new Date(submission.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>
    );
  }

  // ── SUBMITTED (not yet graded) ─────────────────────────────────────────────

  if (submission && !showForm) {
    const fileUrl = submission.fileUrl ?? submission.driveLink;
    const viewUrl = fileUrl ? getViewUrl(fileUrl, submission.fileType ?? null) : null;
    const { Icon, color, bg } = getFileIcon(submission.fileType ?? null, submission.mimeType ?? undefined);

    return (
      <div className="mt-4 rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-blue-800">Submitted — Awaiting Grade</span>
        </div>

        {/* File info */}
        {submission.fileUrl && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bg} text-xs`}>
            <div className={`w-7 h-7 rounded-md flex items-center justify-center border ${bg}`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <span className="font-semibold text-slate-700 truncate">
              {submission.originalFileName ?? "Uploaded file"}
            </span>
            {submission.fileSize && (
              <span className="text-slate-400 shrink-0">· {formatSize(submission.fileSize)}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          {viewUrl && (
            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline font-medium">
              <ExternalLink className="w-3.5 h-3.5" /> View Submission
            </a>
          )}
          <button
            onClick={() => { setShowForm(true); setSelectedFile(null); setError(""); }}
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

  // ── UPLOAD FORM ────────────────────────────────────────────────────────────

  if (showForm) {
    const selExt  = selectedFile?.name.split(".").pop()?.toLowerCase() ?? "";
    const selMime = selectedFile?.type ?? "";
    const { Icon, color, bg } = selectedFile ? getFileIcon(selExt, selMime) : { Icon: File, color: "text-slate-400", bg: "bg-slate-50 border-slate-200" };

    return (
      <div className="mt-4 rounded-xl border-2 border-slate-200 bg-slate-50 p-4 space-y-4">
        <p className="font-semibold text-slate-700 text-sm">Upload your assignment file:</p>

        {/* Drag-and-drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
            ${isDragging ? "border-blue-400 bg-blue-50" : selectedFile ? "border-indigo-300 bg-indigo-50/40" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"}
            ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} disabled={uploading} />

          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 ${bg}`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <p className="font-semibold text-slate-700 text-sm truncate max-w-xs">{selectedFile.name}</p>
              <p className="text-xs text-slate-400">{formatSize(selectedFile.size)}</p>
              {!uploading && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  suppressHydrationWarning
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors mt-1"
                >
                  <X className="w-3 h-3" /> Remove file
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-600 text-sm">Drag & drop your file here</p>
                <p className="text-xs text-slate-400 mt-0.5">or click to browse — PDF, DOC, XLS, PPT, ZIP, images and more</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                {progress < 95 ? "Uploading file…" : "Saving submission…"}
              </span>
              <span className="font-bold text-blue-600">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error / success messages */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" /> {success}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={uploading || !selectedFile}
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1 disabled:opacity-60"
            id="submit-assignment-btn"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading… {progress > 0 && `${progress}%`}</>
              : <><Send className="w-4 h-4 mr-2" /> Submit Assignment</>
            }
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => { setShowForm(false); setSelectedFile(null); setError(""); setProgress(0); }}
            disabled={uploading}
            className="px-4"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── NOT YET SUBMITTED ─────────────────────────────────────────────────────

  return (
    <div className="mt-4">
      <Button
        onClick={() => { setShowForm(true); setError(""); setSelectedFile(null); }}
        className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
        id="submit-assignment-open-btn"
      >
        <Upload className="w-4 h-4 mr-2" /> Upload & Submit Assignment
      </Button>
    </div>
  );
}

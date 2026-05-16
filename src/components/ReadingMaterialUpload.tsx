"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, FileText, File, Image, Archive, Code, BarChart2,
  Trash2, ExternalLink, Loader2, X, CheckCircle2, AlertCircle,
  BookOpen, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaterialAnalyticsButton } from "@/components/MaterialAnalyticsButton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReadingMaterialData {
  id: string;
  title: string;
  link: string | null;
  fileUrl: string | null;
  originalFileName: string | null;
  publicId: string | null;
  fileType: string | null;
  mimeType: string | null;
  resourceType: string | null;
  fileSize: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface Props {
  courseId: string;
}

// ── File icon helper ──────────────────────────────────────────────────────────

function getFileIcon(mimeType: string | null, fileType: string | null) {
  const ext = fileType?.toLowerCase() ?? "";
  const mime = mimeType?.toLowerCase() ?? "";

  if (ext === "pdf" || mime === "application/pdf") {
    return { icon: FileText, color: "text-red-500", bg: "bg-red-50 border-red-100" };
  }
  if (["ppt", "pptx"].includes(ext) || mime.includes("presentationml") || mime.includes("powerpoint")) {
    return { icon: BarChart2, color: "text-orange-500", bg: "bg-orange-50 border-orange-100" };
  }
  if (["doc", "docx"].includes(ext) || mime.includes("wordprocessingml") || mime.includes("msword")) {
    return { icon: FileText, color: "text-blue-500", bg: "bg-blue-50 border-blue-100" };
  }
  if (["xls", "xlsx"].includes(ext) || mime.includes("spreadsheetml") || mime.includes("excel")) {
    return { icon: BarChart2, color: "text-green-500", bg: "bg-green-50 border-green-100" };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || mime.includes("zip") || mime.includes("compressed")) {
    return { icon: Archive, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" };
  }
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext) || mime.startsWith("image/")) {
    return { icon: Image, color: "text-purple-500", bg: "bg-purple-50 border-purple-100" };
  }
  if (["py", "js", "ts", "jsx", "tsx", "html", "css", "json", "txt", "md"].includes(ext) || mime.startsWith("text/")) {
    return { icon: Code, color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
  }
  return { icon: File, color: "text-slate-400", bg: "bg-slate-50 border-slate-200" };
}

// ── File size formatter ───────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Accepted file types for display ──────────────────────────────────────────

const ACCEPTED_DISPLAY =
  "PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, TXT, ZIP, PY, JPG, PNG, JPEG and more";

const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "text/x-python",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
].join(",");

// ── Main Component ────────────────────────────────────────────────────────────

export function ReadingMaterialUpload({ courseId }: Props) {
  const [materials, setMaterials] = useState<ReadingMaterialData[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Upload form state
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Fetch materials list ─────────────────────────────────────────────────────

  const fetchMaterials = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(
        `/api/reading-materials?courseId=${courseId}&t=${Date.now()}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMaterials(data.materials ?? []);
    } catch {
      showToast("error", "Failed to load materials. Please refresh.");
    } finally {
      setLoadingList(false);
    }
  }, [courseId, showToast]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // ── Drag-and-drop handlers ────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
    // Reset input so same file can be re-selected after clear
    e.target.value = "";
  };

  // ── Upload via XHR (real progress) ──────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      showToast("error", "Please enter a title and select a file.");
      return;
    }

    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("title", title.trim());
    fd.append("courseId", courseId);

    setUploading(true);
    setUploadProgress(0);

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Real upload progress from browser
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(pct);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status === 201) {
            resolve();
          } else {
            try {
              const body = JSON.parse(xhr.responseText);
              reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
        xhr.addEventListener("abort", () => reject(new Error("Upload was aborted.")));

        xhr.open("POST", "/api/reading-materials/upload");
        xhr.send(fd);
      });

      showToast("success", `"${title.trim()}" uploaded successfully!`);
      setTitle("");
      setSelectedFile(null);
      setUploadProgress(0);
      await fetchMaterials();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      showToast("error", msg);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/reading-materials?id=${id}&courseId=${courseId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      showToast("info", `"${title}" deleted.`);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete. Please try again.";
      showToast("error", msg);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Toast notifications ─────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium pointer-events-auto transition-all
                ${t.type === "success" ? "bg-green-50 border-green-200 text-green-800" :
                  t.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
                  "bg-slate-50 border-slate-200 text-slate-700"}`}
            >
              {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              {t.type === "error" && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
              {t.type === "info" && <Trash2 className="w-4 h-4 text-slate-400 shrink-0" />}
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismissToast(t.id)}
                suppressHydrationWarning
                className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Upload card ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Upload New Material</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Supports: {ACCEPTED_DISPLAY} — Max 50 MB
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="material-title" className="text-sm font-semibold text-slate-700">
              Material Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="material-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 1 Lecture Notes"
              disabled={uploading}
              className="bg-white"
            />
          </div>

          {/* Drag-and-drop zone */}
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              File <span className="text-red-500">*</span>
            </Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${isDragging
                  ? "border-blue-400 bg-blue-50"
                  : selectedFile
                  ? "border-indigo-300 bg-indigo-50/40"
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
                }
                ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  {(() => {
                    const ext = selectedFile.name.split(".").pop()?.toLowerCase() ?? "";
                    const mime = selectedFile.type;
                    const { icon: Icon, color } = getFileIcon(mime, ext);
                    return <Icon className={`w-10 h-10 ${color}`} />;
                  })()}
                  <p className="font-semibold text-slate-700 text-sm truncate max-w-xs">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(selectedFile.size)}
                  </p>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                      suppressHydrationWarning
                      className="text-xs text-red-400 hover:text-red-600 transition-colors mt-1"
                    >
                      Remove file
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600 text-sm">
                      Drag & drop your file here
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      or click to browse from your computer
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  Uploading…
                </span>
                <span className="font-bold text-blue-600">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit button */}
          <Button
            onClick={handleUpload}
            disabled={uploading || !selectedFile || !title.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 disabled:opacity-60"
            id="upload-material-btn"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading… {uploadProgress > 0 && `${uploadProgress}%`}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Material
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Materials list ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-bold text-slate-700 mb-3">
          Uploaded Materials ({materials.length})
        </h3>

        {loadingList ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400 bg-white rounded-xl border border-slate-200">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span className="text-sm">Loading materials…</span>
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-xl border border-dashed border-slate-200">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-400 text-sm">No materials yet.</p>
            <p className="text-xs text-slate-300 mt-1">Upload your first material above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {materials.map((rm) => {
              const isUploaded = !!rm.fileUrl;
              const fileUrl = rm.fileUrl ?? rm.link ?? "#";
              const { icon: Icon, color, bg } = getFileIcon(rm.mimeType, rm.fileType);
              const isDeleting = deletingId === rm.id;

              return (
                <div
                  key={rm.id}
                  className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* File type icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${bg}`}>
                      {isUploaded
                        ? <Icon className={`w-5 h-5 ${color}`} />
                        : <Link2 className="w-5 h-5 text-slate-400" />
                      }
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{rm.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {isUploaded && rm.originalFileName && (
                          <span className="text-xs text-slate-400 truncate max-w-[180px]">
                            {rm.originalFileName}
                          </span>
                        )}
                        {isUploaded && rm.fileSize && (
                          <>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-400">{formatFileSize(rm.fileSize)}</span>
                          </>
                        )}
                        {isUploaded && rm.fileType && (
                          <>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                              {rm.fileType}
                            </span>
                          </>
                        )}
                        {!isUploaded && (
                          <span className="text-xs text-slate-400 italic">Google Drive link</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    {/* Analytics */}
                    <MaterialAnalyticsButton
                      materialId={rm.id}
                      materialTitle={rm.title}
                      courseId={courseId}
                    />

                    {/* Open / preview */}
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Open file"
                        className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => handleDelete(rm.id, rm.title)}
                      title="Delete material"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      id={`delete-material-${rm.id}`}
                    >
                      {isDeleting
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Trash2, Loader2, X, CheckCircle2, AlertCircle,
  BookOpen, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaterialAnalyticsButton } from "@/components/MaterialAnalyticsButton";
import { FileViewerModal } from "@/components/modals/FileViewerModal";
import { uploadToCloudinaryDirect } from "@/lib/uploads";
import { getFileIcon, formatFileSize, getFileExtension, detectMimeType } from "@/lib/file-utils";
import { MAX_FILE_SIZE, validateFileMetadata } from "@/lib/validation";

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface ReadingMaterialData {
  id: string;
  title: string;
  link: string | null;
  createdAt: string;
  // Legacy fields (backward compat)
  fileUrl: string | null;
  originalFileName: string | null;
  fileType: string | null;
  mimeType: string | null;
  fileSize: number | null;
  // New relation
  fileId: string | null;
  file: UploadedFileInfo | null;
}

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface Props {
  courseId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolves display-friendly file info from a material (new relation or legacy). */
function resolveFileInfo(rm: ReadingMaterialData) {
  if (rm.file) {
    return {
      url:      rm.file.url,
      name:     rm.file.originalName,
      ext:      rm.file.extension,
      mime:     rm.file.mimeType,
      size:     rm.file.size,
    };
  }
  // Legacy
  return {
    url:  rm.fileUrl ?? rm.link ?? "#",
    name: rm.originalFileName ?? rm.title,
    ext:  rm.fileType ?? "",
    mime: rm.mimeType ?? "",
    size: rm.fileSize ?? null,
  };
}

const ACCEPTED_DISPLAY =
  "PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, TXT, ZIP, PY, JPG, PNG and more";

// ── Main Component ────────────────────────────────────────────────────────────

export function ReadingMaterialUpload({ courseId }: Props) {
  const [materials,    setMaterials]    = useState<ReadingMaterialData[]>([]);
  const [loadingList,  setLoadingList]  = useState(true);
  const [title,        setTitle]        = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging,   setIsDragging]   = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [progressMsg,  setProgressMsg]  = useState("");
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [toasts,       setToasts]       = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Toast helpers ─────────────────────────────────────────────────────────

  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Fetch materials list ──────────────────────────────────────────────────

  const fetchMaterials = useCallback(async () => {
    setLoadingList(true);
    try {
      const res  = await fetch(`/api/reading-materials?courseId=${courseId}&t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMaterials(data.materials ?? []);
    } catch {
      showToast("error", "Failed to load materials. Please refresh.");
    } finally {
      setLoadingList(false);
    }
  }, [courseId, showToast]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSetFile(f);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
    e.target.value = "";
  };

  const validateAndSetFile = (f: File) => {
    const mime  = detectMimeType(f.name, f.type);
    const error = validateFileMetadata(f.size, f.name, mime);
    if (error) { showToast("error", error); return; }
    if (f.size > MAX_FILE_SIZE) { showToast("error", "File exceeds 50 MB limit."); return; }
    setSelectedFile(f);
  };

  // ── Upload: browser → Cloudinary → our API ────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      showToast("error", "Please enter a title and select a file.");
      return;
    }

    let cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    let uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_MATERIALS_PRESET;

    if (!cloudName || !uploadPreset) {
      try {
        const configRes = await fetch("/api/config");
        if (configRes.ok) {
          const configData = await configRes.json();
          cloudName = cloudName || configData.cloudinaryCloudName;
          uploadPreset = uploadPreset || configData.cloudinaryMaterialsPreset;
        }
      } catch (err) {
        console.error("Failed to fetch runtime upload config:", err);
      }
    }

    if (!cloudName || !uploadPreset) {
      showToast("error", "Upload not configured. Contact administrator.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setProgressMsg("Uploading to Cloudinary…");

    try {
      // Step 1: Upload directly to Cloudinary from browser
      const cloudResult = await uploadToCloudinaryDirect(selectedFile, {
        cloudName,
        preset: uploadPreset,
        onProgress: (pct) => setProgress(pct),
      });

      setProgress(95);
      setProgressMsg("Saving material record…");

      // Step 2: Save metadata to our API
      const ext      = getFileExtension(selectedFile.name);
      const mimeType = detectMimeType(selectedFile.name, selectedFile.type);

      const res  = await fetch("/api/reading-materials/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          url:          cloudResult.secure_url,
          publicId:     cloudResult.public_id,
          resourceType: cloudResult.resource_type,
          originalName: selectedFile.name,
          mimeType,
          size:         selectedFile.size,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }

      setProgress(100);
      showToast("success", `"${title.trim()}" uploaded successfully!`);
      setTitle("");
      setSelectedFile(null);
      await fetchMaterials();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
      setProgressMsg("");
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string, materialTitle: string) => {
    if (!confirm(`Delete "${materialTitle}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reading-materials?id=${id}&courseId=${courseId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      showToast("info", `"${materialTitle}" deleted.`);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium pointer-events-auto transition-all
                ${t.type === "success" ? "bg-green-50 border-green-200 text-green-800"
                  : t.type === "error"   ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-slate-50 border-slate-200 text-slate-700"}`}
            >
              {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              {t.type === "error"   && <AlertCircle  className="w-4 h-4 text-red-500 shrink-0" />}
              {t.type === "info"    && <Trash2       className="w-4 h-4 text-slate-400 shrink-0" />}
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismissToast(t.id)} suppressHydrationWarning
                className="ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload card */}
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

          {/* Drop zone */}
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
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"}
                ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={handleFileChange} disabled={uploading} />

              {selectedFile ? (() => {
                const { Icon, color } = getFileIcon(selectedFile.name, selectedFile.type);
                return (
                  <div className="flex flex-col items-center gap-2">
                    <Icon className={`w-10 h-10 ${color}`} />
                    <p className="font-semibold text-slate-700 text-sm truncate max-w-xs">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">{formatFileSize(selectedFile.size)}</p>
                    {!uploading && (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                        suppressHydrationWarning
                        className="text-xs text-red-400 hover:text-red-600 transition-colors mt-1">
                        Remove file
                      </button>
                    )}
                  </div>
                );
              })() : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600 text-sm">Drag & drop your file here</p>
                    <p className="text-xs text-slate-400 mt-0.5">or click to browse from your computer</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  {progressMsg || "Uploading…"}
                </span>
                <span className="font-bold text-blue-600">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading || !selectedFile || !title.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 disabled:opacity-60"
            id="upload-material-btn"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading… {progress > 0 && `${progress}%`}</>
              : <><Upload className="w-4 h-4 mr-2" />Upload Material</>}
          </Button>
        </div>
      </div>

      {/* Materials list */}
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
              const { url, name, ext, mime, size } = resolveFileInfo(rm);
              const isUploaded  = !!(rm.file ?? rm.fileUrl);
              const { Icon, color, bg } = getFileIcon(name, mime);
              const isDeleting  = deletingId === rm.id;

              return (
                <div key={rm.id}
                  className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${bg}`}>
                      {isUploaded
                        ? <Icon className={`w-5 h-5 ${color}`} />
                        : <Link2 className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{rm.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {isUploaded && name && (
                          <span className="text-xs text-slate-400 truncate max-w-[180px]">{name}</span>
                        )}
                        {isUploaded && size && (
                          <><span className="text-slate-300 text-xs">·</span>
                          <span className="text-xs text-slate-400">{formatFileSize(size)}</span></>
                        )}
                        {isUploaded && ext && (
                          <><span className="text-slate-300 text-xs">·</span>
                          <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">{ext}</span></>
                        )}
                        {!isUploaded && (
                          <span className="text-xs text-slate-400 italic">Google Drive link</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <MaterialAnalyticsButton
                      materialId={rm.id}
                      materialTitle={rm.title}
                      courseId={courseId}
                    />

                    {/* Preview via FileViewerModal */}
                    {isUploaded && (
                      <FileViewerModal
                        url={url}
                        title={rm.title}
                        fileName={name}
                        mimeType={mime}
                        fileSize={size}
                      >
                        <Button variant="ghost" size="sm" title="Preview file"
                          className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <BookOpen className="w-4 h-4" />
                        </Button>
                      </FileViewerModal>
                    )}

                    <Button variant="ghost" size="sm" disabled={isDeleting}
                      onClick={() => handleDelete(rm.id, rm.title)}
                      title="Delete material"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      id={`delete-material-${rm.id}`}>
                      {isDeleting
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2  className="w-4 h-4" />}
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

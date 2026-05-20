"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { X, BookOpen, Copy, Check, Download } from "lucide-react";
import { UniversalFileViewer } from "@/components/file-viewer/UniversalFileViewer";
import { getFileIcon, formatFileSize } from "@/lib/file-utils";

export interface FileViewerModalProps {
  /** Direct file URL (Cloudinary secure_url or legacy URL) */
  url: string;
  /** Display title shown in the modal header */
  title: string;
  /** Original file name (used for download + type detection) */
  fileName: string;
  /** MIME type if known */
  mimeType?: string | null;
  /** File size in bytes */
  fileSize?: number | null;
  /** Optional material ID for analytics tracking */
  materialId?: string;
  /** Trigger element */
  children: ReactNode;
}

export function FileViewerModal({
  url,
  title,
  fileName,
  mimeType,
  fileSize,
  materialId,
  children,
}: FileViewerModalProps) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef            = useRef<HTMLButtonElement>(null);

  const { Icon, color } = getFileIcon(fileName, mimeType);

  // ── Open ──────────────────────────────────────────────────────────────────
  const handleOpen = useCallback(() => {
    setOpen(true);
    // Fire analytics if a materialId was provided (safe: client component)
    if (materialId) {
      fetch("/api/material-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      }).catch(() => {});
    }
  }, [materialId]);

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => setOpen(false), []);

  // ── ESC to close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  // ── Prevent body scroll ───────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ── Focus trap: focus the close button when modal opens ───────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => closeRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Copy link ─────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [url]);

  return (
    <>
      {/* ── Trigger ── */}
      <span
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleOpen()}
        className="inline-flex cursor-pointer"
        aria-label={`Open file: ${title}`}
      >
        {children}
      </span>

      {/* ── Modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Viewing: ${title}`}
        >
          {/* ── Top bar ── */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700/60 shadow-lg shrink-0 gap-3">
            {/* Left: file info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm leading-tight truncate max-w-[45vw] sm:max-w-[60vw]">
                  {title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Icon className={`w-3 h-3 ${color}`} />
                  <p className="text-xs text-slate-400 truncate">{fileName}</p>
                  {fileSize && (
                    <span className="text-xs text-slate-500 shrink-0">
                      · {formatFileSize(fileSize)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Copy link */}
              <button
                onClick={handleCopy}
                title="Copy link"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                suppressHydrationWarning
              >
                {copied
                  ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Copied!</span></>
                  : <><Copy className="w-3.5 h-3.5" /><span className="hidden sm:inline">Copy link</span></>}
              </button>

              {/* Download */}
              <a
                href={url}
                download={fileName}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>

              {/* Close */}
              <button
                ref={closeRef}
                onClick={handleClose}
                title="Close (Esc)"
                aria-label="Close viewer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-red-700/70 transition-colors ml-1"
                suppressHydrationWarning
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* ── Viewer body ── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <UniversalFileViewer
              url={url}
              fileName={fileName}
              mimeType={mimeType}
              fileSize={fileSize}
            />
          </div>
        </div>
      )}
    </>
  );
}

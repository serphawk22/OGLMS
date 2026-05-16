"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X, BookOpen, Copy, Check, Loader2, AlertTriangle,
  Download, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── File-type classification ─────────────────────────────────────────────────

/**
 * Extensions / MIME types that can be rendered inline in an <iframe>.
 * Everything else is opened externally (download or new tab).
 */
const PREVIEWABLE_EXTS = new Set([
  "pdf",
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
  "txt",
]);

const PREVIEWABLE_MIME_PREFIXES = ["image/", "text/plain", "application/pdf"];

function isPreviewable(ext: string, mimeType: string | null): boolean {
  const e = ext.toLowerCase().trim();
  if (PREVIEWABLE_EXTS.has(e)) return true;
  if (mimeType) {
    return PREVIEWABLE_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
  }
  return false;
}

// ─── Google Drive helpers ─────────────────────────────────────────────────────

function isDriveUrl(url: string): boolean {
  return /drive\.google\.com\/(file\/d\/|open\?id=|uc\?)/.test(url);
}

function toDriveEmbed(url: string): string {
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  return url;
}

// ─── Cloudinary inline URL helper ────────────────────────────────────────────
/**
 * For Cloudinary raw uploads, the default Content-Disposition is 'attachment'.
 * Injecting 'fl_inline' forces the browser to display/open the file instead
 * of downloading it. Falls back to the original URL for non-Cloudinary URLs.
 */
function toInlineUrl(url: string): string {
  // Only transform Cloudinary URLs
  if (!url.includes("res.cloudinary.com")) return url;
  // Already has fl_inline — no-op
  if (url.includes("fl_inline")) return url;
  // Insert fl_inline after /upload/
  return url.replace("/upload/", "/upload/fl_inline/");
}

// ─── Embed URL resolver (only called for previewable types) ───────────────────

function resolveEmbedUrl(url: string, ext: string, mimeType: string | null): string {
  const isPdf = mimeType === "application/pdf" || ext === "pdf";
  if (isDriveUrl(url)) return toDriveEmbed(url);
  if (isPdf) return `${url}#toolbar=0&navpanes=0&scrollbar=1`;
  // Images and text — embed directly
  return url;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MaterialViewerModalProps {
  /** Raw file URL or Drive/external link */
  url: string;
  /** Display title shown in the modal header */
  title: string;
  /** File extension (lower-case, no dot) */
  ext?: string;
  /** MIME type if known */
  mimeType?: string | null;
  /** Reading-material record ID for analytics tracking */
  materialId?: string;
  /** Message to log in student activity feed */
  activityMessage?: string;
  /** Trigger element rendered as children */
  children: React.ReactNode;
}

export function MaterialViewerModal({
  url,
  title,
  ext = "",
  mimeType = null,
  materialId,
  activityMessage,
  children,
}: MaterialViewerModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Determine preview mode ONCE on render
  const canPreview = isPreviewable(ext, mimeType);
  const embedUrl = canPreview ? resolveEmbedUrl(url, ext, mimeType) : "";

  // ── analytics (fire-and-forget) ─────────────────────────────────────────
  const trackView = useCallback(() => {
    if (activityMessage) {
      fetch("/api/student/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "MATERIAL", message: activityMessage }),
      }).catch(() => {});
    }
    if (materialId) {
      fetch("/api/material-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      }).catch(() => {});
    }
  }, [activityMessage, materialId]);

  // ── open / close ────────────────────────────────────────────────────────
  const handleOpen = useCallback(() => {
    // Non-previewable files: open inline in new tab (no forced download)
    if (!canPreview) {
      trackView();
      window.open(toInlineUrl(url), "_blank", "noopener,noreferrer");
      return;
    }
    setOpen(true);
    setLoading(true);
    setIframeLoaded(false);
    setIframeError(false);
    trackView();
  }, [canPreview, url, trackView]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setLoading(false);
    setIframeLoaded(false);
    setIframeError(false);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // 15-second iframe timeout (only for previewable types)
  useEffect(() => {
    if (!open || !loading || !canPreview) return;
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        setLoading(false);
        setIframeError(true);
      }
    }, 15_000);
    return () => clearTimeout(timer);
  }, [open, loading, iframeLoaded, canPreview]);

  // ── copy-link helper ─────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [url]);

  // ── iframe handlers ──────────────────────────────────────────────────────
  const handleIframeLoad = useCallback(() => {
    setLoading(false);
    setIframeLoaded(true);
  }, []);

  return (
    <>
      {/* ── trigger ── */}
      <span
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleOpen()}
        className="inline-flex cursor-pointer"
        aria-label={`Open material: ${title}`}
      >
        {children}
      </span>

      {/* ── modal overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Viewing: ${title}`}
        >
          {/* ── top bar ── */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700/60 shadow-lg shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm leading-tight truncate max-w-[60vw]">
                  {title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inline Preview
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Download button — explicit separate action */}
              <a
                href={url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>

              {/* Copy link */}
              <button
                onClick={handleCopy}
                title="Copy link"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" suppressHydrationWarning
              >
                {copied ? (
                  <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                ) : (
                  <><Copy className="w-3.5 h-3.5" />Copy link</>
                )}
              </button>

              {/* Close */}
              <button
                onClick={handleClose}
                title="Close viewer (Esc)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-red-700/70 transition-colors" suppressHydrationWarning
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              PREVIEWABLE ONLY: PDF, images, plain text
              (Non-previewable files never reach here — window.open fires
               directly in handleOpen and the modal is never opened.)
          ════════════════════════════════════════════════════════════════ */}
          {canPreview && (
            <>
              {/* Loading spinner */}
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                  <div className="flex flex-col items-center gap-4 bg-slate-900/90 rounded-2xl px-10 py-8 shadow-2xl border border-slate-700">
                    <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
                    <p className="text-slate-300 font-medium text-sm animate-pulse">
                      Loading preview…
                    </p>
                  </div>
                </div>
              )}

              {/* iframe error fallback */}
              {iframeError && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                  <div className="bg-slate-800 border border-amber-500/30 rounded-2xl px-10 py-10 flex flex-col items-center gap-4 max-w-md w-full shadow-xl">
                    <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <AlertTriangle className="w-7 h-7 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white text-center">
                      Preview Unavailable
                    </h3>
                    <p className="text-slate-400 text-sm text-center leading-relaxed">
                      This file could not be embedded. Try downloading it or
                      opening it directly.
                    </p>
                    <div className="flex flex-col gap-3 w-full mt-2">
                      <a
                        href={url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                      >
                        <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                          <Download className="w-4 h-4 mr-2" /> Download File
                        </Button>
                      </a>
                      <button
                        onClick={() => window.open(toInlineUrl(url), "_blank", "noopener,noreferrer")}
                        className="w-full"
                        suppressHydrationWarning
                      >
                        <Button variant="outline" className="w-full border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white">
                          <ExternalLink className="w-4 h-4 mr-2" /> Open in New Tab
                        </Button>
                      </button>
                      <Button
                        onClick={handleCopy}
                        variant="outline"
                        className="w-full border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
                      >
                        {copied ? (
                          <><Check className="w-4 h-4 mr-2 text-emerald-400" />Copied!</>
                        ) : (
                          <><Copy className="w-4 h-4 mr-2" />Copy Link</>
                        )}
                      </Button>
                    </div>
                    <button
                      onClick={handleClose}
                      className="text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors" suppressHydrationWarning
                    >
                      Go back to course
                    </button>
                  </div>
                </div>
              )}

              {/* iframe (PDF / images / txt) */}
              {!iframeError && (
                <iframe
                  key={embedUrl}
                  src={embedUrl}
                  title={title}
                  className="flex-1 w-full border-0 bg-white"
                  onLoad={handleIframeLoad}
                  style={{ opacity: iframeLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                  referrerPolicy="no-referrer"
                />
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

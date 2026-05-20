"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, Download, ExternalLink, RefreshCw,
  FileText, AlertTriangle, Copy, Check,
  Code2, Archive, FileImage, Sheet,
} from "lucide-react";

// ─── File category types ───────────────────────────────────────────────────────

type FileCategory =
  | "pdf"          // native iframe
  | "image"        // <img>
  | "office"       // MS Office Viewer → Google Docs → open tab
  | "spreadsheet"  // MS Office Viewer → download
  | "code"         // fetch → <pre> code block
  | "text"         // fetch → <pre> plain text
  | "zip"          // download card only
  | "unsupported"; // download card only

const PDF_EXTS         = new Set(["pdf"]);
const IMAGE_EXTS       = new Set(["jpg","jpeg","png","gif","webp","svg","bmp","avif","ico","tiff"]);
const OFFICE_EXTS      = new Set(["doc","docx","ppt","pptx"]);
const SPREADSHEET_EXTS = new Set(["xls","xlsx","csv"]);
const CODE_EXTS        = new Set([
  "py","java","js","ts","jsx","tsx","json","xml","html","css","scss",
  "yml","yaml","toml","ini","sh","bash","php","c","cpp","h","cs","go",
  "rb","rs","swift","kt","sql","env","graphql","vue","svelte",
]);
const TEXT_EXTS        = new Set(["txt","md","markdown","log","readme","rst","text"]);
const ZIP_EXTS         = new Set(["zip","rar","7z","tar","gz","tgz","bz2","xz","zst"]);

/** Detect category from extension (primary) and MIME type (fallback). */
function getCategory(ext: string, mimeType?: string | null): FileCategory {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (PDF_EXTS.has(e))         return "pdf";
  if (IMAGE_EXTS.has(e))       return "image";
  if (OFFICE_EXTS.has(e))      return "office";
  if (SPREADSHEET_EXTS.has(e)) return "spreadsheet";
  if (CODE_EXTS.has(e))        return "code";
  if (TEXT_EXTS.has(e))        return "text";
  if (ZIP_EXTS.has(e))         return "zip";

  // MIME-based fallback (when extension is absent/wrong)
  if (mimeType) {
    if (mimeType === "application/pdf")                                return "pdf";
    if (mimeType.startsWith("image/"))                                 return "image";
    if (mimeType.includes("word") || mimeType.includes("presentation"))return "office";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))return "spreadsheet";
    if (mimeType.startsWith("text/"))                                  return "text";
    if (mimeType.includes("zip") || mimeType.includes("archive"))      return "zip";
    if (mimeType.startsWith("application/json") ||
        mimeType.startsWith("application/xml"))                        return "code";
  }
  return "unsupported";
}

/** Max size for code/text fetch preview (1 MB). */
const MAX_PREVIEW_BYTES = 1024 * 1024;

// ─── Shared helpers ────────────────────────────────────────────────────────────

/** Always-visible open/download action row. */
function FileActions({ url, fileName }: { url: string; fileName: string }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" /> Open in Tab
      </a>
      <a
        href={url}
        download={fileName}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
      >
        <Download className="w-3.5 h-3.5" /> Download
      </a>
    </div>
  );
}

/** Centered loading spinner. */
function Spinner({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 z-10">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      {label && <p className="text-xs text-slate-400">{label}</p>}
    </div>
  );
}

/** Download-only card (zip / unsupported). */
function DownloadCard({ url, fileName, label }: { url: string; fileName: string; label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-slate-700/60 border border-slate-600 flex items-center justify-center mx-auto">
          <Archive className="w-8 h-8 text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-200 text-sm">{fileName}</p>
          <p className="text-xs text-slate-500 mt-1">{label}</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Open File
          </a>
          <a
            href={url}
            download={fileName}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" /> Download
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── 1. PDF Viewer ─────────────────────────────────────────────────────────────
// Strategy: native <iframe> only — DO NOT use Google/Office Viewer for PDFs.
// Browser handles PDF rendering natively (Chrome, Firefox, Edge all support it).

function PdfViewer({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(url, { method: "GET" })
      .then((res) => {
        if (!active) return;
        if (res.status === 401) {
          setError("401");
        }
      })
      .catch((err) => {
        console.warn("Failed to pre-check PDF access:", err);
      });
    return () => {
      active = false;
    };
  }, [url]);

  if (error === "401") {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-900 text-slate-300">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <p className="font-semibold text-slate-200 text-sm">Failed to load PDF document (401 Unauthorized)</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            This error usually occurs because PDF delivery is restricted in your Cloudinary account security settings.
          </p>
          <div className="text-left bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">How to fix this in Cloudinary:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Log in to your <strong>Cloudinary Console</strong>.</li>
              <li>Open <strong>Settings</strong> (gear icon) &gt; <strong>Security</strong> tab.</li>
              <li>Scroll to <strong>PDF and ZIP files delivery</strong>.</li>
              <li>Enable <strong>"Allow delivery of PDF and ZIP files"</strong> and save your changes.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0" style={{ height: "100%" }}>
      {!loaded && <Spinner label="Loading PDF…" />}
      <iframe
        src={url}
        title="PDF preview"
        className="flex-1 w-full border-0 bg-white"
        style={{ height: "100%", minHeight: 0 }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// ─── 2. Image Viewer ──────────────────────────────────────────────────────────
// Strategy: plain <img> tag — DO NOT use Next.js <Image> for raw Cloudinary URLs.

function ImageViewer({ url, fileName }: { url: string; fileName: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error,  setError]  = useState(false);
  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-slate-950 overflow-auto">
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      )}
      {error ? (
        <div className="text-center text-slate-400 space-y-2">
          <FileImage className="w-12 h-12 mx-auto text-slate-600" />
          <p className="text-sm">Image could not be loaded.</p>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={fileName}
          className="max-w-full max-h-full object-contain rounded shadow-lg"
          style={{ display: loaded ? "block" : "none" }}
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(true); setError(true); }}
          loading="lazy"
        />
      )}
    </div>
  );
}

// ─── 3. Office Viewer (DOC/DOCX/PPT/PPTX) ────────────────────────────────────
// Strategy: MS Office Viewer first → Google Docs Viewer fallback → open in tab.
// DO NOT use for PDFs or spreadsheets.

type OfficeEngine = "microsoft" | "google" | "none";

function OfficeViewer({ url, fileName }: { url: string; fileName: string }) {
  const [engine, setEngine] = useState<OfficeEngine>("microsoft");
  const [loaded, setLoaded] = useState(false);

  // Auto-timeout 20 s: if Microsoft viewer doesn't load, try Google
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (engine === "none") return;
    setLoaded(false);
    clearTimeout(timeoutRef.current);
    if (engine === "microsoft") {
      timeoutRef.current = setTimeout(() => {
        setEngine("google");
      }, 20_000);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [engine]);

  const encoded    = encodeURIComponent(url);
  const msUrl      = `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`;
  const googleUrl  = `https://docs.google.com/viewer?url=${encoded}&embedded=true`;
  const src        = engine === "microsoft" ? msUrl : googleUrl;
  const engineLabel = engine === "microsoft" ? "Microsoft Office Viewer" : "Google Docs Viewer";

  if (engine === "none") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
          <p className="text-slate-300 font-semibold text-sm">Preview unavailable</p>
          <p className="text-slate-500 text-xs">Both viewers failed. Use the buttons above to open or download.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0" style={{ height: "100%" }}>
      {!loaded && <Spinner label={`Loading via ${engineLabel}…`} />}
      <iframe
        key={engine}
        src={src}
        title={`Document preview (${engineLabel})`}
        className="flex-1 w-full border-0 bg-white"
        style={{ height: "100%", minHeight: 0 }}
        onLoad={() => { setLoaded(true); clearTimeout(timeoutRef.current); }}
        onError={() => {
          clearTimeout(timeoutRef.current);
          setEngine((e) => e === "microsoft" ? "google" : "none");
        }}
      />
      {/* Engine switcher */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800/90 border-t border-slate-700 shrink-0 text-xs text-slate-400">
        <span>{engineLabel}</span>
        <button
          onClick={() => {
            clearTimeout(timeoutRef.current);
            setEngine((e) => e === "microsoft" ? "google" : "microsoft");
            setLoaded(false);
          }}
          className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors"
          suppressHydrationWarning
        >
          <RefreshCw className="w-3 h-3" />
          {engine === "microsoft" ? "Switch to Google Docs" : "Switch to MS Office"}
        </button>
      </div>
    </div>
  );
}

// ─── 4. Spreadsheet Viewer (XLS/XLSX/CSV) ────────────────────────────────────
// Strategy: MS Office Viewer only — Google Docs Viewer handles spreadsheets poorly.
// Fallback: download card.

function SpreadsheetViewer({ url, fileName }: { url: string; fileName: string }) {
  const [loaded,  setLoaded]  = useState(false);
  const [failed,  setFailed]  = useState(false);

  const msUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  useEffect(() => {
    const t = setTimeout(() => { if (!loaded) setFailed(true); }, 25_000);
    return () => clearTimeout(t);
  }, [loaded]);

  if (failed) return <DownloadCard url={url} fileName={fileName} label="Spreadsheet preview unavailable — download to open in Excel or Google Sheets." />;

  return (
    <div className="relative flex-1 flex flex-col min-h-0" style={{ height: "100%" }}>
      {!loaded && <Spinner label="Loading spreadsheet via Microsoft Viewer…" />}
      <iframe
        src={msUrl}
        title="Spreadsheet preview"
        className="flex-1 w-full border-0 bg-white"
        style={{ height: "100%", minHeight: 0 }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ─── 5. Code Viewer (PY/JS/JSON/XML/TS etc.) ─────────────────────────────────
// Strategy: fetch text content, validate content-type, render in <pre>.
// DO NOT iframe code files.

const CODE_LANG_MAP: Record<string, string> = {
  py: "python", js: "javascript", ts: "typescript", jsx: "javascript",
  tsx: "typescript", java: "java", json: "json", xml: "xml", html: "html",
  css: "css", scss: "scss", sh: "bash", bash: "bash", sql: "sql",
  go: "go", rb: "ruby", rs: "rust", php: "php", c: "c", cpp: "cpp",
  cs: "csharp", kt: "kotlin", swift: "swift", yml: "yaml", yaml: "yaml",
  toml: "toml", graphql: "graphql",
};

function CodeViewer({ url, ext, fileName }: { url: string; ext: string; fileName: string }) {
  const [content,  setContent]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [copied,   setCopied]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setContent(null);
    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const ct = res.headers.get("content-type") ?? "";
        // Validate: must be text/* or known code MIME
        const isText = ct.startsWith("text/") ||
          ct.includes("json") || ct.includes("xml") ||
          ct.includes("javascript") || ct.includes("python") ||
          ct.includes("yaml") || ct.includes("octet-stream");
        if (!isText) throw new Error(`Unexpected content-type: ${ct.split(";")[0]}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");
        let total = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_PREVIEW_BYTES) {
            reader.cancel();
            chunks.push(value);
            if (!cancelled) {
              const partial = new TextDecoder().decode(
                new Uint8Array(chunks.reduce((acc: number[], c) => [...acc, ...Array.from(c)], []))
              );
              setContent(partial + "\n\n… [file truncated — exceeds 1 MB preview limit]");
              setLoading(false);
            }
            return;
          }
          chunks.push(value);
        }
        if (!cancelled) {
          const text = new TextDecoder().decode(
            new Uint8Array(chunks.reduce((acc: number[], c) => [...acc, ...Array.from(c)], []))
          );
          setContent(text);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load file");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const handleCopy = useCallback(async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-xs text-slate-400">Fetching file contents…</p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <p className="text-slate-300 font-semibold text-sm">Could not load file</p>
          <p className="text-slate-500 text-xs max-w-xs">{error ?? "Unknown error"}</p>
          <FileActions url={url} fileName={fileName} />
        </div>
      </div>
    );
  }

  const lang = CODE_LANG_MAP[ext.toLowerCase()] ?? "text";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Code toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs text-slate-400 font-mono">{fileName}</span>
          <span className="text-xs text-slate-600 font-mono bg-slate-700 px-1.5 py-0.5 rounded">{lang}</span>
        </div>
        <button
          onClick={handleCopy}
          suppressHydrationWarning
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
        </button>
      </div>
      {/* Code content */}
      <div className="flex-1 overflow-auto bg-slate-950">
        <pre
          className="p-4 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap break-words"
          style={{ tabSize: 2 }}
        >
          {content}
        </pre>
      </div>
    </div>
  );
}

// ─── 6. Text Viewer ───────────────────────────────────────────────────────────
// Strategy: same as code viewer but without syntax-highlight toolbar.

function TextViewer({ url, fileName }: { url: string; fileName: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) {
          setContent(text.length > MAX_PREVIEW_BYTES
            ? text.slice(0, MAX_PREVIEW_BYTES) + "\n\n… [truncated at 1 MB]"
            : text
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </div>
  );

  if (error || !content) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <p className="text-slate-300 text-sm">{error ?? "Could not load file"}</p>
        <FileActions url={url} fileName={fileName} />
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-4">
      <pre className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </pre>
    </div>
  );
}

// ─── Error Boundary ────────────────────────────────────────────────────────────

interface EBState { hasError: boolean }
class ViewerErrorBoundary extends React.Component<{ children: React.ReactNode; url: string; fileName: string }, EBState> {
  constructor(props: { children: React.ReactNode; url: string; fileName: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
            <p className="text-slate-200 font-semibold">Viewer crashed</p>
            <FileActions url={this.props.url} fileName={this.props.fileName} />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export interface UniversalFileViewerProps {
  /** Public file URL (Cloudinary secure_url or any public URL) */
  url: string;
  /** Original file name with extension */
  fileName: string;
  /** MIME type if known (used as fallback for category detection) */
  mimeType?: string | null;
  /** File size in bytes */
  fileSize?: number | null;
}

/** Format bytes as KB / MB. */
function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Get file extension from file name. */
function getExt(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function UniversalFileViewer({ url, fileName, mimeType, fileSize }: UniversalFileViewerProps) {
  const ext      = getExt(fileName);
  const category = getCategory(ext, mimeType);

  // ── Top bar ────────────────────────────────────────────────────────────────
  const topBar = (
    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200 truncate">{fileName}</span>
        {ext && (
          <span className="shrink-0 text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
            {ext}
          </span>
        )}
        {fileSize && (
          <span className="shrink-0 text-xs text-slate-500">{fmtSize(fileSize)}</span>
        )}
      </div>
      <FileActions url={url} fileName={fileName} />
    </div>
  );

  // ── Viewer by category ──────────────────────────────────────────────────────
  const renderContent = () => {
    switch (category) {
      case "pdf":
        return <PdfViewer url={url} />;

      case "image":
        return <ImageViewer url={url} fileName={fileName} />;

      case "office":
        return <OfficeViewer url={url} fileName={fileName} />;

      case "spreadsheet":
        return <SpreadsheetViewer url={url} fileName={fileName} />;

      case "code":
        return <CodeViewer url={url} ext={ext} fileName={fileName} />;

      case "text":
        return <TextViewer url={url} fileName={fileName} />;

      case "zip":
        return <DownloadCard url={url} fileName={fileName} label="Compressed archive — download to extract." />;

      default:
        return <DownloadCard url={url} fileName={fileName} label={`No preview available for .${ext || "unknown"} files.`} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {topBar}
      <ViewerErrorBoundary url={url} fileName={fileName}>
        {renderContent()}
      </ViewerErrorBoundary>
    </div>
  );
}

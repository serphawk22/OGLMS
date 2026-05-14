"use client";

import { useState, useCallback } from "react";
import { Eye, X, Loader2, CheckCircle2, XCircle, BarChart2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentAnalytic {
  studentId: string;
  name: string;
  email: string;
  viewed: boolean;
  viewedAt: string | null;
  viewCount: number;
}

interface Props {
  materialId: string;
  materialTitle: string;
  courseId: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function MaterialAnalyticsButton({ materialId, materialTitle, courseId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<StudentAnalytic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/material-views?materialId=${materialId}&courseId=${courseId}&t=${Date.now()}`
      );
      const data = await res.json();
      setAnalytics(data.analytics ?? []);
    } catch {
      setError("Failed to load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [materialId, courseId]);

  const handleOpen = async () => {
    setOpen(true);
    // Always re-fetch fresh data on open (never use stale cache)
    await fetchAnalytics();
  };

  const handleClose = () => {
    setOpen(false);
    // Clear so next open always fetches fresh data
    setAnalytics(null);
  };

  const viewedCount = analytics?.filter((a) => a.viewed).length ?? 0;
  const total = analytics?.length ?? 0;

  return (
    <>
      {/* Eye icon trigger */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        title="View analytics"
        id={`analytics-btn-${materialId}`}
        className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <Eye className="w-4 h-4" />
      </Button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart2 className="w-5 h-5 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-800 truncate">View Analytics</h2>
                  <p className="text-xs text-slate-400 truncate">{materialTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {analytics && (
                  <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                    {viewedCount} / {total} viewed
                  </span>
                )}
                {/* Refresh button */}
                <button
                  onClick={fetchAnalytics}
                  disabled={loading}
                  title="Refresh analytics"
                  aria-label="Refresh analytics"
                  className="text-slate-400 hover:text-indigo-600 transition-colors p-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={handleClose}
                  aria-label="Close analytics"
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              {loading && (
                <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  <span>Loading analytics…</span>
                </div>
              )}

              {!loading && error && (
                <div className="text-center py-12 text-red-500 text-sm px-6">{error}</div>
              )}

              {!loading && !error && analytics?.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm">
                  No students enrolled in this course yet.
                </div>
              )}

              {!loading && !error && analytics && analytics.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr>
                      <th className="text-left px-6 py-3 font-semibold text-slate-600">#</th>
                      <th className="text-left px-6 py-3 font-semibold text-slate-600">Student</th>
                      <th className="text-left px-6 py-3 font-semibold text-slate-600">Email</th>
                      <th className="text-center px-6 py-3 font-semibold text-slate-600">Status</th>
                      <th className="text-left px-6 py-3 font-semibold text-slate-600">Last Opened</th>
                      <th className="text-center px-6 py-3 font-semibold text-slate-600">Opens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.map((row, idx) => (
                      <tr
                        key={row.studentId}
                        className={`hover:bg-slate-50 transition-colors ${row.viewed ? "" : "opacity-60"}`}
                      >
                        <td className="px-6 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              row.viewed ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                            }`}>
                              {row.name[0]?.toUpperCase() ?? "?"}
                            </div>
                            <span className="font-medium text-slate-800">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-500 text-xs">{row.email}</td>
                        <td className="px-6 py-3 text-center">
                          {row.viewed ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Viewed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3" /> Not Viewed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-500 text-xs">
                          {row.viewedAt ? formatDateTime(row.viewedAt) : "—"}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`text-xs font-bold ${row.viewCount > 0 ? "text-indigo-600" : "text-slate-300"}`}>
                            {row.viewCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import { X, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Enrollment {
  id: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  courseId: string;
  progress: number;
}

interface Props {
  orgId: string;
  onClose: () => void;
}

export function AdminEnrollmentModal({ orgId, onClose }: Props) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");

  useEffect(() => {
    fetch(`/api/admin/enrollments?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d) => { setEnrollments(d.enrollments ?? []); setLoading(false); });
  }, [orgId]);

  const filtered = enrollments.filter(
    (e) =>
      e.studentName.toLowerCase().includes(search.toLowerCase()) ||
      e.courseTitle.toLowerCase().includes(search.toLowerCase()) ||
      e.studentEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-pink-500" />
            <h2 className="text-base font-bold text-slate-900">Enrollment Details</h2>
            {!loading && (
              <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-bold ml-1">
                {enrollments.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100">
          <input
            type="text"
            placeholder="Search by student or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
          />
        </div>

        {/* Body */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-16">No enrollments found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
                <tr>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Course</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-5">
                      <p className="font-medium text-slate-800">{e.studentName}</p>
                      <p className="text-xs text-slate-400">{e.studentEmail}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 text-xs">{e.courseTitle}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {Math.round(e.progress)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-slate-600">Close</Button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { X, Trash2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Student {
  memberId: string;
  userId: string;
  name: string;
  email: string;
}

interface Props {
  orgId: string;
  onClose: () => void;
}

// orgId used in DELETE body for server-side org validation

export function AdminStudentModal({ orgId, onClose }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/students?orgId=${orgId}`);
    const data = await res.json();
    setStudents(data.students ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [orgId]);

  async function handleDelete(memberId: string) {
    if (!confirm("Remove this student from the workspace?")) return;
    setDeleting(memberId);
    await fetch("/api/admin/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, orgId }),
    });
    setDeleting(null);
    setStudents((prev) => prev.filter((s) => s.memberId !== memberId));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-bold text-slate-900">Student Directory</h2>
            {!loading && (
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold ml-1">
                {students.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[480px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-16">No students in this workspace yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
                <tr>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map((s) => (
                  <tr key={s.memberId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-5 font-medium text-slate-800">{s.name}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{s.email}</td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(s.memberId)}
                        disabled={deleting === s.memberId}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        {deleting === s.memberId
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </Button>
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

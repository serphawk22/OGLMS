import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, UserCheck, Clock } from "lucide-react";

export interface StudentAnalyticsData {
  total: number;
  active: number;
  recentlyJoined: { id: string; name: string; email: string }[];
}

export function AdminStudentSection({ data }: { data: StudentAnalyticsData }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <GraduationCap className="w-4 h-4 text-pink-500" /> Student Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Summary mini-cards */}
          <div className="flex flex-col gap-3">
            <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-100">
              <div className="bg-pink-50 p-2 rounded-lg">
                <GraduationCap className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{data.total}</div>
                <div className="text-xs font-semibold text-slate-500">Total Students</div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-100">
              <div className="bg-emerald-50 p-2 rounded-lg">
                <UserCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{data.active}</div>
                <div className="text-xs font-semibold text-slate-500">Active (Enrolled)</div>
              </div>
            </div>
          </div>

          {/* Recently joined table — spans 2 cols */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recently Joined Students</span>
            </div>
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              {data.recentlyJoined.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No students yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.recentlyJoined.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors bg-white">
                        <td className="py-2.5 px-4 font-medium text-slate-800">{s.name}</td>
                        <td className="py-2.5 px-4 text-slate-500 text-xs">{s.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

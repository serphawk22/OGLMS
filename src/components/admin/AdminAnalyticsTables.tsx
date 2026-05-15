import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen } from "lucide-react";

export interface InstructorRow {
  id: string;
  name: string;
  coursesCreated: number;
  enrolledStudents: number;
  role: string;
}

export interface CourseRow {
  id: string;
  title: string;
  createdBy: string;
  published: boolean;
  enrollmentCount: number;
}

export function AdminInstructorTable({ rows }: { rows: InstructorRow[] }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Users className="w-4 h-4 text-violet-500" /> Instructor Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-100">
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Courses</th>
                <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Students</th>
                <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-xs">No instructors found</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800">{r.name}</td>
                  <td className="py-3 px-3 text-center font-medium text-slate-700">{r.coursesCreated}</td>
                  <td className="py-3 px-3 text-center font-medium text-slate-700">{r.enrolledStudents}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
                      {r.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminCourseTable({ rows }: { rows: CourseRow[] }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <BookOpen className="w-4 h-4 text-emerald-500" /> Course Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="bg-slate-50 border-y border-slate-100">
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Course</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Creator</th>
                <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-xs">No courses found</td></tr>
              ) : rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800 max-w-[160px] truncate">{c.title}</td>
                  <td className="py-3 px-3 text-slate-500 text-xs">{c.createdBy}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {c.published ? "PUBLISHED" : "DRAFT"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-medium text-slate-700">{c.enrollmentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

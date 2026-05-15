"use client";
import { useState } from "react";
import { Eye, GraduationCap, Users, BookOpen, BookMarked, TrendingUp } from "lucide-react";
import { AdminStudentModal }    from "@/components/admin/modals/AdminStudentModal";
import { AdminInstructorModal } from "@/components/admin/modals/AdminInstructorModal";
import { AdminEnrollmentModal } from "@/components/admin/modals/AdminEnrollmentModal";

interface AdminStats {
  totalStudents: number;
  activeInstructors: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
}

type ModalType = "students" | "instructors" | "enrollments" | null;

const CARDS = [
  {
    key: "totalStudents",
    label: "Total Students",
    sub: "in workspace",
    Icon: GraduationCap,
    color: "text-violet-500",
    bg: "bg-violet-50",
    modal: "students" as ModalType,
  },
  {
    key: "activeInstructors",
    label: "Instructors",
    sub: "in organization",
    Icon: Users,
    color: "text-blue-500",
    bg: "bg-blue-50",
    modal: "instructors" as ModalType,
  },
  {
    key: "totalCourses",
    label: "Total Courses",
    sub: "in organization",
    Icon: BookOpen,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    modal: null,
  },
  {
    key: "publishedCourses",
    label: "Published Courses",
    sub: "live & accessible",
    Icon: BookMarked,
    color: "text-green-500",
    bg: "bg-green-50",
    modal: null,
  },
  {
    key: "totalEnrollments",
    label: "Total Enrollments",
    sub: "across all courses",
    Icon: TrendingUp,
    color: "text-pink-500",
    bg: "bg-pink-50",
    modal: "enrollments" as ModalType,
  },
] as const;

export function AdminStatCards({ stats, orgId }: { stats: AdminStats; orgId: string }) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {CARDS.map(({ key, label, sub, Icon, color, bg, modal }) => (
          <div
            key={key}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative group"
          >
            {/* Eye button on hoverable cards */}
            {modal && (
              <button
                onClick={() => setActiveModal(modal)}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200"
                title={`View ${label}`}
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}

            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {stats[key as keyof AdminStats]}
            </div>
            <p className="text-sm font-semibold text-slate-700 mt-0.5 leading-tight">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>

            {/* Subtle eye hint on cards with modal */}
            {modal && (
              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Eye className="w-2.5 h-2.5" /> Click eye to view details
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      {activeModal === "students"    && <AdminStudentModal    orgId={orgId} onClose={() => setActiveModal(null)} />}
      {activeModal === "instructors" && <AdminInstructorModal orgId={orgId} onClose={() => setActiveModal(null)} />}
      {activeModal === "enrollments" && <AdminEnrollmentModal orgId={orgId} onClose={() => setActiveModal(null)} />}
    </>
  );
}

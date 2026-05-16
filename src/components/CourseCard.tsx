"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GraduationCap, ChevronRight, Clock, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface Course {
  id: string;
  title: string;
  orgName: string;
  enrolled: boolean;
}

export function CourseCard({ course }: { course: Course }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enrolled, setEnrolled] = useState(course.enrolled);
  const [enrolling, setEnrolling] = useState(false);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await fetch("/api/student/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      });
      if (res.ok) {
        setEnrolled(true);
        // Refresh server component data
        startTransition(() => router.refresh());
      }
    } catch {
      // silent fail — enrollment state unchanged
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <Card className="border-zinc-200 shadow-sm hover:border-zinc-300 transition-all cursor-pointer group h-full">
      <CardContent className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-zinc-100 p-3 rounded-lg group-hover:bg-zinc-200 transition-colors">
            <GraduationCap className="w-6 h-6 text-zinc-600 group-hover:text-zinc-900" />
          </div>
          <div>
            <h4 className="font-bold text-zinc-900">{course.title}</h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {course.orgName}
              </span>
              {enrolled && (
                <span className="status-badge status-badge--success py-0 px-2">
                  Enrolled
                </span>
              )}
            </div>
          </div>
        </div>

        {enrolled ? (
          <Link href={`/student/courses/${course.id}`}>
            <Button variant="ghost" className="text-zinc-600 hover:text-zinc-900 group-hover:translate-x-1 transition-transform font-bold text-xs uppercase tracking-wider">
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        ) : (
          <Button
            onClick={handleEnroll}
            disabled={enrolling}
            className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider px-6"
          >
            {enrolling ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enrolling…</>
            ) : (
              "Enroll Now"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

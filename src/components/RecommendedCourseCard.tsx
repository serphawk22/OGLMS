"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  GraduationCap,
  ArrowRight,
  Loader2,
  AlertTriangle,
  TrendingUp,
  BookMarked,
} from "lucide-react";

// ── Types matching the API response ──────────────────────────────────────────
interface RecommendedCourse {
  id: string;
  title: string;
  description: string | null;
  enrollmentCount: number;
  reason: string;
}

interface RecommendationsResponse {
  recommendedNext: RecommendedCourse | null;
  nearlyComplete: { id: string; title: string; progress: number } | null;
  lowScoreCourse: { id: string; title: string; avgScore: number } | null;
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function RecommendedCourseCard() {
  const router = useRouter();
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/recommendations")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json() as Promise<RecommendationsResponse>;
      })
      .then((d) => setData(d))
      .catch(() => setError("Could not load recommendations."))
      .finally(() => setLoading(false));
  }, []);

  const handleEnroll = async (courseId: string) => {
    setEnrolling(true);
    try {
      const res = await fetch("/api/student/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (res.ok) {
        setEnrolled(true);
        router.refresh();
      }
    } catch {
      /* silent */
    } finally {
      setEnrolling(false);
    }
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-50">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Recommended For You
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-8 w-24 mt-2" />
        </CardContent>
      </Card>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-50">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Recommended For You
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-xs text-slate-400">
          {error}
        </CardContent>
      </Card>
    );
  }

  const { recommendedNext, nearlyComplete, lowScoreCourse } = data ?? {};
  const hasAnything = recommendedNext || nearlyComplete || lowScoreCourse;

  // ── Empty state – all courses enrolled ──
  if (!hasAnything) {
    return (
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-50">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Recommended For You
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-xs text-slate-400">
          🎉 You&rsquo;re enrolled in all available courses!
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-50">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
          <Sparkles className="w-4 h-4 text-violet-500" />
          Recommended For You
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-slate-100">

        {/* ── Nearly Complete hint ── */}
        {nearlyComplete && (
          <div className="p-4 flex items-start gap-3 bg-emerald-50/50">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-tight">
                Almost There!
              </p>
              <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">
                {nearlyComplete.title}
              </p>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(nearlyComplete.progress, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {Math.round(nearlyComplete.progress)}% complete — keep going!
              </p>
              <Link href={`/student/courses/${nearlyComplete.id}`}>
                <Button
                  size="sm"
                  className="mt-2 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Continue <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Low quiz score warning ── */}
        {lowScoreCourse && (
          <div className="p-4 flex items-start gap-3 bg-amber-50/50">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-tight">
                Needs Revision
              </p>
              <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">
                {lowScoreCourse.title}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Avg quiz score: {lowScoreCourse.avgScore}% — revisit the lessons
              </p>
              <Link href={`/student/courses/${lowScoreCourse.id}?tab=quizzes`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
                >
                  Review Course <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Recommended next course ── */}
        {recommendedNext && !enrolled && (
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
              <GraduationCap className="w-4 h-4 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-violet-600 uppercase tracking-tight">
                Next Course
              </p>
              <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">
                {recommendedNext.title}
              </p>
              {recommendedNext.description && (
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                  {recommendedNext.description}
                </p>
              )}
              <p className="text-[10px] text-violet-500 mt-1 flex items-center gap-1">
                <BookMarked className="w-3 h-3" />
                {recommendedNext.reason}
              </p>
              <Button
                size="sm"
                onClick={() => handleEnroll(recommendedNext.id)}
                disabled={enrolling}
                className="mt-2 h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white"
              >
                {enrolling ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Enrolling…
                  </>
                ) : (
                  <>
                    Enroll Now <ArrowRight className="w-3 h-3 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Enrolled confirmation */}
        {recommendedNext && enrolled && (
          <div className="p-4 text-center text-xs text-emerald-600 font-semibold">
            ✓ Enrolled! Head to{" "}
            <Link
              href={`/student/courses/${recommendedNext.id}`}
              className="underline"
            >
              the course
            </Link>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

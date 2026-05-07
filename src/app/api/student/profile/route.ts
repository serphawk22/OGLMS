import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function computeXP(completedCourses: number, submissions: number, gradedSubmissions: { grade: number | null }[]) {
  const courseXP = completedCourses * 500;
  const submissionXP = submissions * 50;
  const quizXP = gradedSubmissions.reduce((sum, s) => sum + (s.grade ?? 0), 0);
  return courseXP + submissionXP + quizXP;
}

function computeLevel(xp: number) {
  return Math.max(1, Math.floor(xp / 200) + 1);
}

function computeRank(xp: number): string {
  if (xp >= 7000) return "Platinum";
  if (xp >= 3000) return "Gold";
  if (xp >= 1000) return "Silver";
  return "Bronze";
}

function computeStreak(activityDates: Date[]): number {
  if (activityDates.length === 0) return 0;

  // Deduplicate to unique calendar day strings (YYYY-MM-DD)
  const daySet = new Set(
    activityDates.map((d) => d.toISOString().slice(0, 10))
  );
  const days = Array.from(daySet).sort().reverse(); // newest first

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Streak must include today or yesterday to be "active"
  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 0;
  let cursor = days[0] === today ? new Date() : new Date(Date.now() - 86400000);

  for (const day of days) {
    const expected = cursor.toISOString().slice(0, 10);
    if (day === expected) {
      streak++;
      cursor = new Date(cursor.getTime() - 86400000);
    } else {
      break;
    }
  }
  return streak;
}

function computeAchievements(
  completedCourses: number,
  enrollmentCount: number,
  streak: number,
  maxGrade: number | null, // highest graded submission score
  hasEarlyEnrollment: boolean
) {
  const badges: { name: string; icon: string; color: string; unlocked: boolean }[] = [
    {
      name: "Fast Learner",
      icon: "🚀",
      color: "from-blue-400 to-indigo-500",
      unlocked: completedCourses >= 1,
    },
    {
      name: "Quiz Master",
      icon: "🧠",
      color: "from-purple-400 to-pink-500",
      unlocked: maxGrade !== null && maxGrade >= 90,
    },
    {
      name: "Early Bird",
      icon: "🌅",
      color: "from-orange-400 to-amber-500",
      unlocked: hasEarlyEnrollment,
    },
    {
      name: "Helper",
      icon: "🤝",
      color: "from-emerald-400 to-teal-500",
      unlocked: enrollmentCount >= 3,
    },
    {
      name: "Dedicated",
      icon: "💪",
      color: "from-red-400 to-rose-500",
      unlocked: streak >= 7,
    },
    {
      name: "Scholar",
      icon: "📚",
      color: "from-cyan-400 to-sky-500",
      unlocked: completedCourses >= 3,
    },
  ];
  return badges;
}

/* ─── GET /api/student/profile ─────────────────────────────────────────────── */

export async function GET() {
  // 1. Auth
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let payload: import("jose").JWTPayload;
    try {
      const verified = await jwtVerify(token, secret);
      payload = verified.payload;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = payload.userId as string;

    // 2. Parallel DB queries (optimized single round-trip)
    const [user, enrollments, submissions, notifications, loginHistory] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: { include: { organization: true } } },
      }),
      prisma.enrollment.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true, published: true } } },
        orderBy: { id: "desc" },
      }),
      prisma.assignmentSubmission.findMany({
        where: { studentId: userId },
        select: { grade: true, submittedAt: true, assignment: { select: { title: true } } },
        orderBy: { submittedAt: "desc" },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50, // for recent activity
      }),
      prisma.notification.findMany({
        where: { userId, type: "LOGIN" },
        orderBy: { createdAt: "desc" },
        take: 100, // for streak
      }),
    ]);

    if (!user || user.memberships.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const membership = user.memberships[0];
    const org = membership.organization;

    // Track daily login for streak if they didn't manually login today but resumed session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasLoginToday = loginHistory.some((n) => new Date(n.createdAt) >= today);

    if (!hasLoginToday) {
      const newLogin = await prisma.notification.create({
        data: {
          userId: user.id,
          message: "Daily Login",
          type: "LOGIN",
        },
      });
      loginHistory.unshift(newLogin);
      notifications.unshift(newLogin);
    }

    // 3. Compute stats
    const completedEnrollments = enrollments.filter((e) => e.progress >= 1.0);
    const completedCourses = completedEnrollments.length;
    const enrollmentCount = enrollments.length;

    // Learning hours: each course ~5h, scaled by progress
    const learningHours = Math.round(
      enrollments.reduce((sum, e) => sum + e.progress * 5, 0)
    );

    const gradedSubmissions = submissions.filter((s) => s.grade !== null) as { grade: number; submittedAt: Date; assignment: { title: string } }[];
    const maxGrade = gradedSubmissions.length > 0
      ? Math.max(...gradedSubmissions.map((s) => s.grade))
      : null;

    const xp = computeXP(completedCourses, submissions.length, gradedSubmissions);
    const level = computeLevel(xp);
    const rank = computeRank(xp);

    // Streak from login activity dates
    const activityDates = loginHistory.map((n) => new Date(n.createdAt));
    const streak = computeStreak(activityDates);

    // Early bird: enrolled in any course (simple proxy)
    const hasEarlyEnrollment = enrollmentCount > 0;

    const achievements = computeAchievements(
      completedCourses,
      enrollmentCount,
      streak,
      maxGrade,
      hasEarlyEnrollment
    );

    // 4. Recent Activity — build from notifications
    const recentActivity = notifications.slice(0, 10).map((n) => {
      const diffMs = Date.now() - new Date(n.createdAt).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let timeAgo: string;
      if (diffMins < 60) timeAgo = `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
      else if (diffHours < 24) timeAgo = `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
      else if (diffDays === 1) timeAgo = "Yesterday";
      else timeAgo = `${diffDays} days ago`;

      // Map notification type to activity type
      const typeMap: Record<string, string> = {
        MODULE: "module",
        ASSIGNMENT: "assignment",
        COURSE: "course",
        QUIZ: "quiz",
        BADGE: "badge",
        LIVE: "live",
        LOGIN: "login",
      };

      return {
        id: n.id,
        title: n.message,
        time: timeAgo,
        type: typeMap[n.type] ?? "module",
      };
    });

    // 5. Enrolled courses list (for profile display)
    const courseList = enrollments.slice(0, 5).map((e) => ({
      id: e.course.id,
      title: e.course.title,
      progress: Math.round(e.progress * 100),
      completed: e.progress >= 1.0,
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name ?? "Student",
        email: user.email,
        avatarSeed: user.name ?? user.email,
      },
      org: {
        id: org.id,
        name: org.name,
      },
      stats: {
        enrollmentCount,
        completedCourses,
        learningHours,
        xp,
        level,
        rank,
        streak,
      },
      achievements,
      recentActivity,
      courses: courseList,
    });
  } catch (err) {
    console.error("[GET /api/student/profile]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

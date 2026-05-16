import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { CourseCard } from "@/components/CourseCard";
import { RecommendedCourseCard } from "@/components/RecommendedCourseCard";
import {
  BookOpen,
  PlayCircle,
  Building,
  HelpCircle,
  Sparkles,
  Video,
  Bell,
  Radio,
  ClipboardList,
} from "lucide-react";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export default async function StudentDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  let payload;
  try {
    const verified = await jwtVerify(token, secret);
    payload = verified.payload;
  } catch (err) {
    redirect("/login");
  }

  // FETCH REAL STUDENT DATA
  const user = await prisma.user.findUnique({
    where: { id: payload.userId as string },
    include: { 
      memberships: { 
        include: { organization: true } 
      } 
    }
  });

  if (!user || user.memberships.length === 0) redirect("/login");
  
  const membership = user.memberships[0];
  const org = membership.organization;

  // FETCH REAL CONTENT FOR THIS ORGANIZATION
  // Step 1: Get enrolled course IDs first (needed to filter live sessions)
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    select: { courseId: true },
  });
  const enrolledCourseIds = enrollments.map((e) => e.courseId);

  // Step 2: Fetch everything else in parallel
  const [allCourses, dailyBites, liveSessions] = await Promise.all([
    // All published courses in the org
    prisma.course.findMany({
      where: { organizationId: org.id, published: true },
      orderBy: { id: 'desc' },
    }),
    prisma.dailyBite.findMany({
      where: { organizationId: org.id },
      orderBy: { date: 'desc' },
      take: 1
    }),
    // Only sessions for enrolled courses, ordered by soonest first
    enrolledCourseIds.length > 0
      ? prisma.liveSession.findMany({
          where: {
            courseId: { in: enrolledCourseIds },
            status: { in: ["SCHEDULED", "ONGOING"] },
          },
          include: { course: { select: { title: true, id: true } } },
          orderBy: { scheduledAt: "asc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  // Build a Set of enrolled courseIds for O(1) lookup
  const enrolledSet = new Set(enrolledCourseIds);
  const latestBite = dailyBites[0];

  // ── Pending Assessments: quizzes & assignments not yet submitted ──────────
  let pendingQuizzes: { id: string; title: string; courseId: string; questionCount: number }[] = [];
  let pendingAssignments: { id: string; title: string; courseId: string }[] = [];

  if (enrolledCourseIds.length > 0) {
    // Fetch all quizzes for enrolled courses
    const allQuizzes = await prisma.quiz.findMany({
      where: { courseId: { in: enrolledCourseIds } },
      select: { id: true, title: true, courseId: true, questions: { select: { id: true } } },
    });

    // Fetch quiz submissions by this student
    const quizSubs = await prisma.quizSubmission.findMany({
      where: { studentId: user.id, quizId: { in: allQuizzes.map((q) => q.id) } },
      select: { quizId: true },
    });
    const submittedQuizIds = new Set(quizSubs.map((s) => s.quizId));
    pendingQuizzes = allQuizzes
      .filter((q) => !submittedQuizIds.has(q.id))
      .map((q) => ({ id: q.id, title: q.title, courseId: q.courseId, questionCount: q.questions.length }));

    // Fetch all assignments for enrolled courses
    const allAssignments = await prisma.assignment.findMany({
      where: { courseId: { in: enrolledCourseIds } },
      select: { id: true, title: true, courseId: true },
    });

    // Fetch assignment submissions by this student
    const assignmentSubs = await prisma.assignmentSubmission.findMany({
      where: { studentId: user.id, assignmentId: { in: allAssignments.map((a) => a.id) } },
      select: { assignmentId: true },
    });
    const submittedAssignmentIds = new Set(assignmentSubs.map((s) => s.assignmentId));
    pendingAssignments = allAssignments.filter((a) => !submittedAssignmentIds.has(a.id));
  }

  // Build course list with enrollment state
  const courses = allCourses.map((c) => ({
    id: c.id,
    title: c.title,
    orgName: org.name,
    enrolled: enrolledSet.has(c.id),
  }));

  const menuItems = [
    { label: 'Dashboard', ariaLabel: 'Go to dashboard', link: '/student' },
    { label: 'My Courses', ariaLabel: 'View your courses', link: '/student#courses' },
    { label: 'Live Sessions', ariaLabel: 'View live classes', link: '/student#live' },
    { label: 'My Profile', ariaLabel: 'View your profile', link: '/student/profile' },
  ];

  const socialItems = [
    { label: 'Discord', link: 'https://discord.com' },
    { label: 'Support', link: '/support' }
  ];

  return (
    <div className="container-page space-y-8">
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
          {/* DAILY STANDUP BITE */}
          <Card className="border-none shadow-md overflow-hidden bg-zinc-900 text-white h-full relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2">
                <div className="p-8 space-y-4">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Sparkles className="w-4 h-4"/>
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Daily Standup Bite</span>
                  </div>
                  <h2 className="text-2xl font-bold leading-tight">
                    {latestBite ? latestBite.title : "Ready for today's lesson?"}
                  </h2>
                  <p className="text-zinc-400 text-sm">
                    Watch this 5-minute mandatory update before starting your modules for today.
                  </p>
                  {latestBite?.videoUrl && (
                    <Link href={latestBite.videoUrl} target="_blank">
                      <Button className="bg-white text-zinc-900 hover:bg-zinc-100 font-semibold">
                        <PlayCircle className="w-4 h-4 mr-2"/> Start Learning
                      </Button>
                    </Link>
                  )}
                </div>
                <div className="bg-zinc-800/50 flex items-center justify-center p-8 border-l border-zinc-800">
                   <div className="text-center opacity-40">
                      <Video className="w-16 h-16 mx-auto mb-2 text-zinc-400"/>
                      <p className="text-[10px] uppercase tracking-widest font-bold">Secure Campus Stream</p>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AVAILABLE COURSES */}
          <div className="space-y-6" id="courses">
            <div className="section-divider">
              <span>Available Courses</span>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {courses.map(course => (
                <CourseCard key={course.id} course={course} />
              ))}
              {courses.length === 0 && (
                <div className="empty-state">
                   <BookOpen />
                   <p>No courses have been published to your campus yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SIDEBAR WIDGETS */}
        <div className="space-y-8">
          {/* RECOMMENDED NEXT COURSE */}
          <RecommendedCourseCard />

          {/* LIVE SESSIONS CARD */}
          <Card id="live" className="border-zinc-200 shadow-sm bg-white overflow-hidden h-full">
            <CardHeader className="pb-3 border-b border-zinc-50 bg-zinc-50/50">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-600">
                <Radio className="w-3.5 h-3.5 text-red-500" /> Live Classes
                {liveSessions.some(s => s.status === "ONGOING") && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="live-dot" />
                    <span className="text-[9px] font-black text-red-600">LIVE</span>
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-zinc-100 p-0">
              {liveSessions.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  No live classes scheduled. Enroll in courses to see their sessions.
                </div>
              ) : (
                liveSessions.map((session) => {
                  const isLive = session.status === "ONGOING";
                  const scheduledTime = new Date(session.scheduledAt).toLocaleString("en-IN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                  return (
                    <div key={session.id} className="p-4 flex items-center justify-between gap-3 hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isLive ? "bg-red-50" : "bg-zinc-50"
                        }`}>
                          <Video className={`w-4 h-4 ${isLive ? "text-red-600" : "text-zinc-500"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-zinc-800 truncate">{session.title}</p>
                          <p className="text-[10px] text-zinc-500 truncate flex items-center gap-1.5">
                            <span className="truncate">{session.course.title}</span>
                            <span className="text-zinc-300">•</span>
                            <span className="shrink-0 font-medium">{scheduledTime}</span>
                          </p>
                        </div>
                      </div>
                      <Link href={`/meet/${session.roomId}`}>
                        <Button size="sm" className={`text-xs h-7 shrink-0 font-bold ${
                          isLive
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-zinc-900 hover:bg-zinc-800 text-white"
                        }`}>
                          {isLive ? "Join Live" : "Join"}
                        </Button>
                      </Link>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* ANNOUNCEMENTS */}
          <Card className="border-zinc-200 shadow-sm bg-white overflow-hidden h-full">
            <CardHeader className="pb-3 border-b border-zinc-50 bg-zinc-50/50">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-600">
                <Bell className="w-3.5 h-3.5 text-blue-500"/> Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 bg-blue-50/30 border-l-4 border-blue-500">
                <p className="text-sm font-bold text-blue-900">Stay Updated</p>
                <p className="text-[11px] text-blue-700 mt-1 leading-relaxed">
                  Check the notifications panel for the latest updates from your instructors — new modules, assignments, and live sessions.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* PENDING ASSESSMENTS */}
          <Card className="border-zinc-200 shadow-sm bg-white overflow-hidden h-full">
            <CardHeader className="pb-3 border-b border-zinc-50 bg-zinc-50/50">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-600">
                <ClipboardList className="w-3.5 h-3.5 text-zinc-500"/> Assessments
                {(pendingQuizzes.length + pendingAssignments.length) > 0 && (
                  <span className="ml-auto text-[10px] bg-zinc-900 text-white px-2 py-0.5 rounded-full font-bold">
                    {pendingQuizzes.length + pendingAssignments.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-zinc-100 p-0">
              {/* Pending Quizzes */}
              {pendingQuizzes.map((quiz) => (
                <Link
                  key={quiz.id}
                  href={`/student/courses/${quiz.courseId}?tab=quizzes`}
                  className="block p-4 hover:bg-zinc-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-800 truncate group-hover:text-emerald-700 transition-colors">{quiz.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-tighter font-medium">
                        {quiz.questionCount} Questions · Quiz
                      </p>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </Link>
              ))}

              {/* Pending Assignments */}
              {pendingAssignments.map((asgn) => (
                <Link
                  key={asgn.id}
                  href={`/student/courses/${asgn.courseId}?tab=assignments`}
                  className="block p-4 hover:bg-zinc-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-800 truncate group-hover:text-amber-700 transition-colors">{asgn.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-tighter font-medium">Assignment</p>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </Link>
              ))}

              {/* All caught up */}
              {pendingQuizzes.length === 0 && pendingAssignments.length === 0 && (
                <div className="p-8 text-center text-xs text-zinc-400">
                  All caught up! No pending assessments.
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}

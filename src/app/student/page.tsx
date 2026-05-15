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

import { StaggeredMenu } from "@/components/StaggeredMenu";
import BorderGlow from "@/components/BorderGlow";

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
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900">
      
      <StaggeredMenu
        isFixed={true}
        position="right"
        items={menuItems}
        socialItems={socialItems}
        displaySocials={true}
        displayItemNumbering={true}
        menuButtonColor="#0f172a"
        openMenuButtonColor="#0f172a"
        changeMenuColorOnOpen={true}
        colors={['#3b82f6', '#1d4ed8']}
        accentColor="#3b82f6"
      />
      
      <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-200">
              <Building className="w-6 h-6"/>
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-0.5">{org.name}</p>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Student Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-6 pr-16"> {/* pr-16 to avoid overlapping with menu button if needed, although it's usually fixed */}
            <div className="text-right hidden md:block">
              <Link href="/student/profile" className="group">
                <p className="text-sm font-bold group-hover:text-blue-600 transition-colors">{user.name}</p>
                <p className="text-[10px] text-slate-500 font-medium">Student ID: {user.id.slice(0, 8)}</p>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsDropdown />
              <CalendarDropdown />
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>


      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        
        <div className="lg:col-span-2 space-y-8">
          
          
          <BorderGlow borderRadius={16} backgroundColor="#0f172a" colors={['#3b82f6', '#1d4ed8', '#60a5fa']} glowIntensity={0.8}>
            <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 text-white h-full">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2">
                  <div className="p-8 space-y-4">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Sparkles className="w-4 h-4"/>
                      <span className="text-xs font-bold uppercase tracking-tighter">Daily Standup Bite</span>
                    </div>
                    <h2 className="text-2xl font-bold leading-tight">
                      {latestBite ? latestBite.title : "Ready for today's lesson?"}
                    </h2>
                    <p className="text-slate-400 text-sm">
                      Watch this 5-minute mandatory update before starting your modules for today.
                    </p>
                    {latestBite?.videoUrl && (
                      <Link href={latestBite.videoUrl} target="_blank">
                        <Button className="bg-white text-slate-900 hover:bg-slate-100">
                          <PlayCircle className="w-4 h-4 mr-2"/> Start Learning
                        </Button>
                      </Link>
                    )}
                  </div>
                  <div className="bg-slate-700/50 flex items-center justify-center p-8 border-l border-slate-700">
                     <div className="text-center opacity-40">
                        <Video className="w-16 h-16 mx-auto mb-2"/>
                        <p className="text-xs">Secure Campus Stream</p>
                     </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BorderGlow>

                    <div className="space-y-4" id="courses">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold flex items-center gap-2">
                 <BookOpen className="w-5 h-5 text-blue-600"/> Available Courses
               </h3>
               <span className="text-xs text-slate-500 font-medium">{courses.filter(c => c.enrolled).length}/{courses.length} enrolled</span>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {courses.map(course => (
                <CourseCard key={course.id} course={course} />
              ))}
              {courses.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-medium">
                   No courses have been published to your campus yet.
                </div>
              )}
            </div>
          </div>
        </div>

        
        <div className="space-y-8">
          
          
          {/* RECOMMENDED NEXT COURSE */}
          <RecommendedCourseCard />

          {/* LIVE SESSIONS CARD */}
          <BorderGlow borderRadius={12} backgroundColor="white" colors={['#3b82f6', '#1d4ed8', '#60a5fa']} glowIntensity={0.5}>
            <Card id="live" className="border-slate-200 shadow-sm bg-white overflow-hidden h-full">
              <CardHeader className="pb-3 border-b border-slate-50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-500" /> Live Classes
                  {liveSessions.some(s => s.status === "ONGOING") && (
                    <span className="ml-auto text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse font-bold">
                      LIVE
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
            <CardContent className="divide-y divide-slate-100 p-0">
              {liveSessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
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
                    <div key={session.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isLive ? "bg-red-100 animate-pulse" : "bg-blue-50"
                        }`}>
                          <Video className={`w-4 h-4 ${isLive ? "text-red-600" : "text-blue-500"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{session.title}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {session.course.title} · 📅 {scheduledTime}
                          </p>
                        </div>
                      </div>
                      <Link href={`/meet/${session.roomId}`}>
                        <Button size="sm" className={`text-xs h-7 shrink-0 ${
                          isLive
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}>
                          {isLive ? "Join Live" : "Join Class"}
                        </Button>
                      </Link>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </BorderGlow>

          {/* ANNOUNCEMENTS */}
          <BorderGlow borderRadius={12} backgroundColor="white" colors={['#3b82f6', '#1d4ed8', '#60a5fa']} glowIntensity={0.5}>
            <Card className="border-slate-200 shadow-sm bg-white h-full">
              <CardHeader className="pb-3 border-b border-slate-50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500"/> Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 border-l-4 border-blue-400 bg-blue-50/50">
                  <p className="text-sm font-bold text-blue-900">Stay Updated</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Check the 🔔 bell icon for the latest notifications from your instructors — new modules, assignments, and live sessions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </BorderGlow>

          
          {/* PENDING ASSESSMENTS */}
          <BorderGlow borderRadius={12} backgroundColor="white" colors={['#3b82f6', '#1d4ed8', '#60a5fa']} glowIntensity={0.5}>
            <Card className="border-slate-200 shadow-sm bg-white h-full">
              <CardHeader className="pb-3 border-b border-slate-50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-600"/> Pending Assessments
                  {(pendingQuizzes.length + pendingAssignments.length) > 0 && (
                    <span className="ml-auto text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                      {pendingQuizzes.length + pendingAssignments.length}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100 p-0">
                {/* Pending Quizzes */}
                {pendingQuizzes.map((quiz) => (
                  <Link
                    key={quiz.id}
                    href={`/student/courses/${quiz.courseId}?tab=quizzes`}
                    className="block p-4 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <HelpCircle className="w-4 h-4 text-emerald-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{quiz.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-tighter">
                          {quiz.questionCount} Question{quiz.questionCount !== 1 ? "s" : ""} · Quiz
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">Go →</span>
                    </div>
                  </Link>
                ))}

                {/* Pending Assignments */}
                {pendingAssignments.map((asgn) => (
                  <Link
                    key={asgn.id}
                    href={`/student/courses/${asgn.courseId}?tab=assignments`}
                    className="block p-4 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <ClipboardList className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-amber-700 transition-colors">{asgn.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-tighter">Assignment</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">Go →</span>
                    </div>
                  </Link>
                ))}

                {/* All caught up */}
                {pendingQuizzes.length === 0 && pendingAssignments.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-400">
                    All caught up! No pending assessments.
                  </div>
                )}
              </CardContent>
            </Card>
          </BorderGlow>

        </div>
      </main>
    </div>
  );
}

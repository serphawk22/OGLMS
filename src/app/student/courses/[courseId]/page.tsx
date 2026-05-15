import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, PlayCircle, FileText, CheckCircle, ExternalLink,
  BookOpen, ClipboardList, BookMarked, LayoutList, HelpCircle, Radio, Video, Link2, Star, MonitorPlay, MessageSquare
} from "lucide-react";
import { CourseChatbot } from "@/components/CourseChatbot";
import { AssignmentSubmitForm } from "@/components/AssignmentSubmitForm";
import { CourseReviewSection } from "@/components/CourseReviewSection";
import { ActivityLink } from "@/components/ActivityLink";
import { QuizTaker } from "@/components/QuizTaker";
import { RecordedClassesTab } from "@/components/RecordedClassesTab";
import { VideoPlayerModal } from "@/components/VideoPlayerModal";
import { StudentFeedbackTab } from "@/components/admin/StudentFeedbackTab";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";



export default async function StudentCourseView({ 
  params,
  searchParams
}: { 
  params: Promise<{ courseId: string }>,
  searchParams: Promise<{ tab?: string }>
}) {
  const resolvedParams = await params;
  const courseId = resolvedParams.courseId;
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams.tab || "modules";

  // Get logged-in student ID from JWT cookie
  let studentId: string | null = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (token) {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "secret");
      const { payload } = await jwtVerify(token, secret);
      studentId = (payload.userId as string) ?? null;
    }
  } catch { /* not logged in */ }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { id: "asc" },
        include: {
          lessons: { orderBy: { id: "asc" } },
          liveSessions: { orderBy: { createdAt: "desc" } },
          recordedClasses: { orderBy: { createdAt: "desc" } },
        },
      },
      readingMaterials: { orderBy: { createdAt: "desc" } },
      assignments: { orderBy: { createdAt: "desc" } },
      quizzes: { include: { questions: true } },
      liveSessions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!course) redirect("/student");

  // ── Enrollment guard ─────────────────────────────────────────────────────────
  // Redirect to dashboard if student is not logged in or not enrolled in this course.
  // Instructors can preview via the instructor dashboard without enrollment.
  if (studentId) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: studentId, courseId } },
      select: { id: true },
    });
    if (!enrollment) redirect("/student");
  } else {
    redirect("/login");
  }

  // Fetch this student's assignment submissions
  type SubmissionRow = {
    id: string; assignmentId: string; driveLink: string;
    grade: number | null; maxGrade: number; feedback: string | null;
    submittedAt: Date; gradedAt: Date | null;
  };

  // Fetch this student's quiz submissions for this course's quizzes
  type QuizSubmissionRow = {
    quizId: string;
    obtainedMarks: number;
    totalMarks: number;
    answers: Record<string, number | string>;
    submittedAt: Date;
  };

  // Run both submission queries in parallel — they are fully independent of each other.
  const [rawSubs, rawQuizSubs] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: {
        studentId: studentId!,
        assignmentId: { in: course.assignments.map((a) => a.id) },
      },
      select: {
        id: true, assignmentId: true, driveLink: true,
        grade: true, maxGrade: true, feedback: true,
        submittedAt: true, gradedAt: true,
      },
    }).catch(() => [] as SubmissionRow[]),

    prisma.quizSubmission.findMany({
      where: {
        studentId: studentId!,
        quizId: { in: course.quizzes.map((q) => q.id) },
      },
      select: {
        quizId: true,
        obtainedMarks: true,
        totalMarks: true,
        answers: true,
        submittedAt: true,
      },
    }).catch(() => []),
  ]);

  const submissionMap = new Map<string, SubmissionRow>();
  for (const s of rawSubs) submissionMap.set(s.assignmentId, s);

  const quizSubmissionMap = new Map<string, QuizSubmissionRow>();
  for (const s of rawQuizSubs) {
    quizSubmissionMap.set(s.quizId, {
      ...s,
      answers: s.answers as Record<string, number | string>,
    });
  }

  const menuItems = [
    { label: 'Back to Dashboard', ariaLabel: 'Go back to dashboard', link: '/student' },
    { label: 'Modules', ariaLabel: 'View modules', link: `?tab=modules` },
    { label: 'Reading Materials', ariaLabel: 'View materials', link: `?tab=reading` },
    { label: 'Assignments', ariaLabel: 'View assignments', link: `?tab=assignments` },
    { label: 'Quizzes', ariaLabel: 'View quizzes', link: `?tab=quizzes` },
    { label: 'Live Classes', ariaLabel: 'View live classes', link: `?tab=live` },
  ];

  const socialItems = [
    { label: 'Discord', link: 'https://discord.com' },
    { label: 'Support', link: '/support' }
  ];

  return (
    <div className="container-page space-y-8">
      {/* Course Title Header */}
      <div className="flex items-center justify-between">
        <Link href="/student">
          <Button variant="ghost" className="text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 px-0">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-zinc-900">{course.title}</h1>
          <div className="status-badge status-badge--info">Student View</div>
        </div>
      </div>


      <div className="max-w-6xl mx-auto p-8 space-y-6">
        
        {/* Header */}
        <div className="border-b border-slate-200 pb-6">
          <h2 className="text-3xl font-bold tracking-tight">Course Content</h2>
          <p className="text-slate-500 mt-2">Navigate through modules, materials, and live sessions using the sidebar.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-4">
          
          {/* SIDEBAR TABS */}
          <div className="space-y-2">
            <Link href={`?tab=modules`}>
              <Button variant={tab === "modules" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "modules" ? "bg-blue-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-100"}`}>
                <LayoutList className="w-4 h-4 mr-3" /> Modules
              </Button>
            </Link>
            <Link href={`?tab=reading`}>
              <Button variant={tab === "reading" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "reading" ? "bg-violet-100 text-violet-700 font-bold" : "text-slate-600 hover:bg-slate-100"}`}>
                <BookMarked className="w-4 h-4 mr-3" /> Reading Materials
              </Button>
            </Link>
            <Link href={`?tab=assignments`}>
              <Button variant={tab === "assignments" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "assignments" ? "bg-amber-100 text-amber-700 font-bold" : "text-slate-600 hover:bg-slate-100"}`}>
                <ClipboardList className="w-4 h-4 mr-3" /> Assignments
              </Button>
            </Link>
            <Link href={`?tab=quizzes`}>
              <Button variant={tab === "quizzes" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "quizzes" ? "bg-emerald-100 text-emerald-700 font-bold" : "text-slate-600 hover:bg-slate-100"}`}>
                <HelpCircle className="w-4 h-4 mr-3" /> Quizzes
              </Button>
            </Link>
            <Link href={`?tab=reviews`}>
              <Button variant={tab === "reviews" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "reviews" ? "bg-amber-100 text-amber-700 font-bold" : "text-slate-600 hover:bg-slate-100"}`}>
                <Star className="w-4 h-4 mr-3" /> Reviews
              </Button>
            </Link>
            <Link href={`?tab=feedback`}>
              <Button variant={tab === "feedback" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "feedback" ? "bg-violet-100 text-violet-700 font-bold" : "text-zinc-600 hover:bg-zinc-100"}`}>
                <MessageSquare className="w-4 h-4 mr-3" /> Feedback
              </Button>
            </Link>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="md:col-span-3">
            
            {/* ---- MODULES ---- */}
            {tab === "modules" && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <LayoutList className="w-6 h-6 text-blue-600" />
                  <h3 className="text-2xl font-bold text-slate-800">Course Modules</h3>
                </div>
                
                {course.modules.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 bg-white rounded-lg border border-slate-200 shadow-sm">
                    No modules have been published for this course yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {course.modules.map((module, index) => (
                      <Card key={module.id} className="border-slate-200 shadow-sm overflow-hidden bg-white hover:border-blue-200 transition-colors">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
                          <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                            Module {index + 1}: {module.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">

                          {/* ── Lessons ── */}
                          <div className="divide-y divide-slate-100">
                            {module.lessons.length === 0 ? (
                              <div className="p-6 text-sm text-slate-400 text-center bg-slate-50/50">No lessons posted yet.</div>
                            ) : (
                              module.lessons.map((lesson, lessonIndex) => (
                                <div key={lesson.id} className="flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                      <PlayCircle className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="font-semibold text-slate-700">
                                      {lessonIndex + 1}. {lesson.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {lesson.videoUrl && (
                                      <ActivityLink href={lesson.videoUrl} type="VIDEO" message={`Watched video: ${lesson.title}`}>
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                                          <PlayCircle className="w-4 h-4 mr-2" /> Watch
                                        </Button>
                                      </ActivityLink>
                                    )}
                                    {lesson.driveLink && (
                                      <ActivityLink href={lesson.driveLink} type="MATERIAL" message={`Opened notes: ${lesson.title}`}>
                                        <Button size="sm" variant="outline" className="border-slate-300">
                                          <FileText className="w-4 h-4 mr-2" /> Notes
                                        </Button>
                                      </ActivityLink>
                                    )}
                                    {!lesson.videoUrl && !lesson.driveLink && (
                                      <span className="text-xs text-slate-400 font-medium px-3 py-1 bg-slate-100 rounded-full">No Content</span>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* ── Live Classes ── */}
                          {module.liveSessions.length > 0 && (
                            <div className="border-t border-slate-100 px-4 py-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2 flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5" /> Live Classes
                              </p>
                              <div className="space-y-2">
                                {module.liveSessions.map((session) => {
                                  const isLive = session.status === "ONGOING";
                                  const isScheduled = session.status === "SCHEDULED";
                                  const isCompleted = session.status === "COMPLETED";
                                  return (
                                    <div key={session.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                                      isLive ? "border-red-300 bg-red-50" :
                                      isScheduled ? "border-blue-200 bg-blue-50/40" :
                                      "border-slate-200 bg-slate-50/40 opacity-80"
                                    }`}>
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 uppercase ${
                                          isLive ? "bg-red-100 text-red-700" :
                                          isScheduled ? "bg-blue-100 text-blue-700" :
                                          "bg-slate-100 text-slate-500"
                                        }`}>
                                          {isLive ? "LIVE NOW" : session.status}
                                        </span>
                                        <span className="text-sm font-semibold truncate text-slate-800">{session.title}</span>
                                        <span className="text-xs text-slate-400 shrink-0">
                                          {new Date(session.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {session.recordingUrl && (
                                          <VideoPlayerModal
                                            videoUrl={session.recordingUrl}
                                            title={`Recording: ${session.title}`}
                                          >
                                            <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 text-xs">
                                              <MonitorPlay className="w-3 h-3 mr-1" /> Recording
                                            </Button>
                                          </VideoPlayerModal>
                                        )}
                                        {(isLive || isScheduled) && (
                                          <Link href={`/meet/${session.roomId}`}>
                                            <Button size="sm" className={`text-white font-semibold text-xs ${
                                              isLive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                                            }`}>
                                              <Video className="w-3 h-3 mr-1" />
                                              {isLive ? "Join (LIVE)" : "Join Class"}
                                            </Button>
                                          </Link>
                                        )}
                                        {isCompleted && !session.recordingUrl && (
                                          <span className="text-xs text-slate-400 px-2 py-1 bg-slate-100 rounded-full">Ended</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── Recorded Videos ── */}
                          {module.recordedClasses.length > 0 && (
                            <div className="border-t border-slate-100 px-4 py-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2 flex items-center gap-1.5">
                                <MonitorPlay className="w-3.5 h-3.5" /> Recorded Videos
                              </p>
                              <div className="space-y-2">
                                {module.recordedClasses.map((rec) => (
                                  <div key={rec.id} className="flex items-center justify-between p-3 rounded-lg border border-indigo-100 bg-indigo-50/30">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <MonitorPlay className="w-4 h-4 text-indigo-500 shrink-0" />
                                      <span className="text-sm font-medium truncate text-slate-700">{rec.title}</span>
                                      {rec.duration && (
                                        <span className="text-xs text-slate-400 shrink-0">
                                          {Math.floor(rec.duration / 60)}:{String(rec.duration % 60).padStart(2, "0")}
                                        </span>
                                      )}
                                    </div>
                                    <VideoPlayerModal
                                      videoUrl={rec.videoUrl}
                                      title={rec.title}
                                      duration={rec.duration}
                                    >
                                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                                        <PlayCircle className="w-3 h-3 mr-1" /> Watch
                                      </Button>
                                    </VideoPlayerModal>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- READING MATERIALS ---- */}
            {tab === "reading" && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <BookMarked className="w-6 h-6 text-violet-600" />
                  <h3 className="text-2xl font-bold text-slate-800">Reading Materials</h3>
                </div>

                {course.readingMaterials.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 bg-white rounded-lg border border-slate-200 shadow-sm">
                    No reading materials available yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {course.readingMaterials.map((rm) => (
                      <div key={rm.id} className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-violet-300 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 border border-violet-100 group-hover:bg-violet-100 transition-colors">
                            <FileText className="w-6 h-6 text-violet-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-lg text-slate-800 truncate">{rm.title}</p>
                            <p className="text-sm text-slate-400 truncate mt-0.5">{rm.link}</p>
                          </div>
                        </div>
                        <ActivityLink
                          href={rm.link}
                          type="MATERIAL"
                          message={`Opened reading material: ${rm.title}`}
                          materialId={rm.id}
                          className="ml-4 shrink-0"
                        >
                          <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
                            Open Material <ExternalLink className="w-4 h-4 ml-2" />
                          </Button>
                        </ActivityLink>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- ASSIGNMENTS ---- */}
            {tab === "assignments" && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-6 h-6 text-amber-600" />
                  <h3 className="text-2xl font-bold text-slate-800">Assignments</h3>
                </div>

                {course.assignments.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 bg-white rounded-lg border border-slate-200 shadow-sm">
                    No assignments currently due.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {course.assignments.map((asgn) => {
                      const existingSub = submissionMap.get(asgn.id) ?? null;
                      return (
                        <Card key={asgn.id} className="border-slate-200 shadow-sm hover:border-amber-300 transition-all bg-white overflow-hidden">
                          <div className="h-1 w-full bg-amber-400"></div>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-6">
                              <div className="flex items-start gap-4 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100 mt-1">
                                  <CheckCircle className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-xl text-slate-800">{asgn.title}</h4>
                                  {asgn.description && (
                                    <p className="text-slate-600 mt-1 leading-relaxed text-sm whitespace-pre-wrap">{asgn.description}</p>
                                  )}
                                </div>
                              </div>
                              {asgn.driveLink && (
                                <Link href={asgn.driveLink} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                  <Button className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm">
                                    View Assignment <ExternalLink className="w-4 h-4 ml-2" />
                                  </Button>
                                </Link>
                              )}
                            </div>

                            {/* Submission form / status */}
                            <AssignmentSubmitForm
                              assignmentId={asgn.id}
                              assignmentTitle={asgn.title}
                              existingSubmission={existingSub ? {
                                id: existingSub.id,
                                driveLink: existingSub.driveLink,
                                grade: existingSub.grade,
                                maxGrade: existingSub.maxGrade,
                                feedback: existingSub.feedback,
                                submittedAt: existingSub.submittedAt.toISOString(),
                                gradedAt: existingSub.gradedAt?.toISOString() ?? null,
                              } : null}
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---- QUIZZES ---- */}
            {tab === "quizzes" && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-6 h-6 text-emerald-600" />
                  <h3 className="text-2xl font-bold text-slate-800">Quizzes & Tests</h3>
                </div>

                {course.quizzes.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 bg-white rounded-lg border border-slate-200 shadow-sm">
                    No quizzes available.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {course.quizzes.map((quiz) => {
                      const existingSub = quizSubmissionMap.get(quiz.id) ?? null;
                      return (
                        <Card key={quiz.id} className="border-slate-200 shadow-sm hover:border-emerald-300 transition-all bg-white overflow-hidden">
                          <div className="h-1 w-full bg-emerald-400"></div>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                              <HelpCircle className="w-5 h-5 text-emerald-600" />
                              {quiz.title}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1.5 mt-1 font-medium text-emerald-600">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {quiz.questions.length} Question{quiz.questions.length !== 1 ? "s" : ""}
                              {existingSub && (
                                <span className="ml-2 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                  Submitted
                                </span>
                              )}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0 pb-5">
                            <QuizTaker
                              quiz={{
                                id: quiz.id,
                                title: quiz.title,
                                retryEnabled: quiz.retryEnabled,
                                questions: quiz.questions.map((q) => ({
                                  id: q.id,
                                  text: q.text,
                                  options: q.options,
                                  correctOption: q.correctOption,
                                  points: q.points,
                                  type: q.type,
                                })),
                              }}
                              existingSubmission={
                                existingSub
                                  ? {
                                      obtainedMarks: existingSub.obtainedMarks,
                                      totalMarks: existingSub.totalMarks,
                                      answers: existingSub.answers,
                                      submittedAt: existingSub.submittedAt.toISOString(),
                                    }
                                  : null
                              }
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---- REVIEWS ---- */}
            {tab === "reviews" && (
              <CourseReviewSection
                courseId={course.id}
                currentStudentId={studentId}
              />
            )}

            {/* ---- ADMIN / INSTRUCTOR FEEDBACK ---- */}
            {tab === "feedback" && (
              <StudentFeedbackTab courseId={courseId} />
            )}

          </div>
        </div>
      </div>

      {/* Floating AI Chatbot */}
      <CourseChatbot courseId={course.id} courseTitle={course.title} />
    </div>
  );
}

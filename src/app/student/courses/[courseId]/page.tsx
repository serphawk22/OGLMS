import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, PlayCircle, FileText, CheckCircle, ExternalLink,
  BookOpen, ClipboardList, BookMarked, LayoutList, HelpCircle, Radio, Video, Link2, Star, MonitorPlay, MessageSquare, Eye
} from "lucide-react";
import { CourseChatbot } from "@/components/CourseChatbot";
import { AssignmentSubmitForm } from "@/components/AssignmentSubmitForm";
import { CourseReviewSection } from "@/components/CourseReviewSection";
import { ActivityLink } from "@/components/ActivityLink";
import { QuizTaker } from "@/components/QuizTaker";
import { RecordedClassesTab } from "@/components/RecordedClassesTab";
import { VideoPlayerModal } from "@/components/VideoPlayerModal";
import { MaterialViewerModal } from "@/components/MaterialViewerModal";
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
    fileUrl: string | null; publicId: string | null;
    fileType: string | null; mimeType: string | null;
    fileSize: number | null; originalFileName: string | null;
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
        fileUrl: true, publicId: true,
        fileType: true, mimeType: true,
        fileSize: true, originalFileName: true,
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
                    {course.readingMaterials.map((rm) => {
                      // Backward compat: new uploads use fileUrl, old Drive records use link
                      const fileUrl = (rm as unknown as { fileUrl?: string | null }).fileUrl ?? rm.link;
                      const mimeType = (rm as unknown as { mimeType?: string | null }).mimeType ?? null;
                      const fileType = (rm as unknown as { fileType?: string | null }).fileType ?? null;
                      const fileSize = (rm as unknown as { fileSize?: number | null }).fileSize ?? null;
                      const originalFileName = (rm as unknown as { originalFileName?: string | null }).originalFileName ?? null;
                      const isUploaded = !!(rm as unknown as { fileUrl?: string | null }).fileUrl;

                      const ext = fileType?.toLowerCase() ?? "";
                      const isImage = mimeType?.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext);
                      const isPdf   = mimeType === "application/pdf" || ext === "pdf";

                      // Format file size
                      let sizeLabel = "";
                      if (fileSize) {
                        if (fileSize < 1024) sizeLabel = `${fileSize} B`;
                        else if (fileSize < 1024 * 1024) sizeLabel = `${(fileSize / 1024).toFixed(1)} KB`;
                        else sizeLabel = `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
                      }

                      // Icon selection
                      let iconColor = "text-violet-500";
                      let iconBg    = "bg-violet-50 border-violet-100";
                      let IconComp  = FileText;
                      if (!isUploaded) {
                        iconColor = "text-slate-400"; iconBg = "bg-slate-50 border-slate-200"; IconComp = Link2;
                      } else if (isImage) {
                        iconColor = "text-purple-500"; iconBg = "bg-purple-50 border-purple-100"; IconComp = FileText;
                      } else if (isPdf) {
                        iconColor = "text-red-500"; iconBg = "bg-red-50 border-red-100"; IconComp = FileText;
                      } else if (["ppt","pptx"].includes(ext)) {
                        iconColor = "text-orange-500"; iconBg = "bg-orange-50 border-orange-100"; IconComp = FileText;
                      } else if (["doc","docx"].includes(ext)) {
                        iconColor = "text-blue-500"; iconBg = "bg-blue-50 border-blue-100"; IconComp = FileText;
                      } else if (["xls","xlsx"].includes(ext)) {
                        iconColor = "text-green-500"; iconBg = "bg-green-50 border-green-100"; IconComp = FileText;
                      } else if (["zip","rar","7z"].includes(ext)) {
                        iconColor = "text-yellow-600"; iconBg = "bg-yellow-50 border-yellow-100"; IconComp = FileText;
                      } else if (["py","js","ts","txt","md","html"].includes(ext)) {
                        iconColor = "text-slate-500"; iconBg = "bg-slate-50 border-slate-200"; IconComp = FileText;
                      }

                      return (
                        <div key={rm.id} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:border-violet-300 hover:shadow-md transition-all group overflow-hidden">
                          <div className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-4 min-w-0">
                              {/* File type icon */}
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${iconBg} group-hover:opacity-90 transition-opacity`}>
                                <IconComp className={`w-6 h-6 ${iconColor}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-lg text-slate-800 truncate">{rm.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {isUploaded && originalFileName && (
                                    <span className="text-sm text-slate-400 truncate max-w-[220px]">{originalFileName}</span>
                                  )}
                                  {isUploaded && sizeLabel && (
                                    <>
                                      <span className="text-slate-300 text-xs">·</span>
                                      <span className="text-sm text-slate-400">{sizeLabel}</span>
                                    </>
                                  )}
                                  {isUploaded && ext && (
                                    <>
                                      <span className="text-slate-300 text-xs">·</span>
                                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ext}</span>
                                    </>
                                  )}
                                  {!isUploaded && rm.link && (
                                    <span className="text-sm text-slate-400 truncate max-w-[200px]">{rm.link}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Open Material — embedded viewer, no new tab, no download */}
                            {fileUrl && (
                              <MaterialViewerModal
                                url={fileUrl}
                                title={rm.title}
                                ext={ext}
                                mimeType={mimeType}
                                materialId={rm.id}
                                activityMessage={`Opened reading material: ${rm.title}`}
                              >
                                <Button className="ml-4 shrink-0 bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
                                  <Eye className="w-4 h-4 mr-2" />
                                  Open Material
                                </Button>
                              </MaterialViewerModal>
                            )}
                          </div>

                          {/* Inline image preview */}
                          {isUploaded && isImage && fileUrl && (
                            <div className="px-5 pb-5">
                              <div className="rounded-lg overflow-hidden border border-slate-100 bg-slate-50 max-h-64 flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={fileUrl}
                                  alt={rm.title}
                                  className="max-h-64 max-w-full object-contain"
                                  loading="lazy"
                                />
                              </div>
                            </div>
                          )}

                          {/* Inline PDF preview via iframe */}
                          {isUploaded && isPdf && fileUrl && (
                            <div className="px-5 pb-5">
                              <details className="group/pdf">
                                <summary className="text-xs font-semibold text-violet-600 hover:text-violet-800 cursor-pointer select-none mb-2">
                                  Preview PDF ▾
                                </summary>
                                <div className="rounded-lg overflow-hidden border border-slate-100">
                                  <iframe
                                    src={`${fileUrl}#toolbar=0`}
                                    className="w-full h-96 bg-slate-50"
                                    title={rm.title}
                                    loading="lazy"
                                  />
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                                fileUrl: existingSub.fileUrl ?? null,
                                publicId: existingSub.publicId ?? null,
                                fileType: existingSub.fileType ?? null,
                                mimeType: existingSub.mimeType ?? null,
                                fileSize: existingSub.fileSize ?? null,
                                originalFileName: existingSub.originalFileName ?? null,
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

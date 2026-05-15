import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpen, FileText, CheckCircle, LayoutList, Video, Trash2, HelpCircle, ExternalLink, GripVertical, Radio, Link2, MonitorPlay, Users, MessageSquare } from "lucide-react";
import { notifyEnrolledStudents, createEvent } from "@/lib/notifications";
import { randomBytes } from "crypto";
import { StartClassButton } from "@/components/StartClassButton";
import { SubmissionsPanel } from "@/components/SubmissionsPanel";
import { sendLiveClassEmail } from "@/lib/mail";
import { RecordedClassesTab } from "@/components/RecordedClassesTab";
import { MaterialAnalyticsButton } from "@/components/MaterialAnalyticsButton";
import { InstructorFeedbackTab } from "@/components/admin/InstructorFeedbackTab";


import { VideoPlayerModal } from "@/components/VideoPlayerModal";

// --- SERVER ACTIONS ---

async function createModule(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const courseId = formData.get("courseId") as string;
  if (title && courseId) {
    await prisma.module.create({ data: { title, courseId } });
    // Calendar event: module published now
    await createEvent({
      title: `New Module: ${title}`,
      date: new Date(),
      type: "MODULE_PUBLISH",
      courseId,
    });
    // Notify enrolled students
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
    if (course) {
      await notifyEnrolledStudents({
        courseId,
        message: `New module "${title}" has been added to "${course.title}".`,
        type: "MODULE",
      });
    }
    revalidatePath(`/instructor/courses/${courseId}`);
  }
}

async function createLesson(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const moduleId = formData.get("moduleId") as string;
  const courseId = formData.get("courseId") as string;
  if (title && moduleId) {
    await prisma.lesson.create({ data: { title, moduleId } });
    revalidatePath(`/instructor/courses/${courseId}`);
  }
}

async function createReadingMaterial(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const link = formData.get("link") as string;
  const courseId = formData.get("courseId") as string;
  if (title && link && courseId) {
    await prisma.readingMaterial.create({ data: { title, link, courseId } });
    revalidatePath(`/instructor/courses/${courseId}`);
  }
}

async function createAssignment(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const driveLink = formData.get("driveLink") as string;
  const courseId = formData.get("courseId") as string;
  const deadlineRaw = formData.get("deadline") as string;

  if (title && courseId) {
    await prisma.assignment.create({ data: { title, description, driveLink, courseId } });

    // Calendar event: assignment deadline (default 7 days from now if not provided)
    const deadlineDate = deadlineRaw ? new Date(deadlineRaw) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await createEvent({
      title: `Assignment Due: ${title}`,
      date: deadlineDate,
      type: "ASSIGNMENT_DEADLINE",
      courseId,
    });

    // Notify enrolled students
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
    if (course) {
      await notifyEnrolledStudents({
        courseId,
        message: `New assignment "${title}" has been posted in "${course.title}". Due: ${deadlineDate.toLocaleDateString("en-IN")}.`,
        type: "ASSIGNMENT",
      });
    }

    revalidatePath(`/instructor/courses/${courseId}`);
  }
}

async function deleteResource(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const type = formData.get("type") as string;
  const courseId = formData.get("courseId") as string;

  if (type === "assignment") await prisma.assignment.delete({ where: { id } });
  if (type === "reading") await prisma.readingMaterial.delete({ where: { id } });
  
  revalidatePath(`/instructor/courses/${courseId}`);
}

async function togglePublish(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const isPublished = formData.get("isPublished") === "true";
  const course = await prisma.course.update({
    where: { id: courseId },
    data: { published: !isPublished },
    select: { title: true },
  });

  // Only fire events/notifications when PUBLISHING (not unpublishing)
  if (!isPublished) {
    await createEvent({
      title: `Course Published: ${course.title}`,
      date: new Date(),
      type: "COURSE_PUBLISHED",
      courseId,
    });
    await notifyEnrolledStudents({
      courseId,
      message: `"${course.title}" is now live! Start learning today.`,
      type: "COURSE",
    });
  }

  revalidatePath(`/instructor/courses/${courseId}`);
  revalidatePath(`/instructor`);
}

async function createQuiz(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const courseId = formData.get("courseId") as string;
  if (title && courseId) {
    await prisma.quiz.create({ data: { title, courseId } });
    revalidatePath(`/instructor/courses/${courseId}`);
  }
}

async function addQuestion(formData: FormData) {
  "use server";
  const quizId = formData.get("quizId") as string;
  const courseId = formData.get("courseId") as string;
  const type = formData.get("type") as string;
  const text = formData.get("text") as string;

  if (type === "MCQ") {
    const options = [
      formData.get("opt0") as string,
      formData.get("opt1") as string,
      formData.get("opt2") as string,
      formData.get("opt3") as string,
    ];
    const correctOption = parseInt(formData.get("correctOption") as string);
    await prisma.question.create({
      data: { quizId, type, text, options, correctOption, points: 1 }
    });
  } else {
    await prisma.question.create({
      data: { quizId, type, text, points: 1 }
    });
  }
  revalidatePath(`/instructor/courses/${courseId}`);
}

async function deleteQuiz(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const courseId = formData.get("courseId") as string;
  await prisma.quiz.delete({ where: { id } });
  revalidatePath(`/instructor/courses/${courseId}`);
}

async function createLiveSession(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const courseId = formData.get("courseId") as string;
  const scheduledAtRaw = formData.get("scheduledAt") as string;
  const moduleId = formData.get("moduleId") as string | null;

  if (title && courseId) {
    const roomId = randomBytes(8).toString("hex");
    // Parse scheduledAt — default to now if instructor didn't pick a time
    const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : new Date();

    const session = await prisma.liveSession.create({
      data: {
        roomId,
        title,
        courseId,
        status: "SCHEDULED",
        scheduledAt,
        ...(moduleId ? { moduleId } : {}),
      },
      include: {
        course: {
          include: {
            creator: { select: { name: true, email: true } },
          },
        },
      },
    });

    // ── Notifications (email + in-app) ─────────────────────────────────────
    // Wrapped in try/catch so any failure is logged but NEVER breaks room creation
    try {
      // 1. Collect enrolled student emails for this course
      let studentEmails: string[] = [];
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        include: { user: { select: { email: true } } },
      });

      if (enrollments.length > 0) {
        studentEmails = enrollments.map((e) => e.user.email);
      } else {
        // Fallback: all STUDENT members of the same organisation
        const orgMembers = await prisma.organizationMember.findMany({
          where: {
            organizationId: session.course.organizationId,
            role: "STUDENT",
          },
          include: { user: { select: { email: true } } },
        });
        studentEmails = orgMembers.map((m) => m.user.email);
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const joinLink = `${appUrl}/meet/${roomId}`;
      const instructorName = session.course.creator?.name || "Your Instructor";
      const courseName = session.course.title;

      if (studentEmails.length > 0) {
        // 2. Rich HTML email — subject: "New Live Class Scheduled"
        await sendLiveClassEmail({
          to: studentEmails,
          courseName,
          sessionTitle: title,
          scheduledAt,
          instructorName,
          joinLink,
        });
        console.log(
          `[createLiveSession] 📧 Email sent to ${studentEmails.length} student(s) for session "${title}"`
        );

        // 3. In-app notification for all enrolled students
        await notifyEnrolledStudents({
          courseId,
          message: `📡 New live class "${title}" scheduled for ${courseName}. Scheduled: ${scheduledAt.toLocaleString("en-IN")}. Join: ${joinLink}`,
          type: "COURSE",
        });
      } else {
        console.log("[createLiveSession] No enrolled students found to notify.");
      }
    } catch (notifErr) {
      // Log but never re-throw — session creation succeeds regardless
      console.error("[createLiveSession] Notification step failed (non-fatal):", notifErr);
    }
    // ───────────────────────────────────────────────────────────────────────

    revalidatePath(`/instructor/courses/${courseId}`);
  }
}

async function deleteLiveSession(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const courseId = formData.get("courseId") as string;
  await prisma.liveSession.delete({ where: { id } });
  revalidatePath(`/instructor/courses/${courseId}`);
}

async function markSessionOngoing(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const courseId = formData.get("courseId") as string;
  const roomId = formData.get("roomId") as string;
  await prisma.liveSession.update({ where: { id }, data: { status: "ONGOING" } });
  revalidatePath(`/instructor/courses/${courseId}`);
  redirect(`/meet/${roomId}`);
}

// --- PAGE COMPONENT ---

export default async function CourseBuilderPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ courseId: string }>, 
  searchParams: Promise<{ tab?: string }> 
}) {
  const { courseId } = await params;
  const { tab = "modules" } = await searchParams;
  
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { id: 'asc' },
        include: {
          lessons: { orderBy: { id: 'asc' } },
          liveSessions: { orderBy: { createdAt: 'desc' } },
          recordedClasses: { orderBy: { createdAt: 'desc' } },
        },
      },
      assignments: { orderBy: { createdAt: 'desc' } },
      readingMaterials: { orderBy: { createdAt: 'desc' } },
      quizzes: { include: { questions: true } },
      liveSessions: { orderBy: { createdAt: 'desc' } },
    }
  });

  if (!course) redirect("/instructor");

  // Fetch submissions for all assignments in this course
  type SubmissionWithStudent = {
    id: string; assignmentId: string; studentId: string;
    driveLink: string; grade: number | null; maxGrade: number;
    feedback: string | null; submittedAt: Date; gradedAt: Date | null;
    student: { id: string; name: string | null; email: string };
  };
  const submissionsMap = new Map<string, SubmissionWithStudent[]>();
  try {
    const allSubs = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: { in: course.assignments.map((a) => a.id) } },
      include: { student: { select: { id: true, name: true, email: true } } },
      orderBy: { submittedAt: 'desc' },
    }) as SubmissionWithStudent[];
    for (const s of allSubs) {
      if (!submissionsMap.has(s.assignmentId)) submissionsMap.set(s.assignmentId, []);
      submissionsMap.get(s.assignmentId)!.push(s);
    }
  } catch {
    // silently degrade — submissions show as empty
  }

  // Fetch enrolled students for Students Info tab
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { id: "asc" },
  });

  // Fetch per-student activity stats for enriched Students Info
  const studentIds = enrollments.map((e) => e.userId);
  const [assignmentSubs, quizSubs] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: { assignment: { courseId }, studentId: { in: studentIds } },
      select: { studentId: true },
    }),
    prisma.quizSubmission.findMany({
      where: { quiz: { courseId }, studentId: { in: studentIds } },
      select: { studentId: true },
    }),
  ]);
  // Material views — count distinct materials viewed per student
  let materialViews: { studentId: string; materialId: string }[] = [];
  try {
    materialViews = await prisma.materialView.findMany({
      where: { material: { courseId }, studentId: { in: studentIds } },
      select: { studentId: true, materialId: true },
    });
  } catch (err) {
    console.error("[StudentsInfo] materialView query failed:", err);
    /* degrade gracefully — materials column will show 0 */
  }

  const totalAssignments = course.assignments.length;
  const totalQuizzes = course.quizzes.length;
  const totalMaterials = course.readingMaterials.length;
  const totalActivities = totalAssignments + totalQuizzes + totalMaterials;

  const menuItems = [
    { label: 'Back to Workspace', ariaLabel: 'Go back to workspace', link: '/instructor' },
    { label: 'Curriculum Builder', ariaLabel: 'View modules', link: `?tab=modules` },
    { label: 'Reading Materials', ariaLabel: 'View materials', link: `?tab=reading` },
    { label: 'Assignments', ariaLabel: 'View assignments', link: `?tab=assignments` },
    { label: 'Quizzes & Tests', ariaLabel: 'View quizzes', link: `?tab=quizzes` },
    { label: 'Students Info', ariaLabel: 'View enrolled students', link: `?tab=students` },
  ];

  const socialItems = [
    { label: 'Admin Hub', link: '/admin' },
    { label: 'Support', link: '/support' }
  ];

  return (
    <div className="container-page space-y-8">
      {/* Course Title Header */}
      <div className="flex items-center justify-between">
        <Link href="/instructor">
          <Button variant="ghost" className="text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 px-0">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Workspace
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-zinc-900">{course.title}</h1>
          <span className={`status-badge ${course.published ? 'status-badge--success' : 'status-badge--warning'}`}>
            {course.published ? 'PUBLISHED' : 'DRAFT'}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-6">
        
      <div className="flex justify-end gap-3 pb-6 border-b border-zinc-200">
        <Link href={`/student/courses/${course.id}`}>
          <Button variant="outline" className="font-bold text-xs uppercase tracking-wider">Preview</Button>
        </Link>
        <form action={togglePublish}>
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="isPublished" value={course.published.toString()} />
          <Button type="submit" className={course.published ? "bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider" : "bg-zinc-900 text-white hover:bg-zinc-800 font-bold text-xs uppercase tracking-wider"}>
            {course.published ? "Unpublish" : "Publish"}
          </Button>
        </form>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4">
          
          {/* SIDEBAR */}
          <div className="space-y-2">
            <Link href={`?tab=modules`}><Button variant={tab === "modules" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "modules" ? "bg-slate-200 text-slate-900 font-semibold" : "text-slate-600"}`}><LayoutList className="w-4 h-4 mr-2" /> Modules</Button></Link>
            <Link href={`?tab=reading`}><Button variant={tab === "reading" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "reading" ? "bg-slate-200 text-slate-900 font-semibold" : "text-slate-600"}`}><FileText className="w-4 h-4 mr-2" /> Reading Materials</Button></Link>
            <Link href={`?tab=assignments`}><Button variant={tab === "assignments" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "assignments" ? "bg-slate-200 text-slate-900 font-semibold" : "text-slate-600"}`}><CheckCircle className="w-4 h-4 mr-2" /> Assignments</Button></Link>
            <Link href={`?tab=quizzes`}><Button variant={tab === "quizzes" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "quizzes" ? "bg-slate-200 text-slate-900 font-semibold" : "text-slate-600"}`}><HelpCircle className="w-4 h-4 mr-2" /> Quizzes & Tests</Button></Link>
            <Link href={`?tab=students`}><Button variant={tab === "students" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "students" ? "bg-emerald-100 text-emerald-700 font-semibold" : "text-slate-600"}`}><Users className="w-4 h-4 mr-2" /> Students Info</Button></Link>
            <Link href={`?tab=adminfeedback`}><Button variant={tab === "adminfeedback" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "adminfeedback" ? "bg-violet-100 text-violet-700 font-semibold" : "text-slate-600"}`}>
              <MessageSquare className="w-4 h-4 mr-2" /> Admin Feedback
            </Button></Link>
          </div>

          <div className="md:col-span-3">
            
            {/* MODULES TAB */}
            {tab === "modules" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">Curriculum Builder</h2>
                {course.modules.map((module, idx) => (
                  <Card key={module.id} className="border-slate-200 shadow-sm">
                    <CardHeader className="py-3 bg-slate-50 border-b flex flex-row items-center gap-4">
                      <GripVertical className="text-slate-400 w-5 h-5"/>
                      <CardTitle className="text-base font-semibold">Module {idx + 1}: {module.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 bg-white space-y-5">

                      {/* ── Lessons ───────────────────────────────────────── */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5" /> Lessons
                        </p>
                        {module.lessons.length === 0 && (
                          <p className="text-xs text-slate-400 pl-1">No lessons yet.</p>
                        )}
                        {module.lessons.map((lesson, lIdx) => (
                          <div key={lesson.id} className="flex items-center justify-between p-3 border rounded-md mb-2 group">
                            <div className="flex items-center gap-3"><Video className="w-4 h-4 text-blue-600"/><span className="text-sm">{lIdx + 1}. {lesson.title}</span></div>
                            <Link href={`/instructor/courses/${courseId}/lessons/${lesson.id}`}><Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">Edit</Button></Link>
                          </div>
                        ))}
                        <form action={createLesson} className="flex gap-2 mt-2">
                          <input type="hidden" name="moduleId" value={module.id} /><input type="hidden" name="courseId" value={courseId} />
                          <Input name="title" required placeholder="Lesson title..." className="h-9 text-sm"/>
                          <Button type="submit" variant="outline" size="sm" className="h-9">Add Lesson</Button>
                        </form>
                      </div>

                      {/* ── Live Classes ──────────────────────────────────── */}
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5" /> Live Classes
                        </p>
                        {module.liveSessions.length === 0 && (
                          <p className="text-xs text-slate-400 pl-1">No live classes scheduled for this module.</p>
                        )}
                        {module.liveSessions.map((session) => (
                          <div key={session.id} className={`flex items-center justify-between p-3 border rounded-md mb-2 ${
                            session.status === "ONGOING" ? "border-red-300 bg-red-50" : "border-slate-200"
                          }`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                session.status === "ONGOING" ? "bg-red-100 text-red-700" :
                                session.status === "COMPLETED" ? "bg-slate-100 text-slate-500" :
                                "bg-blue-100 text-blue-700"
                              }`}>
                                {session.status === "ONGOING" ? "LIVE" : session.status}
                              </span>
                              <span className="text-sm font-medium truncate">{session.title}</span>
                              <span className="text-xs text-slate-400 shrink-0">
                                {new Date(session.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {session.status === "SCHEDULED" && (
                                <StartClassButton sessionId={session.id} roomId={session.roomId} />
                              )}
                              {session.status === "ONGOING" && (
                                <Link href={`/meet/${session.roomId}`}>
                                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-xs px-3">Rejoin</Button>
                                </Link>
                              )}
                              {session.recordingUrl && (
                                <VideoPlayerModal
                                  videoUrl={session.recordingUrl}
                                  title={`Recording: ${session.title}`}
                                >
                                  <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 text-xs">
                                    <MonitorPlay className="w-3 h-3 mr-1" /> Rec
                                  </Button>
                                </VideoPlayerModal>
                              )}
                              <form action={deleteLiveSession}>
                                <input type="hidden" name="id" value={session.id} />
                                <input type="hidden" name="courseId" value={courseId} />
                                <Button type="submit" variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-7 w-7 p-0">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </form>
                            </div>
                          </div>
                        ))}
                        {/* Inline Create Live Class form for this module */}
                        <form action={createLiveSession} className="flex flex-wrap gap-2 mt-2">
                          <input type="hidden" name="courseId" value={courseId} />
                          <input type="hidden" name="moduleId" value={module.id} />
                          <Input name="title" required placeholder="Live class title..." className="h-9 text-sm flex-1 min-w-40"/>
                          <Input name="scheduledAt" type="datetime-local" className="h-9 text-sm bg-white w-52"/>
                          <Button type="submit" size="sm" className="h-9 bg-red-600 hover:bg-red-700 text-white">
                            <Radio className="w-3.5 h-3.5 mr-1.5" /> Schedule
                          </Button>
                        </form>
                      </div>

                      {/* ── Recorded Videos ────────────────────────────────── */}
                      {module.recordedClasses.length > 0 && (
                        <div className="border-t border-slate-100 pt-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2 flex items-center gap-1.5">
                            <MonitorPlay className="w-3.5 h-3.5" /> Recorded Videos
                          </p>
                          {module.recordedClasses.map((rec) => (
                            <div key={rec.id} className="flex items-center justify-between p-3 border border-indigo-100 rounded-md mb-2 bg-indigo-50/40">
                              <div className="flex items-center gap-3 min-w-0">
                                <MonitorPlay className="w-4 h-4 text-indigo-500 shrink-0" />
                                <span className="text-sm font-medium truncate">{rec.title}</span>
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
                                <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-200 text-xs">
                                  <MonitorPlay className="w-3 h-3 mr-1" /> Watch
                                </Button>
                              </VideoPlayerModal>
                            </div>
                          ))}
                        </div>
                      )}

                    </CardContent>
                  </Card>
                ))}
                <Card className="border-dashed border-2 p-6 bg-transparent">
                  <form action={createModule} className="flex gap-4 items-end">
                    <input type="hidden" name="courseId" value={courseId} />
                    <div className="flex-1 space-y-2"><Label>New Module</Label><Input name="title" required placeholder="Week 1..."/></div>
                    <Button type="submit" className="bg-slate-900 text-white">Create Module</Button>
                  </form>
                </Card>
              </div>
            )}

            {/* READING TAB */}
            {tab === "reading" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold">Reading Materials</h2>
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader><CardTitle className="text-lg">Add New Document</CardTitle></CardHeader>
                  <CardContent>
                    <form action={createReadingMaterial} className="space-y-4">
                      <input type="hidden" name="courseId" value={courseId} />
                      <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="e.g. Week 1 Notes"/></div>
                      <div className="space-y-2"><Label>Link (Drive/PDF)</Label><Input name="link" required placeholder="https://drive.google.com/..."/></div>
                      <Button type="submit" className="w-full bg-blue-600 text-white">Save Material</Button>
                    </form>
                  </CardContent>
                </Card>
                {course.readingMaterials.map((rm) => (
                  <Card key={rm.id} className="p-4 flex justify-between items-center bg-white border-slate-200">
                    <div className="flex items-center gap-3"><FileText className="w-5 h-5 text-slate-400"/><span className="font-bold">{rm.title}</span></div>
                    <div className="flex gap-1 items-center">
                      <MaterialAnalyticsButton materialId={rm.id} materialTitle={rm.title} courseId={courseId} />
                      <Link href={rm.link} target="_blank"><Button variant="ghost" size="sm"><ExternalLink className="w-4 h-4"/></Button></Link>
                      <form action={deleteResource}><input type="hidden" name="id" value={rm.id} /><input type="hidden" name="type" value="reading" /><input type="hidden" name="courseId" value={courseId} /><Button type="submit" variant="ghost" size="sm" className="text-red-500"><Trash2 className="w-4 h-4"/></Button></form>
                    </div>
                  </Card>
                ))}
                {course.readingMaterials.length === 0 && <p className="text-center py-12 text-slate-400">No reading materials added yet.</p>}
              </div>
            )}

            {/* ASSIGNMENTS TAB */}
            {tab === "assignments" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold">Course Assignments</h2>
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader><CardTitle className="text-lg">Create Assignment</CardTitle></CardHeader>
                  <CardContent>
                    <form action={createAssignment} className="space-y-4">
                      <input type="hidden" name="courseId" value={courseId} />
                      <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="Final Project"/></div>
                      <div className="space-y-2"><Label>Description</Label><Textarea name="description" placeholder="Instructions..."/></div>
                      <div className="space-y-2"><Label>Problem Statement (Drive)</Label><Input name="driveLink" placeholder="https://drive..."/></div>
                      <div className="space-y-2">
                        <Label>Deadline <span className="text-slate-400 font-normal">(optional — defaults to 7 days)</span></Label>
                        <Input name="deadline" type="datetime-local" className="bg-white"/>
                      </div>
                      <Button type="submit" className="w-full bg-blue-600 text-white">Add Assignment</Button>
                    </form>
                  </CardContent>
                </Card>
                {course.assignments.map((asgn) => (
                  <Card key={asgn.id} className="p-0 bg-white border-slate-200 shadow-sm overflow-hidden">
                    <div className="h-1 w-full bg-amber-400" />
                    <div className="p-5">
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg">{asgn.title}</h3>
                          {asgn.description && <p className="text-sm text-slate-500 mt-1">{asgn.description}</p>}
                          {asgn.driveLink && (
                            <a href={asgn.driveLink} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> View Problem Statement
                            </a>
                          )}
                        </div>
                        <form action={deleteResource} className="shrink-0">
                          <input type="hidden" name="id" value={asgn.id} />
                          <input type="hidden" name="type" value="assignment" />
                          <input type="hidden" name="courseId" value={courseId} />
                          <Button type="submit" variant="ghost" className="text-red-500"><Trash2 className="w-4 h-4"/></Button>
                        </form>
                      </div>

                      {/* Submissions panel */}
                      <SubmissionsPanel
                        assignmentId={asgn.id}
                        assignmentTitle={asgn.title}
                        initialSubmissions={(submissionsMap.get(asgn.id) ?? []).map((s) => ({
                          id: s.id,
                          studentId: s.studentId,
                          driveLink: s.driveLink,
                          grade: s.grade,
                          maxGrade: s.maxGrade,
                          feedback: s.feedback ?? null,
                          submittedAt: s.submittedAt.toISOString(),
                          gradedAt: s.gradedAt?.toISOString() ?? null,
                          student: s.student,
                        }))}
                      />
                    </div>
                  </Card>
                ))}
                {course.assignments.length === 0 && <p className="text-center py-12 text-slate-400">No assignments created yet.</p>}
              </div>
            )}

            {/* QUIZZES TAB */}
            {tab === "quizzes" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Quiz Management</h2>
                  <form action={createQuiz} className="flex gap-2">
                    <input type="hidden" name="courseId" value={courseId} />
                    <Input name="title" required placeholder="Quiz Name..." className="w-64 bg-white" />
                    <Button type="submit" size="sm" className="bg-blue-600">Create Quiz</Button>
                  </form>
                </div>

                {course.quizzes.map((quiz) => (
                  <Card key={quiz.id} className="border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b flex flex-row justify-between items-center py-4">
                      <div>
                        <CardTitle className="text-lg">{quiz.title}</CardTitle>
                        <CardDescription>{quiz.questions.length} Questions total</CardDescription>
                      </div>
                      <form action={deleteQuiz}>
                        <input type="hidden" name="id" value={quiz.id} />
                        <input type="hidden" name="courseId" value={courseId} />
                        <Button type="submit" variant="ghost" size="sm" className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                      </form>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      
                      {/* List Questions */}
                      <div className="space-y-4">
                        {quiz.questions.map((q, qIdx) => (
                          <div key={q.id} className="p-4 border rounded-md bg-white">
                            <div className="flex justify-between">
                              <span className="text-xs font-bold uppercase text-blue-600 tracking-wider">{q.type}</span>
                              <span className="text-xs text-slate-400">1 Mark</span>
                            </div>
                            <p className="font-medium mt-1">{qIdx + 1}. {q.text}</p>
                            {q.type === "MCQ" && (
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className={`text-sm p-2 rounded border ${q.correctOption === oIdx ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-100'}`}>
                                    {opt} {q.correctOption === oIdx && "✓"}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add Question Form */}
                      <div className="pt-6 border-t border-slate-100">
                        <p className="text-sm font-bold mb-4">Add New Question</p>
                        <form action={addQuestion} className="space-y-4">
                          <input type="hidden" name="quizId" value={quiz.id} />
                          <input type="hidden" name="courseId" value={courseId} />
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Question Type</Label>
                              <select name="type" className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                                <option value="MCQ">Multiple Choice (Auto-Correct)</option>
                                <option value="ESSAY">Essay (Manual Correction)</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label>Question Text</Label>
                              <Input name="text" required placeholder="What is the capital of..." />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md">
                            <div className="space-y-2">
                              <Label>Option 1</Label><Input name="opt0" placeholder="Option A" />
                            </div>
                            <div className="space-y-2">
                              <Label>Option 2</Label><Input name="opt1" placeholder="Option B" />
                            </div>
                            <div className="space-y-2">
                              <Label>Option 3</Label><Input name="opt2" placeholder="Option C" />
                            </div>
                            <div className="space-y-2">
                              <Label>Option 4</Label><Input name="opt3" placeholder="Option D" />
                            </div>
                            <div className="col-span-2 space-y-2">
                              <Label>Correct Option Index (0-3)</Label>
                              <Input name="correctOption" type="number" min="0" max="3" placeholder="e.g. 0 for Option A" />
                            </div>
                          </div>
                          
                          <Button type="submit" variant="outline" className="w-full">Save Question to Quiz</Button>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {course.quizzes.length === 0 && <p className="text-center py-12 text-slate-400">No quizzes created yet.</p>}
              </div>
            )}

            {/* STUDENTS INFO TAB */}
            {tab === "students" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-6 h-6 text-emerald-600" />
                    <h2 className="text-xl font-bold">Students Info</h2>
                  </div>
                  <span className="text-sm font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                    {enrollments.length} enrolled
                  </span>
                </div>

                {enrollments.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-lg font-semibold text-slate-500">No students enrolled yet.</p>
                    <p className="text-sm mt-1">Students will appear here once they enrol in this course.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-5 py-3 font-semibold text-slate-600">#</th>
                          <th className="text-left px-5 py-3 font-semibold text-slate-600">Student</th>
                          <th className="text-left px-5 py-3 font-semibold text-slate-600">Email</th>
                          <th className="text-center px-5 py-3 font-semibold text-slate-600">Assignments</th>
                          <th className="text-center px-5 py-3 font-semibold text-slate-600">Quizzes</th>
                          <th className="text-center px-5 py-3 font-semibold text-slate-600">Materials</th>
                          <th className="text-left px-5 py-3 font-semibold text-slate-600">Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {enrollments.map((enr, idx) => {
                          const asgDone = assignmentSubs.filter(s => s.studentId === enr.userId).length;
                          const qzDone  = quizSubs.filter(s => s.studentId === enr.userId).length;
                          const matDone = new Set(
                            materialViews
                              .filter(s => s.studentId === enr.userId)
                              .map(s => s.materialId)
                          ).size;
                          const done    = asgDone + qzDone + matDone;
                          const pct     = totalActivities > 0 ? Math.round((done / totalActivities) * 100) : 0;
                          return (
                            <tr key={enr.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-emerald-700">
                                      {(enr.user.name ?? enr.user.email)[0].toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="font-medium text-slate-800">{enr.user.name ?? "—"}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-slate-500 text-xs">{enr.user.email}</td>
                              <td className="px-5 py-3 text-center">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  asgDone === totalAssignments && totalAssignments > 0
                                    ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                                }`}>{asgDone}/{totalAssignments}</span>
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  qzDone === totalQuizzes && totalQuizzes > 0
                                    ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                                }`}>{qzDone}/{totalQuizzes}</span>
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  matDone === totalMaterials && totalMaterials > 0
                                    ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                                }`}>{matDone}/{totalMaterials}</span>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-2 bg-emerald-500 rounded-full transition-all"
                                      style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-slate-600 font-bold w-8">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ADMIN FEEDBACK TAB — client component fetches live data */}
            {tab === "adminfeedback" && (
              <InstructorFeedbackTab courseId={courseId} />
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

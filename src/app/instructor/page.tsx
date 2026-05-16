import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";
import { PlusCircle, KeyRound, Building, UserMinus, Settings } from "lucide-react";
import { AdminStatCards } from "@/components/admin/AdminStatCards";
import { AdminInstructorTable, AdminCourseTable } from "@/components/admin/AdminAnalyticsTables";
import { AdminStudentSection } from "@/components/admin/AdminStudentSection";
import { AdminCommentsPanel } from "@/components/admin/AdminCommentsPanel";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

async function removeMember(formData: FormData) {
  "use server";
  const memberId = formData.get("memberId") as string;
  if (memberId) {
    await prisma.organizationMember.delete({ where: { id: memberId } });
    revalidatePath("/instructor");
  }
}

async function createCourse(formData: FormData) {
  "use server";
  const rawTitle     = formData.get("title");
  const rawOrgId     = formData.get("orgId");
  const rawCreatorId = formData.get("creatorId");
  const title     = typeof rawTitle     === "string" ? rawTitle.trim()     : "";
  const orgId     = typeof rawOrgId     === "string" ? rawOrgId.trim()     : "";
  const creatorId = typeof rawCreatorId === "string" ? rawCreatorId.trim() : "";
  if (!title || !orgId || !creatorId) return;
  try {
    const [orgExists, userExists] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId },     select: { id: true } }),
      prisma.user.findUnique({         where: { id: creatorId }, select: { id: true } }),
    ]);
    if (!orgExists || !userExists) return;
    const course = await prisma.course.create({
      data: { title, organizationId: orgId, creatorId, published: true },
    });
    revalidatePath("/instructor");
    redirect(`/instructor/courses/${course.id}`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
  }
}

export default async function WorkspaceDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  let payload;
  try {
    const verified = await jwtVerify(token, secret);
    payload = verified.payload;
  } catch {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId as string },
    include: { memberships: { include: { organization: true } } },
  });

  if (!user || user.memberships.length === 0) redirect("/login");

  const membership = user.memberships[0];
  const org        = membership.organization;
  const isFounder  = membership.role === "ADMIN";

  const [courses, allMembers, myCoursesCount, myStudentsCount] = await Promise.all([
    prisma.course.findMany({
      where: { organizationId: org.id },
      orderBy: { id: "desc" },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: org.id },
      include: { user: true },
      orderBy: { role: "asc" },
    }),
    // Instructor-specific counts (always computed for header cards)
    prisma.course.count({ where: { creatorId: user.id } }),
    prisma.enrollment.count({ where: { course: { creatorId: user.id } } }),
  ]);

  // ── Admin-only analytics ───────────────────────────────────────────────────
  let adminStats       = { totalStudents: 0, activeInstructors: 0, totalCourses: 0, publishedCourses: 0, totalEnrollments: 0 };
  let instructorRows:  { id: string; name: string; coursesCreated: number; enrolledStudents: number; role: string }[] = [];
  let courseRows:      { id: string; title: string; createdBy: string; published: boolean; enrollmentCount: number }[] = [];
  let studentData:     { total: number; active: number; recentlyJoined: { id: string; name: string; email: string }[] } = { total: 0, active: 0, recentlyJoined: [] };

  if (isFounder) {
    const [
      studentCount, instructorCount, totalCoursesCount, publishedCount,
      enrollmentCount, instructorMembers, orgCourses, studentMembers,
    ] = await Promise.all([
      prisma.organizationMember.count({ where: { organizationId: org.id, role: "STUDENT" } }),
      prisma.organizationMember.count({ where: { organizationId: org.id, role: "INSTRUCTOR" } }),
      prisma.course.count({ where: { organizationId: org.id } }),
      prisma.course.count({ where: { organizationId: org.id, published: true } }),
      prisma.enrollment.count({ where: { course: { organizationId: org.id } } }),
      // Only fetch INSTRUCTOR role members (exclude ADMIN) for the analytics table
      prisma.organizationMember.findMany({
        where: { organizationId: org.id, role: "INSTRUCTOR" },
        include: {
          user: {
            include: {
              coursesCreated: {
                where: { organizationId: org.id },
                include: { enrollments: { select: { id: true } } },
              },
            },
          },
        },
      }),
      prisma.course.findMany({
        where: { organizationId: org.id },
        include: { creator: { select: { name: true } }, enrollments: { select: { id: true } } },
        orderBy: { id: "desc" },
        take: 20,
      }),
      prisma.organizationMember.findMany({
        where: { organizationId: org.id, role: "STUDENT" },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { id: "desc" },
        take: 10,
      }),
    ]);

    // Active students = those who have at least one enrollment in this org's courses
    const activeEnrollments = await prisma.enrollment.findMany({
      where: { course: { organizationId: org.id } },
      select: { userId: true },
      distinct: ["userId"],
    });

    adminStats = {
      totalStudents: studentCount,
      activeInstructors: instructorCount,
      totalCourses: totalCoursesCount,
      publishedCourses: publishedCount,
      totalEnrollments: enrollmentCount,
    };

    instructorRows = instructorMembers.map((m) => ({
      id: m.id,
      name: m.user.name || "Unnamed",
      coursesCreated: m.user.coursesCreated.length,
      enrolledStudents: m.user.coursesCreated.reduce((sum, c) => sum + c.enrollments.length, 0),
      role: m.role,
    }));

    courseRows = orgCourses.map((c) => ({
      id: c.id,
      title: c.title,
      createdBy: c.creator?.name || "Unknown",
      published: c.published,
      enrollmentCount: c.enrollments.length,
    }));

    studentData = {
      total: studentCount,
      active: activeEnrollments.length,
      recentlyJoined: studentMembers.map((m) => ({
        id: m.user.id,
        name: m.user.name || "Unnamed",
        email: m.user.email,
      })),
    };
  }

  const menuItems = [
    { label: "Dashboard",     ariaLabel: "Go to dashboard",    link: "/instructor"          },
    { label: "Course Library",ariaLabel: "View courses",       link: "/instructor#courses"  },
    { label: "Directory",     ariaLabel: "View directory",     link: "/instructor#directory"},
    { label: "My Profile",    ariaLabel: "View profile",       link: "/instructor/profile"  },
  ];
  const socialItems = [
    { label: "Admin Hub", link: "/admin" },
    { label: "Docs",      link: "/docs"  },
  ];

  return (
    <div className="container-page space-y-8">
      {/* ── Admin Analytics Dashboard ───────────────────────────────────── */}
      {isFounder && (
        <div id="admin-analytics" className="space-y-6">
          <div className="section-divider">
            <span>Organization Overview</span>
          </div>

          {/* Top 5 stat cards */}
          <AdminStatCards stats={adminStats} orgId={org.id} />

          {/* Instructor + Course analytics tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AdminInstructorTable rows={instructorRows} />
            <AdminCourseTable    rows={courseRows}     />
          </div>

          {/* Student analytics — full width */}
          <AdminStudentSection data={studentData} />

          <div className="section-divider">
            <span>Admin Comments</span>
          </div>
          <AdminCommentsPanel
            orgId={org.id}
            courses={courses.map((c) => ({ id: c.id, title: c.title }))}
          />
        </div>
      )}

      {/* ── Instructor personal stats (non-admin view) ──────────────────── */}
      {!isFounder && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="stat-card">
            <p className="stat-card__label">My Students</p>
            <p className="stat-card__value">{myStudentsCount}</p>
            <p className="stat-card__sub">enrolled in your courses</p>
          </div>
          <div className="stat-card">
            <p className="stat-card__label">My Courses</p>
            <p className="stat-card__value">{myCoursesCount}</p>
            <p className="stat-card__sub">created by you</p>
          </div>
        </div>
      )}

      {/* ── Course Library ──────────────────────────────────────────────── */}
      <div className="space-y-6" id="courses">
        <div className="section-divider">
          <span>Course Library</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-dashed border-2 border-zinc-200 bg-zinc-50/50 shadow-none flex flex-col justify-center h-full">
            <CardContent className="pt-6">
              <form action={createCourse} className="space-y-4">
                <input type="hidden" name="orgId"     value={org.id}  />
                <input type="hidden" name="creatorId" value={user.id} />
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-zinc-600 font-semibold text-xs uppercase tracking-wider">New Course</Label>
                  <Input id="title" name="title" required placeholder="Enter course title..." className="bg-white border-zinc-200"/>
                </div>
                <Button type="submit" className="w-full bg-zinc-900 text-white hover:bg-zinc-800">
                  <PlusCircle className="w-4 h-4 mr-2"/> Create Course
                </Button>
              </form>
            </CardContent>
          </Card>

          {courses.map((course) => (
            <Card key={course.id} className="border-zinc-200 shadow-sm flex flex-col hover:border-zinc-300 transition-all h-full group">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-base leading-tight font-bold text-zinc-800 group-hover:text-zinc-900 transition-colors">{course.title}</CardTitle>
                  <span className={`status-badge ${course.published ? "status-badge--success" : "status-badge--warning"}`}>
                    {course.published ? "Published" : "Draft"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="mt-auto pt-4">
                <Link href={`/instructor/courses/${course.id}`}>
                  <Button variant="outline" className="w-full text-zinc-700 border-zinc-200 hover:bg-zinc-50 font-semibold text-sm">
                    <Settings className="w-4 h-4 mr-2"/> Manage Content
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

        {/* ── Workspace Management ─────────────────────────────────────────── */}
        {isFounder && (
          <>
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-slate-200"/>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Workspace Management</span>
              <div className="h-px flex-1 bg-slate-200"/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card className="border-violet-200 bg-violet-50 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-violet-900 text-base font-bold">
                    <KeyRound className="w-4 h-4"/> Workspace Invite Code
                  </CardTitle>
                  <CardDescription className="text-violet-600 text-xs">Share this with co-instructors and students to join your workspace.</CardDescription>
                </CardHeader>
                <CardContent>
                  <code className="bg-white px-4 py-2.5 rounded-lg border border-violet-200 font-mono text-lg text-violet-900 block w-full text-center tracking-widest font-bold">
                    {org.id}
                  </code>
                </CardContent>
              </Card>

              <Card id="directory" className="border-slate-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold text-slate-900">Workspace Directory</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 border-t border-slate-100 max-h-[260px] overflow-y-auto">
                    {allMembers.map((mem) => (
                      <div key={mem.id} className="flex items-center justify-between px-5 py-3 bg-white hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="font-medium text-slate-900 text-sm flex items-center gap-2">
                            {mem.user.name || "Unnamed"}
                            {mem.id === membership.id && <span className="text-[9px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">You</span>}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{mem.user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-600">{mem.role}</span>
                          {mem.id !== membership.id && (
                            <form action={removeMember}>
                              <input type="hidden" name="memberId" value={mem.id}/>
                              <Button type="submit" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                                <UserMinus className="w-3.5 h-3.5"/>
                              </Button>
                            </form>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ── Bottom padding ─────────────────────────────────────────────── */}
        <div className="h-4"/>
      </div>
  );
}

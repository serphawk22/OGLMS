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
import { PlusCircle, Upload, KeyRound, Building, Users, GraduationCap, BookOpen, UserMinus, Settings, FileText } from "lucide-react";

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
  const title = formData.get("title") as string;
  const orgId = formData.get("orgId") as string;
  const creatorId = formData.get("creatorId") as string;

  if (title && orgId && creatorId) {
    await prisma.course.create({
      data: {
        title,
        organizationId: orgId,
        creatorId: creatorId,
        published: false
      }
    });
    revalidatePath("/instructor");
  }
}

export default async function InstructorDashboard() {
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

  const user = await prisma.user.findUnique({
    where: { id: payload.userId as string },
    include: { memberships: { include: { organization: true } } }
  });

  if (!user || user.memberships.length === 0) redirect("/login");
  
  const membership = user.memberships[0];
  const org = membership.organization;
  const isFounder = membership.role === "ADMIN";

  // FETCH ALL DATA INCLUDING COURSES
  const [studentCount, instructorCount, courses, allMembers] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId: org.id, role: "STUDENT" } }),
    prisma.organizationMember.count({ where: { organizationId: org.id, role: "INSTRUCTOR" } }),
    prisma.course.findMany({ 
      where: { organizationId: org.id },
      orderBy: { id: 'desc' }
    }),
    prisma.organizationMember.findMany({ 
      where: { organizationId: org.id },
      include: { user: true },
      orderBy: { role: 'asc' } 
    })
  ]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-8 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-8">
        
        
        <div className="flex justify-between items-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Instructor Workspace</h1>
            <div className="flex items-center gap-2 mt-2 text-slate-600">
              <Building className="w-4 h-4"/>
              <span className="font-medium">{org.name}</span>
              <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-700 font-semibold">{membership.role}</span>
            </div>
          </div>
          <LogoutButton/>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Students</CardTitle>
              <GraduationCap className="h-4 w-4 text-slate-400"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{studentCount}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Active Instructors</CardTitle>
              <Users className="h-4 w-4 text-slate-400"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{instructorCount + (isFounder ? 1 : 0)}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Workspace Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-slate-400"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courses.length}</div>
            </CardContent>
          </Card>
        </div>

        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Your Course Library</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <Card className="border-dashed border-2 border-slate-300 bg-slate-50 shadow-none flex flex-col justify-center">
              <CardContent className="pt-6">
                <form action={createCourse} className="space-y-4">
                  <input type="hidden" name="orgId" value={org.id} />
                  <input type="hidden" name="creatorId" value={user.id} />
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-slate-600">Quick Draft Course</Label>
                    <Input id="title" name="title" required placeholder="Course Title..." className="bg-white"/>
                  </div>
                  <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800">
                    <PlusCircle className="w-4 h-4 mr-2"/> Initialize Setup
                  </Button>
                </form>
              </CardContent>
            </Card>

            
            {courses.map(course => (
              <Card key={course.id} className="border-slate-200 shadow-sm flex flex-col hover:border-blue-300 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${course.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {course.published ? 'PUBLISHED' : 'DRAFT'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto pt-4">
                  <Link href={`/instructor/courses/${course.id}`}>
                    <Button variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50">
                      <Settings className="w-4 h-4 mr-2"/> Manage Content
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        
        {isFounder && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-slate-200">
            <Card className="border-blue-200 bg-blue-50 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-blue-900 text-lg">
                  <KeyRound className="w-5 h-5"/>
                  Workspace Invite Code
                </CardTitle>
                <CardDescription className="text-blue-700">Share this with co-teachers and students.</CardDescription>
              </CardHeader>
              <CardContent>
                <code className="bg-white px-4 py-2 rounded-md border border-blue-200 font-mono text-lg text-blue-900 block w-full text-center tracking-widest font-bold">
                  {org.id}
                </code>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle className="text-lg">Workspace Directory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-md max-h-[300px] overflow-y-auto">
                  {allMembers.map((mem) => (
                    <div key={mem.id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-medium text-slate-900 text-sm flex items-center gap-2">
                          {mem.user.name || "Unnamed"}
                          {mem.id === membership.id && <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">You</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-600">{mem.role}</span>
                        {mem.id !== membership.id && (
                          <form action={removeMember}>
                            <input type="hidden" name="memberId" value={mem.id} />
                            <Button type="submit" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                              <UserMinus className="w-3 h-3"/>
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
        )}
      </div>
    </div>
  );
}

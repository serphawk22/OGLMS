import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, type JWTPayload } from "jose";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Star, PlayCircle, Briefcase, MapPin, CheckCircle2, Building } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { ExpertiseEditor } from "@/components/ExpertiseEditor";
import { StaggeredMenu } from "@/components/StaggeredMenu";
import BorderGlow from "@/components/BorderGlow";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export default async function InstructorProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, secret);
    payload = verified.payload;
  } catch {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload!.userId as string },
    include: { memberships: { include: { organization: true } } },
    // expertise is a scalar array, included by default
  });

  if (!user || user.memberships.length === 0) redirect("/login");
  
  const membership = user.memberships[0];
  const org = membership.organization;

  // Real stats for the instructor
  const courses = await prisma.course.findMany({ 
    where: { creatorId: user.id },
    orderBy: { id: 'desc' }
  });

  const totalStudents = await prisma.enrollment.count({
    where: {
      course: {
        creatorId: user.id
      }
    }
  });

  // Fetch real reviews for instructor's courses
  const instructorReviews = await prisma.review.findMany({
    where: {
      course: {
        creatorId: user.id
      }
    },
    include: {
      student: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const avgRating =
    instructorReviews.length > 0
      ? Math.round(
          (instructorReviews.reduce((sum, r) => sum + r.rating, 0) /
            instructorReviews.length) *
            10
        ) / 10
      : null;

  const menuItems = [
    { label: 'Workspace', ariaLabel: 'Go back to workspace', link: '/instructor' },
    { label: 'Course Library', ariaLabel: 'View courses', link: '/instructor#courses' },
    { label: 'Directory', ariaLabel: 'View directory', link: '/instructor#directory' },
    { label: 'My Profile', ariaLabel: 'View profile', link: '/instructor/profile' },
  ];

  const socialItems = [
    { label: 'Admin Hub', link: '/admin' },
    { label: 'Support', link: '/support' }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans selection:bg-violet-100">
      
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
        colors={['#8b5cf6', '#6d28d9']}
        accentColor="#8b5cf6"
      />

      <div className="p-8 max-w-5xl mx-auto space-y-8">
        
        {/* Standard Instructor Header (matches dashboard) */}
        <div className="flex justify-between items-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/instructor">
                <Button variant="ghost" size="sm" className="h-8 text-slate-500 hover:text-slate-900 px-2 -ml-2">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              </Link>
              <h1 className="text-3xl font-bold tracking-tight">Instructor Profile</h1>
            </div>
            <div className="flex items-center gap-2 mt-2 text-slate-600">
              <Building className="w-4 h-4"/>
              <span className="font-medium">{org.name}</span>
              <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-700 font-semibold">{membership.role}</span>
            </div>
          </div>
          <LogoutButton/>
        </div>

        {/* Profile Card */}
        <BorderGlow borderRadius={16} backgroundColor="white" colors={['#8b5cf6', '#6d28d9', '#a855f7']} glowIntensity={0.5}>
          <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden rounded-xl h-full">
            <div className="h-24 w-full bg-slate-800"></div>
            <CardContent className="p-8 relative">
              <div className="absolute -top-12 left-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-xl border-4 border-white shadow-md bg-slate-100 overflow-hidden">
                    <img 
                      src={`https://api.dicebear.com/9.x/notionists/svg?seed=${user.name || 'Prof'}&backgroundColor=transparent`} 
                      alt="Instructor Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-1.5 rounded-lg shadow-sm border-2 border-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="mt-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
                  <p className="text-slate-500">{user.email}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mt-3">
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Campus Location</div>
                    <div className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {org.name}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">Edit Profile</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </BorderGlow>

          {/* KPI Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "My Courses", value: courses.length.toString(), icon: PlayCircle },
              { label: "Average Rating", value: avgRating !== null ? avgRating.toFixed(1) : "N/A", icon: Star, color: "text-amber-500" },
              { label: "Total Students", value: totalStudents.toString(), icon: Users }
            ].map((stat, i) => (
              <BorderGlow key={i} borderRadius={12} backgroundColor="white" colors={['#8b5cf6', '#6d28d9', '#a855f7']} glowIntensity={0.5}>
                <Card className="border border-slate-200 shadow-sm bg-white hover:border-blue-200 transition-colors h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-2.5 rounded-lg bg-slate-50 border border-slate-100 ${stat.color || 'text-blue-600'}`}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
                      <p className="text-sm font-medium text-slate-500 mt-1">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </BorderGlow>
            ))}
          </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="md:col-span-2 space-y-8">
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg font-bold text-slate-800">My Published Courses</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {courses.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">You haven&apos;t created any courses yet.</div>
                  ) : (
                    courses.map((course) => (
                      <div key={course.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-center shrink-0">
                            <PlayCircle className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <Link href={`/instructor/courses/${course.id}`} className="font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                              {course.title}
                            </Link>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              <span className={`px-2 py-0.5 rounded-full font-bold ${course.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {course.published ? 'PUBLISHED' : 'DRAFT'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Link href={`/instructor/courses/${course.id}`}>
                          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600">Manage</Button>
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg font-bold text-slate-800">Expertise</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ExpertiseEditor
                  initialSkills={
                    user.expertise && user.expertise.length > 0
                      ? user.expertise
                      : ["Curriculum Design", "Mentorship", "Technical Writing"]
                  }
                />
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg font-bold text-slate-800">Recent Feedback</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                {instructorReviews.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    No reviews yet for your courses.
                  </div>
                ) : (
                  instructorReviews.map((review, i) => (
                    <div key={review.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {(review.student.name ?? review.student.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-700">
                            {review.student.name ?? review.student.email}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">{review.course.title}</span>
                        </div>
                        <div className="ml-auto flex gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-xs ${s <= review.rating ? "text-amber-400" : "text-slate-200"}`}>★</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-lg border border-slate-100">&ldquo;{review.comment}&rdquo;</p>
                      {i < instructorReviews.length - 1 && <hr className="border-slate-100" />}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}

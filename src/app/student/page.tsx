import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";
import { 
  BookOpen, 
  PlayCircle, 
  Bell, 
  GraduationCap, 
  Building, 
  Clock, 
  ChevronRight,
  HelpCircle,
  Sparkles,
  Video
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
  const [courses, dailyBites, quizzes] = await Promise.all([
    prisma.course.findMany({
      where: { organizationId: org.id, published: true },
      take: 3
    }),
    prisma.dailyBite.findMany({
      where: { organizationId: org.id },
      orderBy: { date: 'desc' }, // Updated from createdAt to date as per schema
      take: 1
    }),
    prisma.quiz.findMany({
      where: { course: { organizationId: org.id } },
      take: 3
    })
  ]);

  const latestBite = dailyBites[0];

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900">
      
      
      <div className="bg-white border-b border-slate-200 px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Building className="w-5 h-5"/>
            </div>
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Campus Hub</p>
              <h1 className="text-xl font-bold text-slate-900">{org.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right hidden md:block">
                <p className="text-sm font-bold">{user.name}</p>
                <p className="text-xs text-slate-500">Student ID: {user.id.slice(0, 8)}</p>
             </div>
             <LogoutButton/>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        
        <div className="lg:col-span-2 space-y-8">
          
          
          <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 text-white">
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

          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold flex items-center gap-2">
                 < BookOpen className="w-5 h-5 text-blue-600"/> My Active Courses
               </h3>
               <Button variant="ghost" size="sm" className="text-blue-600">View All</Button>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {courses.map(course => (
                <Card key={course.id} className="border-slate-200 shadow-sm hover:border-blue-300 transition-all cursor-pointer group">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-100 p-3 rounded-lg group-hover:bg-blue-50 transition-colors">
                        <GraduationCap className="w-6 h-6 text-slate-600 group-hover:text-blue-600"/>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{course.title}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                           <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> Updated 2d ago</span>
                           <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                           <span>{org.name}</span>
                        </div>
                      </div>
                    </div>
                    <Link href={`/student/courses/${course.id}`}>
                      <Button variant="ghost" className="group-hover:translate-x-1 transition-transform">
                        Continue <ChevronRight className="w-4 h-4 ml-1"/>
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
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
          
          
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500"/> Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="p-4 border-l-4 border-amber-500 bg-amber-50/50">
                  <p className="text-sm font-bold text-amber-900">Sprint Review Tomorrow</p>
                  <p className="text-xs text-amber-700 mt-1">Ensure all assignments are submitted by 9 AM for the weekly review.</p>
               </div>
            </CardContent>
          </Card>

          
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600"/> Pending Assessments
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100">
               {quizzes.map(quiz => (
                 <div key={quiz.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <p className="text-sm font-bold text-slate-800">{quiz.title}</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">1 Mark Per Question • All MCQs</p>
                    <Button size="sm" className="w-full mt-3 h-8 bg-slate-900 text-[11px]">Start Assessment</Button>
                 </div>
               ))}
               {quizzes.length === 0 && (
                 <div className="p-8 text-center text-xs text-slate-400">
                    All caught up! No pending quizzes.
                 </div>
               )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}

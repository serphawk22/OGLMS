import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlayCircle, FileText, CheckCircle, ExternalLink, BookOpen } from "lucide-react";

export default async function StudentCourseView({ params }: { params: Promise<{ courseId: string }> }) {
  const resolvedParams = await params;
  const courseId = resolvedParams.courseId;
  
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { id: 'asc' },
        include: { lessons: { orderBy: { id: 'asc' } } }
      }
    }
  });

  if (!course) redirect("/student");

  return (
    <div className="min-h-screen bg-white text-slate-900">
      
      {/* Top Navbar */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/instructor">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
              <ArrowLeft className="w-4 h-4 mr-2"/> Exit Preview
            </Button>
          </Link>
          <div className="h-6 w-px bg-slate-700"></div>
          <h1 className="text-lg font-bold">{course.title}</h1>
        </div>
        <div className="text-xs font-medium bg-blue-600 px-3 py-1.5 rounded-full">Student Preview Mode</div>
      </div>

      <div className="max-w-4xl mx-auto p-8 pt-12 space-y-8">
        
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Course Curriculum</h2>
          <p className="text-slate-500">Access your modules and required reading materials below.</p>
        </div>

        {course.modules.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
            No modules have been published for this course yet.
          </div>
        ) : (
          <div className="space-y-6">
            {course.modules.map((module, index) => (
              <Card key={module.id} className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600"/>
                    Module {index + 1}: {module.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {module.lessons.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500 text-center">No materials posted yet.</div>
                    ) : (
                      module.lessons.map((lesson, lessonIndex) => (
                        <div key={lesson.id} className="flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-slate-400"/>
                            <span className="font-medium text-slate-700">
                              {lessonIndex + 1}. {lesson.title}
                            </span>
                          </div>
                          
                          {/* If a Drive link exists, render the access button */}
                          {lesson.videoUrl ? (
                            <Link href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                                Access Material <ExternalLink className="w-3 h-3 ml-2"/>
                              </Button>
                            </Link>
                          ) : (
                            <Button size="sm" variant="outline" disabled className="text-slate-400">
                              No Link Provided
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

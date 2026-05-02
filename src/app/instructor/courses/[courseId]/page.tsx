import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, FileText, HelpCircle, CheckCircle, PlusCircle } from "lucide-react";

export default async function CourseBuilderPage({ params }: { params: Promise<{ courseId: string }> }) {
  const resolvedParams = await params;
  const courseId = resolvedParams.courseId;
  
  const course = await prisma.course.findUnique({
    where: { id: courseId },
  });

  if (!course) redirect("/instructor");

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        
        
        <Link href="/instructor">
          <Button variant="ghost" className="text-slate-500 hover:text-slate-900 mb-4 px-0">
            <ArrowLeft className="w-4 h-4 mr-2"/> Back to Workspace
          </Button>
        </Link>

        
        <div className="flex justify-between items-end border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">{course.title}</h1>
            <p className="text-slate-500 mt-2">Course ID: {course.id}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="text-slate-700">Preview as Student</Button>
            <Button className="bg-slate-900 text-white hover:bg-slate-800">Publish Course</Button>
          </div>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4">
          
          
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-start bg-slate-200 text-slate-900 font-semibold">
              <BookOpen className="w-4 h-4 mr-2"/> Course Modules
            </Button>
            <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-slate-100">
              <FileText className="w-4 h-4 mr-2"/> Reading Materials
            </Button>
            <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-slate-100">
              <HelpCircle className="w-4 h-4 mr-2"/> Quizzes & Tests
            </Button>
            <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-slate-100">
              <CheckCircle className="w-4 h-4 mr-2"/> Grading & Assignments
            </Button>
          </div>

          {/* Main Workspace Area */}
          <div className="md:col-span-3 space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Curriculum Builder</CardTitle>
                <CardDescription>Drag and drop to organize your video lessons and modules.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-md bg-slate-50 m-6">
                <div className="text-center space-y-4">
                  <p className="text-slate-500 font-medium">No modules created yet.</p>
                  <Button className="bg-blue-600 text-white hover:bg-blue-700">
                    <PlusCircle className="w-4 h-4 mr-2"/> Add First Module
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}

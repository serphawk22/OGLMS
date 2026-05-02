import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BookOpen, FileText, HelpCircle, CheckCircle, PlusCircle, GripVertical, LayoutList, Video } from "lucide-react";

// Server Action: Create a new Module
async function createModule(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const courseId = formData.get("courseId") as string;

  if (title && courseId) {
    await prisma.module.create({
      data: { title, courseId }
    });
    revalidatePath(`/instructor/courses/${courseId}`);
  }
}

// NEW Server Action: Create a new Lesson inside a Module
async function createLesson(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const moduleId = formData.get("moduleId") as string;
  const courseId = formData.get("courseId") as string;

  if (title && moduleId) {
    await prisma.lesson.create({
      data: { title, moduleId }
    });
    revalidatePath(`/instructor/courses/${courseId}`);
  }
}

// Server Action: Publish/Unpublish Course
async function togglePublish(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const isPublished = formData.get("isPublished") === "true";

  if (courseId) {
    await prisma.course.update({
      where: { id: courseId },
      data: { published: !isPublished }
    });
    revalidatePath(`/instructor/courses/${courseId}`);
    revalidatePath(`/instructor`);
  }
}

export default async function CourseBuilderPage({ params }: { params: Promise<{ courseId: string }> }) {
  const resolvedParams = await params;
  const courseId = resolvedParams.courseId;
  
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { id: 'asc' },
        include: { 
          lessons: {
            orderBy: { id: 'asc' } // Keep lessons in order of creation
          } 
        }
      }
    }
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
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">{course.title}</h1>
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${course.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {course.published ? 'PUBLISHED' : 'DRAFT'}
              </span>
            </div>
            <p className="text-slate-500 mt-2 font-mono text-sm">ID: {course.id}</p>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" className="text-slate-700 bg-white">Preview as Student</Button>
            
            <form action={togglePublish}>
              <input type="hidden" name="courseId" value={course.id} />
              <input type="hidden" name="isPublished" value={course.published.toString()} />
              <Button type="submit" className={course.published ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-slate-900 text-white hover:bg-slate-800"}>
                {course.published ? "Unpublish Course" : "Publish Course"}
              </Button>
            </form>
          </div>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4">
          
          
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-start bg-slate-200 text-slate-900 font-semibold">
              <LayoutList className="w-4 h-4 mr-2"/> Course Modules
            </Button>
            <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-slate-100">
              <FileText className="w-4 h-4 mr-2"/> Reading Materials
            </Button>
            <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-slate-100">
              <HelpCircle className="w-4 h-4 mr-2"/> Quizzes & Tests
            </Button>
            <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-slate-100">
              <CheckCircle className="w-4 h-4 mr-2"/> Assignments
            </Button>
          </div>

          
          <div className="md:col-span-3 space-y-4">
            
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Curriculum Builder</h2>
              <p className="text-slate-500 text-sm">Organize your modules and video lessons.</p>
            </div>

            
            {course.modules.length === 0 && (
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardContent className="min-h-[250px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-md bg-slate-50 m-6 p-6">
                  <div className="text-center space-y-6 w-full max-w-sm">
                    <p className="text-slate-600 font-medium">No modules created yet.</p>
                    
                    <form action={createModule} className="space-y-3">
                      <input type="hidden" name="courseId" value={course.id} />
                      <Input name="title" required placeholder="e.g., Week 1: Introduction" className="bg-white"/>
                      <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700">
                        <PlusCircle className="w-4 h-4 mr-2"/> Initialize First Module
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            )}

            
            {course.modules.length > 0 && (
              <div className="space-y-4">
                {course.modules.map((module, index) => (
                  <Card key={module.id} className="border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="py-3 flex flex-row items-center gap-4 bg-slate-50 border-b border-slate-100">
                      <GripVertical className="text-slate-400 w-5 h-5 cursor-grab"/>
                      <CardTitle className="text-base font-semibold text-slate-800 m-0 flex-1">
                        Module {index + 1}: {module.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 bg-white">
                      
                      
                      {module.lessons.length === 0 ? (
                        <div className="text-sm text-slate-500 mb-4 border border-dashed border-slate-200 p-4 text-center rounded bg-slate-50">
                          No lessons added to this module yet.
                        </div>
                      ) : (
                        <div className="space-y-2 mb-4">
                          {module.lessons.map((lesson, lessonIndex) => (
                            <div key={lesson.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-md group hover:border-slate-200 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="bg-white p-1.5 rounded border border-slate-200 shadow-sm">
                                  <Video className="w-4 h-4 text-blue-600"/>
                                </div>
                                <span className="text-sm font-medium text-slate-700">
                                  {lessonIndex + 1}. {lesson.title}
                                </span>
                              </div>
                              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                Edit Settings
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      
                      <form action={createLesson} className="flex gap-2 items-center mt-2">
                        <input type="hidden" name="moduleId" value={module.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <Input name="title" required placeholder="New lesson title..." className="h-9 text-sm bg-white"/>
                        <Button type="submit" variant="outline" size="sm" className="h-9 border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 shrink-0">
                          <PlusCircle className="w-4 h-4 mr-2"/> Add Lesson
                        </Button>
                      </form>

                    </CardContent>
                  </Card>
                ))}

                
                <Card className="border-dashed border-2 border-slate-200 shadow-none bg-transparent">
                  <CardContent className="p-6">
                    <form action={createModule} className="flex gap-4 items-end">
                      <input type="hidden" name="courseId" value={course.id} />
                      <div className="flex-1 space-y-2">
                        <label htmlFor="title" className="text-sm font-medium text-slate-700">Add New Module</label>
                        <Input id="title" name="title" required placeholder="e.g., Week 2: Advanced Concepts" className="bg-white"/>
                      </div>
                      <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">
                        <PlusCircle className="w-4 h-4 mr-2"/> Create Module
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpen, FileText, CheckCircle, PlusCircle, LayoutList, Video, Trash2, HelpCircle, ExternalLink, GripVertical } from "lucide-react";

// --- SERVER ACTIONS ---

async function createModule(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const courseId = formData.get("courseId") as string;
  if (title && courseId) {
    await prisma.module.create({ data: { title, courseId } });
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
  if (title && courseId) {
    await prisma.assignment.create({ data: { title, description, driveLink, courseId } });
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
  await prisma.course.update({ where: { id: courseId }, data: { published: !isPublished } });
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
      modules: { orderBy: { id: 'asc' }, include: { lessons: { orderBy: { id: 'asc' } } } },
      assignments: { orderBy: { createdAt: 'desc' } },
      readingMaterials: { orderBy: { createdAt: 'desc' } },
      quizzes: { include: { questions: true } }
    }
  });

  if (!course) redirect("/instructor");

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/instructor">
          <Button variant="ghost" className="text-slate-500 hover:text-slate-900 mb-4 px-0">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Workspace
          </Button>
        </Link>

        {/* Header Section */}
        <div className="flex justify-between items-end border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight">{course.title}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${course.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {course.published ? 'PUBLISHED' : 'DRAFT'}
            </span>
          </div>
          <div className="flex gap-3">
            <Link href={`/student/courses/${course.id}`}><Button variant="outline" className="bg-white">Preview as Student</Button></Link>
            <form action={togglePublish}>
              <input type="hidden" name="courseId" value={course.id} />
              <input type="hidden" name="isPublished" value={course.published.toString()} />
              <Button type="submit" className={course.published ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-slate-900 text-white hover:bg-slate-800"}>
                {course.published ? "Unpublish" : "Publish"}
              </Button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4">
          
          {/* SIDEBAR */}
          <div className="space-y-2">
            <Link href={`?tab=modules`}><Button variant={tab === "modules" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "modules" ? "bg-slate-200 text-slate-900 font-semibold" : "text-slate-600"}`}><LayoutList className="w-4 h-4 mr-2" /> Modules</Button></Link>
            <Link href={`?tab=reading`}><Button variant={tab === "reading" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "reading" ? "bg-slate-200 text-slate-900 font-semibold" : "text-slate-600"}`}><FileText className="w-4 h-4 mr-2" /> Reading Materials</Button></Link>
            <Link href={`?tab=assignments`}><Button variant={tab === "assignments" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "assignments" ? "bg-slate-200 text-slate-900 font-semibold" : "text-slate-600"}`}><CheckCircle className="w-4 h-4 mr-2" /> Assignments</Button></Link>
            <Link href={`?tab=quizzes`}><Button variant={tab === "quizzes" ? "secondary" : "ghost"} className={`w-full justify-start ${tab === "quizzes" ? "bg-slate-200 text-slate-900 font-semibold" : "text-slate-600"}`}><HelpCircle className="w-4 h-4 mr-2" /> Quizzes & Tests</Button></Link>
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
                    <CardContent className="p-4 bg-white">
                      {module.lessons.map((lesson, lIdx) => (
                        <div key={lesson.id} className="flex items-center justify-between p-3 border rounded-md mb-2 group">
                          <div className="flex items-center gap-3"><Video className="w-4 h-4 text-blue-600"/><span className="text-sm">{lIdx + 1}. {lesson.title}</span></div>
                          <Link href={`/instructor/courses/${courseId}/lessons/${lesson.id}`}><Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">Edit</Button></Link>
                        </div>
                      ))}
                      <form action={createLesson} className="flex gap-2 mt-4">
                        <input type="hidden" name="moduleId" value={module.id} /><input type="hidden" name="courseId" value={courseId} />
                        <Input name="title" required placeholder="Lesson title..." className="h-9 text-sm"/>
                        <Button type="submit" variant="outline" size="sm" className="h-9">Add Lesson</Button>
                      </form>
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
                    <div className="flex gap-2">
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
                      <Button type="submit" className="w-full bg-blue-600 text-white">Add Assignment</Button>
                    </form>
                  </CardContent>
                </Card>
                {course.assignments.map((asgn) => (
                  <Card key={asgn.id} className="p-6 flex justify-between items-start bg-white border-slate-200 shadow-sm">
                    <div><h3 className="font-bold text-lg">{asgn.title}</h3><p className="text-sm text-slate-500">{asgn.description}</p></div>
                    <form action={deleteResource}><input type="hidden" name="id" value={asgn.id} /><input type="hidden" name="type" value="assignment" /><input type="hidden" name="courseId" value={courseId} /><Button type="submit" variant="ghost" className="text-red-500"><Trash2 className="w-4 h-4"/></Button></form>
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

          </div>
        </div>
      </div>
    </div>
  );
}

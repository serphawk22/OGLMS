import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Cloud, Save, Globe, Lock, ExternalLink, Trash2 } from "lucide-react";
import { StaggeredMenu } from "@/components/StaggeredMenu";

// Server Action: Update Lesson Details
async function updateLesson(formData: FormData) {
  "use server";
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const title = formData.get("title") as string;
  const videoUrl = formData.get("videoUrl") as string; // We use this field for the Drive Link

  if (lessonId && title) {
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { 
        title, 
        videoUrl: videoUrl || null 
      }
    });
    revalidatePath(`/instructor/courses/${courseId}`);
    revalidatePath(`/instructor/courses/${courseId}/lessons/${lessonId}`);
  }
}

export default async function LessonEditorPage({ 
  params 
}: { 
  params: Promise<{ courseId: string; lessonId: string }> 
}) {
  const { courseId, lessonId } = await params;
  
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: true }
  });

  if (!lesson) redirect(`/instructor/courses/${courseId}`);

  const menuItems = [
    { label: 'Workspace', ariaLabel: 'Go back to workspace', link: '/instructor' },
    { label: 'Course Builder', ariaLabel: 'Go back to course', link: `/instructor/courses/${courseId}` },
    { label: 'Directory', ariaLabel: 'View directory', link: '/instructor#directory' },
    { label: 'My Profile', ariaLabel: 'View profile', link: '/instructor/profile' },
  ];

  const socialItems = [
    { label: 'Admin Hub', link: '/admin' },
    { label: 'Support', link: '/support' }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900">
      
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

      <div className="max-w-4xl mx-auto p-8 space-y-6">
        
        
        <Link href={`/instructor/courses/${courseId}`}>
          <Button variant="ghost" className="text-slate-500 hover:text-slate-900 mb-4 px-0">
            <ArrowLeft className="w-4 h-4 mr-2"/> Back to Curriculum
          </Button>
        </Link>

        <div className="flex justify-between items-center border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Lesson Settings</h1>
            <p className="text-slate-500 mt-1">
              Editing lesson in <span className="font-semibold text-slate-700">{lesson.module.title}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 space-y-6">
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-lg">Resource Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateLesson} className="space-y-6">
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <input type="hidden" name="courseId" value={courseId} />
                  
                  <div className="space-y-2">
                    <Label htmlFor="title">Lesson Title</Label>
                    <Input id="title" name="title" defaultValue={lesson.title} required className="bg-white"/>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="videoUrl">Google Drive Link</Label>
                    <div className="relative">
                      <Cloud className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                      <Input id="videoUrl" name="videoUrl" placeholder="https://drive.google.com/file/d/..." defaultValue={lesson.videoUrl || ""} className="pl-9 bg-white"/>
                    </div>
                    <p className="text-xs text-slate-500">Students will be redirected to this secure link to access the material.</p>
                  </div>

                  <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800">
                    <Save className="w-4 h-4 mr-2"/> Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>

            
            <Card className="border-slate-200 shadow-sm bg-blue-50/50 flex flex-col items-center justify-center text-slate-500 p-8 text-center min-h-[200px]">
               <ExternalLink className="w-12 h-12 mb-4 text-blue-500 opacity-80"/>
               <p className="text-sm font-semibold text-slate-800">External Resource Configuration</p>
               <p className="text-xs mt-2 max-w-[250px] text-slate-600">This lesson is configured to save bandwidth. Students clicking this lesson will be safely routed to the attached Drive document.</p>
            </Card>
          </div>

          
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-none bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Visibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Globe className="text-blue-600 w-4 h-4"/> Published
                  </div>
                  <div className="w-8 h-4 bg-blue-600 rounded-full relative">
                    <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-100 bg-red-50 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-red-900 uppercase tracking-wider">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-100 text-xs justify-start px-2">
                   <Trash2 className="w-3 h-3 mr-2"/> Delete this Lesson
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

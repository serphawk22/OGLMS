import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import LiveClassRoom from "@/components/LiveClassRoom";
import { ArrowLeft, Video, BookOpen, PhoneOff } from "lucide-react";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

interface PageProps {
  params: Promise<{ roomId: string }>;
}

// ── Server action: host ends the session ─────────────────────────────────────
async function endSession(formData: FormData) {
  "use server";
  const sessionId = formData.get("sessionId") as string;
  const courseId  = formData.get("courseId")  as string;
  await prisma.liveSession.update({
    where: { id: sessionId },
    data:  { status: "COMPLETED" },
  });
  revalidatePath(`/instructor/courses/${courseId}`);
  redirect(`/instructor/courses/${courseId}?tab=live`);
}

export default async function MeetPage({ params }: PageProps) {
  const { roomId } = await params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  let payload: { userId: string; email: string; role: string; organizationId: string };
  try {
    const verified = await jwtVerify(token, secret);
    payload = verified.payload as typeof payload;
  } catch {
    redirect("/login");
  }

  // ── Fetch session ─────────────────────────────────────────────────────────
  const session = await prisma.liveSession.findUnique({
    where: { roomId },
    include: { course: { select: { id: true, title: true } } },
  });

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-6 p-8">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
            <Video className="w-10 h-10 text-slate-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">Room Not Found</h1>
            <p className="text-slate-400">This live session doesn&apos;t exist or has ended.</p>
          </div>
          <Link
            href="/student"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isHost = payload.role === "INSTRUCTOR" || payload.role === "ADMIN";

  // Resolve display name
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { name: true },
  });
  const displayName = user?.name || payload.email.split("@")[0];

  return (
    <div className="flex flex-col h-screen bg-slate-950">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0 gap-4">

        {/* Left: back / leave */}
        {isHost ? (
          /* Instructor: "End Class" ends the session in DB */
          <form action={endSession} className="shrink-0">
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="courseId"  value={session.course.id} />
            <button
              type="submit"
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              <PhoneOff className="w-4 h-4" />
              End Class
            </button>
          </form>
        ) : (
          /* Student: just navigates away */
          <Link
            href="/student"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Leave Class
          </Link>
        )}

        {/* Centre: session info */}
        <div className="flex items-center gap-3 text-white min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm font-semibold truncate">{session.title}</span>
          </div>
          <span className="text-slate-600 hidden sm:block">|</span>
          <div className="hidden sm:flex items-center gap-1 text-slate-400 text-xs min-w-0">
            <BookOpen className="w-3 h-3 shrink-0" />
            <span className="truncate">{session.course.title}</span>
          </div>
        </div>

        {/* Right: role badge */}
        <div className="text-xs shrink-0">
          {isHost ? (
            <span className="bg-amber-500/20 text-amber-400 font-semibold px-2 py-1 rounded-full border border-amber-500/30">
              ● Host
            </span>
          ) : (
            <span className="bg-blue-500/20 text-blue-400 font-semibold px-2 py-1 rounded-full border border-blue-500/30">
              ● Student
            </span>
          )}
        </div>
      </div>

      {/* ── ZEGOCLOUD room ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <LiveClassRoom
          roomId={roomId}
          userId={payload.userId}
          userName={displayName}
          isHost={isHost}
        />
      </div>
    </div>
  );
}

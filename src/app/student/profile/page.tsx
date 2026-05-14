import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { Building } from "lucide-react";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { LogoutButton } from "@/components/LogoutButton";
import { StudentProfileClient } from "@/components/StudentProfileClient";
import { StaggeredMenu } from "@/components/StaggeredMenu";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export default async function StudentProfilePage() {
  // ── Auth guard ───────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  let payload: import("jose").JWTPayload;
  try {
    const verified = await jwtVerify(token, secret);
    payload = verified.payload;
  } catch {
    redirect("/login");
  }

  // ── Minimal server data (just for the navbar) ────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: payload.userId as string },
    include: { memberships: { include: { organization: true } } },
  });

  if (!user || user.memberships.length === 0) redirect("/login");

  const org = user.memberships[0].organization;

  const menuItems = [
    { label: 'Dashboard', ariaLabel: 'Go to dashboard', link: '/student' },
    { label: 'My Courses', ariaLabel: 'View your courses', link: '/student#courses' },
    { label: 'Live Sessions', ariaLabel: 'View live classes', link: '/student#live' },
    { label: 'My Profile', ariaLabel: 'View your profile', link: '/student/profile' },
  ];

  const socialItems = [
    { label: 'Discord', link: 'https://discord.com' },
    { label: 'Support', link: '/support' }
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans selection:bg-blue-100 pb-20">
      
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
        colors={['#3b82f6', '#1d4ed8']}
        accentColor="#3b82f6"
      />

      {/* Standardised Top Navbar */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Campus Hub</p>
              <h1 className="text-xl font-bold text-slate-900">{org.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold">{user.name}</p>
              <p className="text-xs text-slate-500">Student ID: {user.id.slice(0, 8)}</p>
            </div>
            <div className="flex items-center gap-1">
              <NotificationsDropdown />
              <CalendarDropdown />
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>

      {/* Client component handles everything else — realtime data, skeleton, errors */}
      <main className="max-w-7xl mx-auto p-8">
        <StudentProfileClient
          initialOrgName={org.name}
          initialUserName={user.name ?? "Student"}
        />
      </main>
    </div>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { SidebarNav, NavItem } from "@/components/SidebarNav";
import { 
  LayoutDashboard, 
  BookOpen, 
  Video, 
  UserCircle, 
  Calendar,
  MessageSquare
} from "lucide-react";

// Force dynamic — reads cookies and runs a Prisma query on every request.
export const dynamic = "force-dynamic";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  let payload;
  try {
    const verified = await jwtVerify(token, secret);
    payload = verified.payload;
  } catch {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId as string },
    include: { memberships: { include: { organization: true } } },
  });

  if (!user || user.memberships.length === 0) redirect("/login");

  const membership = user.memberships[0];
  const org = membership.organization;

  const navItems: NavItem[] = [
    { label: "Campus Hub", href: "/student", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: "Available Courses", href: "/student#courses", icon: <BookOpen className="w-4 h-4" /> },
    { label: "Live Classes", href: "/student#live", icon: <Video className="w-4 h-4" /> },
    { label: "My Profile", href: "/student/profile", icon: <UserCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="page-shell">
      <SidebarNav
        items={navItems}
        role="Student"
        orgName={org.name}
        userName={user.name ?? "Student"}
        userEmail={user.email}
      />
      <main className="page-content">
        {children}
      </main>
    </div>
  );
}

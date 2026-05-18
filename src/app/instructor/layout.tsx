import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { SidebarNav, NavItem } from "@/components/SidebarNav";
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  UserCircle, 
} from "lucide-react";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export default async function InstructorLayout({
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
  const isFounder = membership.role === "ADMIN";

  // Base nav — identical for both INSTRUCTOR and ADMIN
  const navItems: NavItem[] = [
    { label: "Dashboard",  href: "/instructor",          icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: "Courses",    href: "/instructor#courses",   icon: <BookOpen        className="w-4 h-4" /> },
    { label: "Directory",  href: "/instructor#directory", icon: <Users           className="w-4 h-4" /> },
    { label: "My Profile", href: "/instructor/profile",   icon: <UserCircle      className="w-4 h-4" /> },
  ];

  return (
    <div className="page-shell">
      <SidebarNav
        items={navItems}
        role={membership.role}
        orgName={org.name}
        userName={user.name ?? "Instructor"}
        userEmail={user.email}
      />
      <main className="page-content">
        {children}
      </main>
    </div>
  );
}

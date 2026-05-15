import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { StudentProfileClient } from "@/components/StudentProfileClient";

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
    <div className="container-page pb-20">
      {/* Client component handles everything else — realtime data, skeleton, errors */}
      <StudentProfileClient
        initialOrgName={org.name}
        initialUserName={user.name ?? "Student"}
      />
    </div>
  );
}

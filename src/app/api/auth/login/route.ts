import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cookies } from "next/headers";

// Force Node.js runtime — bcryptjs + Prisma pg adapter need native Node modules.
export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export async function POST(req: Request) {
  try {
    const { email, password, loginCode } = await req.json();

    // ── 1. Validate required fields ────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (!loginCode?.trim()) {
      return NextResponse.json({ error: "Login Code is required" }, { status: 400 });
    }

    // ── 2. Look up the user ────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });

    // ── 3. Track daily login streak (fire before password check) ──────────
    if (user) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingLogin = await prisma.notification.findFirst({
        where: { userId: user.id, type: "LOGIN", createdAt: { gte: today } },
      });

      if (!existingLogin) {
        await prisma.notification.create({
          data: { userId: user.id, message: "Daily Login", type: "LOGIN" },
        });
      }
    }

    // ── 4. Validate password ───────────────────────────────────────────────
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // ── 5. Validate login code ─────────────────────────────────────────────
    // Existing users created before this feature have loginCode = null.
    // We allow them in with any code so they are not locked out,
    // but NEW users always have a code enforced.
    if (user.loginCode !== null && user.loginCode !== loginCode.trim().toUpperCase()) {
      return NextResponse.json({ error: "Invalid Login Code" }, { status: 401 });
    }

    // ── 6. Check organisation membership ──────────────────────────────────
    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      return NextResponse.json({ error: "No organization assigned" }, { status: 403 });
    }

    // ── 7. Issue JWT ───────────────────────────────────────────────────────
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: primaryMembership.role,
      organizationId: primaryMembership.organizationId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(secret);

    (await cookies()).set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    const redirectTo =
      primaryMembership.role === "INSTRUCTOR" || primaryMembership.role === "ADMIN"
        ? "/instructor"
        : "/student";

    return NextResponse.json(
      { message: "Login successful", role: primaryMembership.role, redirect: redirectTo },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/auth/login] Error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

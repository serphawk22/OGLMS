import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cookies } from "next/headers";

// Force Node.js runtime — bcryptjs + Prisma pg adapter need native Node modules.
// Without this, Next.js 16 tries Edge runtime and the route silently 404s.
export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });

    if (user) {
      // Track daily login for streak
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingLogin = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: "LOGIN",
          createdAt: {
            gte: today,
          },
        },
      });

      if (!existingLogin) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            message: "Daily Login",
            type: "LOGIN",
          },
        });
      }
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      return NextResponse.json({ error: "No organization assigned" }, { status: 403 });
    }

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

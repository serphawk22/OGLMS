import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: true }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const primaryMembership = user.memberships[0];
    if (!primaryMembership) return NextResponse.json({ error: "No organization assigned" }, { status: 403 });

    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: primaryMembership.role,
      organizationId: primaryMembership.organizationId
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(secret);

    (await cookies()).set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    return NextResponse.json({ 
      message: "Login successful", 
      role: primaryMembership.role,
      redirect: primaryMembership.role === "INSTRUCTOR" || primaryMembership.role === "ADMIN" ? "/instructor" : "/student"
    }, { status: 200 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

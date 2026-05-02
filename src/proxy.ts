import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/student") || pathname.startsWith("/instructor")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));

    try {
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role as string;
      
      // FIXED: Allow both INSTRUCTOR and ADMIN to access the instructor floor
      if (pathname.startsWith("/instructor") && role !== "INSTRUCTOR" && role !== "ADMIN") {
        return NextResponse.redirect(new URL("/student", req.url));
      }
      
      if (pathname.startsWith("/student") && role !== "STUDENT") {
        return NextResponse.redirect(new URL("/instructor", req.url));
      }
      
      return NextResponse.next();
    } catch (err) {
      // If token is expired or tampered with, kick to login
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/instructor/:path*", "/student", "/instructor"],
};

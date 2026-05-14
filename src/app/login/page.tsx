"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, Mail, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // Safely parse JSON — if the server returned HTML (404/500 page), show a friendly error
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        throw new Error("Unable to connect to the server. Please try again.");
      }

      if (!res.ok) {
        throw new Error((data.error as string) || "Login failed. Please check your credentials.");
      }

      router.push(data.redirect as string);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ffffff] p-4 relative">
      <nav className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20 bg-white/60 backdrop-blur-md border-b border-gray-200">
        <Logo />
        <div className="space-x-4">
          <Link href="/login" className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium">Login</Link>
          <Link href="/register" className="px-4 py-2 border border-black text-black rounded-md text-sm font-medium">Register</Link>
        </div>
      </nav>
      <Card className="w-full max-w-md shadow-sm border-slate-200 mt-16">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</CardTitle>
          <CardDescription className="text-slate-500">Enter your credentials to access your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input id="email" name="email" type="email" placeholder="m@example.com" required className="pl-9 bg-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input id="password" name="password" type="password" required className="pl-9 bg-white" />
              </div>
            </div>
            <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-600">
            Don't have an account?{" "}
            <Link href="/register" className="font-medium text-blue-600 hover:underline">
              Register here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

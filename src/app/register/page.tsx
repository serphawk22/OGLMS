"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Mail, Lock, Building, Key, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"STUDENT" | "INSTRUCTOR">("STUDENT");
  const [instructorMode, setInstructorMode] = useState<"CREATE" | "JOIN">("CREATE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: role,
      organizationName: role === "INSTRUCTOR" && instructorMode === "CREATE" ? formData.get("organizationName") : undefined,
      organizationId: role === "STUDENT" || (role === "INSTRUCTOR" && instructorMode === "JOIN") ? formData.get("organizationId") : undefined,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      router.push("/login");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4">
      <Card className="w-full max-w-md shadow-sm border-slate-200">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Create an account</CardTitle>
          <CardDescription className="text-slate-500">Join the high-performance learning environment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Button 
              type="button" 
              variant={role === "STUDENT" ? "default" : "outline"} 
              className={`flex-1 ${role === "STUDENT" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600"}`} 
              onClick={() => setRole("STUDENT")}
            >
              I'm a Student
            </Button>
            <Button 
              type="button" 
              variant={role === "INSTRUCTOR" ? "default" : "outline"} 
              className={`flex-1 ${role === "INSTRUCTOR" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600"}`} 
              onClick={() => setRole("INSTRUCTOR")}
            >
              I'm an Instructor
            </Button>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md">{error}</div>}
            
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                <Input id="name" name="name" required className="pl-9 bg-white" placeholder="John Doe"/>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                <Input id="email" name="email" type="email" required className="pl-9 bg-white" placeholder="m@example.com"/>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                <Input id="password" name="password" type="password" required className="pl-9 bg-white"/>
              </div>
            </div>

            {role === "INSTRUCTOR" ? (
              <div className="space-y-4 mt-2">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-md">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className={`flex-1 h-8 text-xs ${instructorMode === "CREATE" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`} 
                    onClick={() => setInstructorMode("CREATE")}
                  >
                    Create Workspace
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className={`flex-1 h-8 text-xs ${instructorMode === "JOIN" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`} 
                    onClick={() => setInstructorMode("JOIN")}
                  >
                    Join Existing
                  </Button>
                </div>

                {instructorMode === "CREATE" ? (
                  <div className="space-y-2 p-4 bg-blue-50 border border-blue-100 rounded-md">
                    <Label htmlFor="organizationName" className="text-blue-900">New Organization Name</Label>
                    <p className="text-xs text-blue-700 mb-2">You will be the admin of this new workspace.</p>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 h-4 w-4 text-blue-400"/>
                      <Input id="organizationName" name="organizationName" required className="pl-9 bg-white border-blue-200" placeholder="e.g. Masai School"/>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-md">
                    <Label htmlFor="organizationId" className="text-slate-900">Workspace Invite Code</Label>
                    <p className="text-xs text-slate-500 mb-2">Enter the ID provided by your admin.</p>
                    <div className="relative">
                      <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                      <Input id="organizationId" name="organizationId" required className="pl-9 bg-white" placeholder="e.g. cm2x..."/>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-md mt-4">
                <Label htmlFor="organizationId" className="text-slate-900">Organization Invite Code</Label>
                <p className="text-xs text-slate-500 mb-2">Ask your instructor for your specific Org ID.</p>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                  <Input id="organizationId" name="organizationId" required className="pl-9 bg-white" placeholder="e.g. cm2x..."/>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800 mt-6" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              {loading ? "Processing..." : "Register"}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

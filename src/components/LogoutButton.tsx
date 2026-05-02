"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <Button onClick={handleLogout} variant="outline" className="text-slate-700 border-slate-300 hover:bg-slate-50">
      <LogOut className="w-4 h-4 mr-2"/>
      Sign Out
    </Button>
  );
}

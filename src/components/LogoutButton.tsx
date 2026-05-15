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
    <Button onClick={handleLogout} variant="outline" className="w-full justify-start text-zinc-700 border-zinc-200 hover:bg-zinc-50 h-8 text-sm">
      <LogOut className="w-4 h-4 mr-2"/>
      Sign Out
    </Button>
  );
}

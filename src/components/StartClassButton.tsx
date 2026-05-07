"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { sessionId: string; roomId: string; }

export function StartClassButton({ sessionId, roomId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    await fetch(`/api/live-session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ONGOING" }),
    });
    router.push(`/meet/${roomId}`);
  };

  return (
    <Button onClick={start} disabled={loading} size="sm" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4">
      <Video className="w-3 h-3 mr-1.5" />
      {loading ? "Starting…" : "Start Class"}
    </Button>
  );
}

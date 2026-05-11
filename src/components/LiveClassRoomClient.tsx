"use client";

/**
 * LiveClassRoomClient
 *
 * Thin "use client" wrapper so that `ssr: false` can be used with next/dynamic.
 * next/dynamic's `ssr: false` is only allowed inside Client Components.
 * The meet/[roomId]/page.tsx server component imports THIS wrapper instead of
 * LiveClassRoom directly, which prevents ZEGOCLOUD from running server-side
 * and fixes the "Cannot read properties of null (reading 'createSpan')" crash.
 */

import dynamic from "next/dynamic";
import { Video } from "lucide-react";

const LiveClassRoom = dynamic(() => import("@/components/LiveClassRoom"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4 text-white">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse">
          <Video className="w-8 h-8 text-blue-400" />
        </div>
        <p className="text-sm text-slate-400">Connecting to live classroom…</p>
      </div>
    </div>
  ),
});

// Re-export identical props shape so the server page stays typed
export type { } from "@/components/LiveClassRoom";

export default function LiveClassRoomClient(
  props: React.ComponentProps<typeof LiveClassRoom>
) {
  return <LiveClassRoom {...props} />;
}

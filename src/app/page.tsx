"use client";

import dynamic from 'next/dynamic';
import { HandWrittenTitle } from '@/components/ui/hand-writing-text';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

// Dynamically import the Ballpit to protect the WebGL context from SSR/HMR crashes
const Ballpit = dynamic(() => import('@/components/Ballpit'), {
  ssr: false
});

export default function Home() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#ffffff' }}>
      {/* Glassmorphic Nav */}
      <nav className="absolute top-0 w-full p-4 flex justify-between items-center z-20 bg-white/60 backdrop-blur-md border-b border-gray-200">
        <Logo />
        <div className="space-x-4">
          <Link href="/login" className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium">Login</Link>
          <Link href="/register" className="px-4 py-2 border border-black text-black rounded-md text-sm font-medium">Register</Link>
        </div>
      </nav>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
        <HandWrittenTitle
          title="Focus. Learn. Build."
          subtitle="A high-performance learning environment."
        />
      </div>

      <Ballpit
        count={40}
        gravity={0.5}
        friction={0.969}
        wallBounce={0.68}
        followCursor
        colors={["#5227FF", "#7cff67", "#ff6b6b", "#e0e0e0"]}
      />
    </div>
  );
}

"use client";

import Link from 'next/link';
import TrueFocus from './TrueFocus';

interface LogoProps {
  className?: string;
  color?: string;
  accentColor?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "", color, accentColor = "#5227FF" }) => {
  return (
    <Link href="/" className={`inline-block ${className}`}>
      <div 
        className="font-bold text-xl tracking-tight transition-colors duration-300"
        style={color ? { color } : undefined}
      >
        <TrueFocus 
          sentence="OG LMS"
          manualMode={false}
          blurAmount={3}
          borderColor={accentColor}
          glowColor={accentColor + "99"}
          animationDuration={1}
          pauseBetweenAnimations={1}
          fontSize="1.25rem"
        />
      </div>
    </Link>
  );
};

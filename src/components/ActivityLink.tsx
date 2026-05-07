"use client";

interface ActivityLinkProps {
  href: string;
  message: string;
  type: "VIDEO" | "MATERIAL";
  className?: string;
  children: React.ReactNode;
}

export function ActivityLink({ href, message, type, className, children }: ActivityLinkProps) {
  const handleClick = () => {
    // Fire-and-forget activity log — non-blocking
    fetch("/api/student/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message }),
    }).catch(() => {/* silent */});
  };

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={handleClick}>
      {children}
    </a>
  );
}

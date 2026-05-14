"use client";

interface ActivityLinkProps {
  href: string;
  message: string;
  type: "VIDEO" | "MATERIAL";
  className?: string;
  children: React.ReactNode;
  /** When set, also logs a per-material view for instructor analytics */
  materialId?: string;
}

export function ActivityLink({ href, message, type, className, children, materialId }: ActivityLinkProps) {
  const handleClick = () => {
    // Fire-and-forget general activity log
    fetch("/api/student/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message }),
    }).catch((err) => {
      console.warn("[ActivityLink] activity log failed:", err);
    });

    // Fire-and-forget per-material view tracking for instructor analytics
    if (type === "MATERIAL" && materialId) {
      fetch("/api/material-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.ok) {
            console.warn("[ActivityLink] material-views tracking returned ok=false");
          }
        })
        .catch((err) => {
          console.warn("[ActivityLink] material-views tracking failed:", err);
        });
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

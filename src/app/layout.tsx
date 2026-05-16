import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SERP LMS",
  description: "Enterprise learning management system. Focus. Learn. Build.",
  keywords: ["LMS", "learning", "education", "courses", "online learning"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="font-sans h-full"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}

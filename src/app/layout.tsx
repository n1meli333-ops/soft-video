import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura-I — Video Generator",
  description: "AI-powered YouTube video generator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

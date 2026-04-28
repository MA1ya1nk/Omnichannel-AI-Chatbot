import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omnichannel AI Dashboard",
  description: "Phase 1 web widget for unified AI brain"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

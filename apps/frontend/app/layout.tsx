import type { Metadata } from "next";
import "./globals.css";
import { AuthCookieSync } from "../components/auth-cookie-sync";

export const metadata: Metadata = {
  title: "Omnichannel AI Dashboard",
  description: "Phase 1 web widget for unified AI brain"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthCookieSync />
        {children}
      </body>
    </html>
  );
}

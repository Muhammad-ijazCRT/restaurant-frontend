import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import "@/styles/landing.css";
import "@/styles/auth.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "RodexOS",
    template: "%s | RodexOS",
  },
  description: "Vendor, restaurant, and admin portal for food service operations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${openSans.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

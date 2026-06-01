import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Paytm Craft",
  description: "Design editor workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body
        suppressHydrationWarning
        className={`${inter.className} min-h-dvh bg-chrome font-sans text-[#e6e6e6] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

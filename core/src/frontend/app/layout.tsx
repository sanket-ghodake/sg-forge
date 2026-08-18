import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "SG Forge — Admin Portal",
  description: "Enterprise administration dashboard for SG Forge",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="font-sans antialiased text-text-primary bg-background-portal min-h-screen">
        {children}
      </body>
    </html>
  );
}

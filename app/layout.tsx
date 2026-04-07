import type { Metadata } from "next";
import "./globals.css";

import Euclid from "next/font/local";
import { Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Google Fonts can be imported from remote
export const manrope = Manrope({
  subsets: ["latin"],
});

// Font files can be colocated inside of `app`
const euclid = Euclid({
  variable: "--font-euclid",
  src: [
    {
      path: "./fonts/EuclidCircularB-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-Italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  title: "QManager",
  description:
    "QManager 是一个现代化的 Web 管理界面，用于管理 Quectel 调制解调器，覆盖 APN、频段锁定、高级诊断和蜂窝设备管理等功能。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${euclid.variable} ${euclid.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "תזכורת — תרופות ואימונים",
  description: "אפליקציה לניהול תרופות, בדיקות ואימונים — עבורך ועבור היקרים לך",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "תזכורת",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2D6CDF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans text-[18px] leading-relaxed">
        {children}
      </body>
    </html>
  );
}

import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { ServiceWorkerProvider } from "@/components/providers/ServiceWorkerProvider";
import { getPublicBranding } from "@/lib/utils/public-branding";
import { getPwaIconUrl } from "@/lib/utils/branding-icons";

const inter = Inter({ subsets: ["latin"] });

// Read branding per request so the document title, app name, and apple-touch
// icon track the configured company instead of a baked-in "PropertyPro".
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBranding();
  const companyName = branding.companyName || "PropertyPro";

  return {
    applicationName: companyName,
    title: {
      default: companyName,
      template: `%s | ${companyName}`,
    },
    description:
      "Comprehensive property management solution for landlords, property managers, and tenants.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: companyName,
    },
    icons: {
      apple: getPwaIconUrl(192, branding.favicon),
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const branding = await getPublicBranding();
  return {
    themeColor: branding.primaryColor || "#2563eb",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster />
        </Providers>
        <ServiceWorkerProvider />
      </body>
    </html>
  );
}

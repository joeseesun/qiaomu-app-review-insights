import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const umamiDomain = process.env.NEXT_PUBLIC_UMAMI_DOMAIN || "appreview.qiaomu.ai";

export const metadata: Metadata = {
  metadataBase: new URL("https://appreview.qiaomu.ai"),
  title: {
    default: "乔木App评价洞察",
    template: "%s | 乔木App评价洞察",
  },
  description: "搜索任意 iOS App，生成可缓存的 App Store 用户评价洞察页，用 DeepSeek flash 挖掘痛点、机会和版本风险。",
  applicationName: "乔木App评价洞察",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "乔木App评价洞察",
    description: "把 App Store 用户评价变成可缓存、可分享、SEO/GEO 友好的产品洞察页面。",
    url: "https://appreview.qiaomu.ai/",
    siteName: "乔木App评价洞察",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "乔木App评价洞察",
    description: "用 DeepSeek flash 挖掘 App Store 用户评价里的产品信号。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className="antialiased"
      >
        {children}
        {umamiWebsiteId ? (
          <Script
            src="https://umami.qiaomu.ai/script.js"
            data-website-id={umamiWebsiteId}
            data-domains={umamiDomain}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}

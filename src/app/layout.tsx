import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YUNEEKWAYAI",
  description: "AI-powered ecommerce image generation and editing",
  icons: {
    icon: "/yuneekway.ico",
    apple: "/yuneekway.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Apply persisted theme before first paint (manual toggle)
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');t=(t==='dark'||t==='light')?t:'light';var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}

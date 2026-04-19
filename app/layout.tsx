import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({ 
  subsets: ["latin"], 
  weight: ["400", "600", "800"],
  variable: "--font-inter" 
});

export const metadata: Metadata = {
  title: "SaveHer AI — AI-Powered Women Safety Platform",
  description: "Upload harassment screenshots, get AI analysis, auto-generate cybercrime complaints. Free. Instant.",
  keywords: "women safety, AI harassment detection, cybercrime complaint, IT Act, online harassment",
  openGraph: {
    title: "SaveHer AI — AI-Powered Women Safety Platform",
    description: "Upload harassment screenshots, get AI analysis, auto-generate cybercrime complaints. Free. Instant.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased scroll-smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Pacifico&family=Great+Vibes&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} min-h-full flex flex-col`}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1b1b20",
                color: "#e4e1e9",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "#c7bfff", secondary: "#131318" },
              },
              error: {
                iconTheme: { primary: "#ff544a", secondary: "#131318" },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}

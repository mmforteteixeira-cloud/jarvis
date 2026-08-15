import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { AppProviders } from "@/components/providers";

export const metadata: Metadata = {
  title: "JARVIS",
  description: "A modular, autonomous personal AI assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppProviders>
          <div className="flex h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</main>
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "校园“万事达”——互助与众包任务平台",
  description: "基于 Next.js + Supabase 的校园互助与众包任务平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // NOTE: this is a Server Component.
  // We keep auth lookup lightweight to drive nav rendering.
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-gradient-to-b from-zinc-50 via-white to-zinc-100 text-zinc-900">
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}

async function RootShell({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.role === "admin";
  }

  return (
    <>
      <NavBar isAuthed={Boolean(user)} isAdmin={isAdmin} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200/60 bg-white/70">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-zinc-600">
          Web 开发课程设计：校园“万事达”互助与众包任务平台
        </div>
      </footer>
    </>
  );
}

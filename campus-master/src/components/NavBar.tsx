"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavPill({
  href,
  active,
  highlight,
  children,
}: {
  href: string;
  active: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const cls = active
    ? "nav-link-active"
    : highlight
      ? "inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 hover:shadow-md"
      : "nav-link";
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cls}>
      {children}
    </Link>
  );
}

export default function NavBar({
  isAuthed,
  isAdmin,
}: {
  isAuthed: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path || (path !== "/" && pathname.startsWith(path + "/"));

  if (!isAuthed) {
    return (
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-950"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-sm font-bold text-white shadow-sm">
              万
            </span>
            <span className="hidden sm:inline">校园"万事达"</span>
          </Link>
          <Link href="/auth" className="btn-primary">
            登录/注册
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-2.5 text-base font-bold tracking-tight text-slate-950"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-sm font-bold text-white shadow-sm">
            万
          </span>
          <span className="hidden lg:inline">校园"万事达"</span>
        </Link>

        {/* Primary nav */}
        <nav className="flex items-center gap-1" aria-label="主导航">
          <NavPill href="/tasks" active={isActive("/tasks")}>
            任务大厅
          </NavPill>
          <NavPill href="/tasks/new" active={isActive("/tasks/new")} highlight>
            发布任务
          </NavPill>
          <NavPill href="/dashboard" active={isActive("/dashboard")}>
            任务看板
          </NavPill>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Secondary nav */}
        <nav className="flex items-center gap-1" aria-label="辅助导航">
          <NavPill href="/notifications" active={isActive("/notifications")}>
            通知
          </NavPill>
          <NavPill href="/dashboard/account" active={isActive("/dashboard/account")}>
            账号
          </NavPill>
          {isAdmin && (
            <NavPill href="/admin" active={isActive("/admin")}>
              管理员
            </NavPill>
          )}
          <Link
            href="/auth?mode=logout"
            className="btn-ghost ml-1 text-slate-400 hover:text-slate-600"
          >
            退出
          </Link>
        </nav>
      </div>
    </header>
  );
}

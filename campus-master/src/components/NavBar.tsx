"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar({
    isAuthed,
    isAdmin,
}: {
    isAuthed: boolean;
    isAdmin: boolean;
}) {
    const pathname = usePathname();

    const isTasksNew = pathname === "/tasks/new";
    const isTasks = pathname === "/tasks" || (pathname.startsWith("/tasks/") && !isTasksNew);
    const isNotifications = pathname === "/notifications";
    const isDashboard = pathname === "/dashboard";
    const isAdminPage = pathname === "/admin";
    const isAuthPage = pathname.startsWith("/auth");

    function pillClass(active: boolean) {
        return active
            ? "rounded-full bg-zinc-900 px-3 py-1.5 font-medium text-white shadow-sm"
            : "rounded-full px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900";
    }

    function ctaClass(active: boolean) {
        return active
            ? "rounded-full bg-zinc-900 px-3 py-1.5 font-medium text-white shadow-sm"
            : "rounded-full border border-zinc-200/70 bg-white/80 px-3 py-1.5 font-medium text-zinc-900 hover:bg-white";
    }

    return (
        <header className="border-b border-zinc-200/60 bg-white/70 backdrop-blur">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 font-semibold tracking-tight text-zinc-900"
                >
                    <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-400 via-blue-400 to-emerald-400" />
                    校园“万事达”
                </Link>
                <nav className="flex items-center gap-3 text-sm">
                    {isAuthed ? (
                        <>
                            <Link
                                href="/tasks"
                                aria-current={isTasks ? "page" : undefined}
                                className={pillClass(isTasks)}
                            >
                                任务大厅
                            </Link>
                            <Link
                                href="/tasks/new"
                                aria-current={isTasksNew ? "page" : undefined}
                                className={ctaClass(isTasksNew)}
                            >
                                发布任务
                            </Link>
                            <Link
                                href="/notifications"
                                aria-current={isNotifications ? "page" : undefined}
                                className={pillClass(isNotifications)}
                            >
                                通知
                            </Link>
                            <Link
                                href="/dashboard"
                                aria-current={isDashboard ? "page" : undefined}
                                className={pillClass(isDashboard)}
                            >
                                我的看板
                            </Link>
                            {isAdmin ? (
                                <Link
                                    href="/admin"
                                    aria-current={isAdminPage ? "page" : undefined}
                                    className={pillClass(isAdminPage)}
                                >
                                    管理员
                                </Link>
                            ) : null}
                            <Link
                                href="/auth?mode=logout"
                                className={pillClass(isAuthPage)}
                            >
                                退出
                            </Link>
                        </>
                    ) : (
                        <Link
                            href="/auth"
                            aria-current={isAuthPage ? "page" : undefined}
                            className={ctaClass(isAuthPage)}
                        >
                            登录/注册
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    );
}

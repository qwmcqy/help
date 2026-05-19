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
            ? "rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white shadow-sm"
            : "rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950";
    }

    function ctaClass(active: boolean) {
        return active
            ? "rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white shadow-sm"
            : "rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";
    }

    return (
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-base font-semibold tracking-normal text-slate-950"
                >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-sm font-bold text-white shadow-sm">
                        万
                    </span>
                    <span>校园“万事达”</span>
                </Link>
                <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 text-sm lg:mx-0 lg:overflow-visible lg:pb-0">
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

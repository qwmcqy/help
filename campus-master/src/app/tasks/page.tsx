import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type TaskListItem = {
    id: string;
    title: string;
    category: string | null;
    reward_cents: number;
    status: string;
    created_at: string;
};

function labelStatus(s: string) {
    switch (s) {
        case "open":
            return "待接单";
        case "in_progress":
            return "进行中";
        case "awaiting_acceptance":
            return "待验收";
        case "completed":
            return "已完成";
        case "canceled":
            return "已取消";
        case "disputed":
            return "争议中";
        default:
            return s;
    }
}

function statusBadgeClass(status: string) {
    switch (status) {
        case "open":
            return "border-amber-200 bg-amber-50 text-amber-900";
        case "in_progress":
            return "border-blue-200 bg-blue-50 text-blue-900";
        case "awaiting_acceptance":
            return "border-violet-200 bg-violet-50 text-violet-900";
        case "completed":
            return "border-emerald-200 bg-emerald-50 text-emerald-900";
        case "canceled":
            return "border-zinc-200 bg-zinc-50 text-zinc-600";
        case "disputed":
            return "border-rose-200 bg-rose-50 text-rose-900";
        default:
            return "border-zinc-200 bg-white text-zinc-700";
    }
}

function statusAccentClass(status: string) {
    switch (status) {
        case "open":
            return "bg-gradient-to-b from-amber-400 to-amber-600";
        case "in_progress":
            return "bg-gradient-to-b from-blue-400 to-blue-600";
        case "awaiting_acceptance":
            return "bg-gradient-to-b from-violet-400 to-violet-600";
        case "completed":
            return "bg-gradient-to-b from-emerald-400 to-emerald-600";
        case "disputed":
            return "bg-gradient-to-b from-rose-400 to-rose-600";
        case "canceled":
        default:
            return "bg-gradient-to-b from-zinc-300 to-zinc-500";
    }
}

export default async function TasksPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; category?: string }>;
}) {
    const sp = await searchParams;
    const status = sp.status || "";
    const category = sp.category || "";

    const supabase = await createSupabaseServerClient();

    let q = supabase
        .from("tasks")
        .select("id,title,category,reward_cents,status,created_at")
        .order("created_at", { ascending: false })
        .limit(50);

    if (status) q = q.eq("status", status);
    if (category) q = q.ilike("category", `%${category}%`);

    const { data, error } = await q;
    const tasks = (data ?? []) as TaskListItem[];

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
            <div className="overflow-hidden rounded-2xl bg-white/70 shadow-sm ring-1 ring-zinc-200/60">
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-blue-400 to-emerald-400" />
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">任务大厅</h1>
                        <p className="mt-1 text-sm text-zinc-600">
                            全站任务池（最多展示 50 条）
                        </p>
                    </div>
                    <Link
                        href="/tasks/new"
                        className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm"
                    >
                        发布任务
                    </Link>
                </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl bg-white/70 shadow-sm ring-1 ring-zinc-200/60">
                <div className="h-1.5 w-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-400" />
                <form className="grid gap-3 p-4 sm:grid-cols-3 sm:items-end">
                    <label className="block text-sm">
                        <div className="text-zinc-700">状态</div>
                        <select
                            name="status"
                            defaultValue={status}
                            className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                        >
                            <option value="">全部</option>
                            <option value="open">待接单</option>
                            <option value="in_progress">进行中</option>
                            <option value="awaiting_acceptance">待验收</option>
                            <option value="completed">已完成</option>
                            <option value="canceled">已取消</option>
                            <option value="disputed">争议中</option>
                        </select>
                    </label>
                    <label className="block text-sm">
                        <div className="text-zinc-700">分类</div>
                        <input
                            name="category"
                            defaultValue={category}
                            placeholder="如：快递/代买/搬运"
                            className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                        />
                    </label>
                    <button className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm">
                        筛选
                    </button>
                </form>
            </div>

            {error ? (
                <p className="mt-6 text-sm text-red-600">{error.message}</p>
            ) : null}

            <ul className="mt-6 space-y-3">
                {tasks.map((t) => (
                    <li
                        key={t.id}
                        className="relative overflow-hidden rounded-2xl bg-white/70 p-4 pl-5 shadow-sm ring-1 ring-zinc-200/60"
                    >
                        <div
                            className={`absolute inset-y-0 left-0 w-1.5 ${statusAccentClass(
                                t.status,
                            )}`}
                        />
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <Link
                                    href={`/tasks/${t.id}`}
                                    className="block truncate text-base font-semibold text-zinc-900"
                                >
                                    {t.title}
                                </Link>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${statusBadgeClass(
                                            t.status,
                                        )}`}
                                    >
                                        {labelStatus(t.status)}
                                    </span>
                                    {t.category ? (
                                        <span className="inline-flex items-center rounded-full border border-zinc-200/70 bg-white/80 px-2.5 py-1 text-xs text-zinc-700">
                                            {t.category}
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            <div className="shrink-0 text-right">
                                <div className="text-lg font-semibold text-zinc-900">
                                    ￥{(t.reward_cents / 100).toFixed(2)}
                                </div>
                                <Link
                                    href={`/tasks/${t.id}`}
                                    className="mt-2 inline-flex items-center justify-center rounded-full border border-zinc-200/70 bg-white/80 px-3 py-1.5 text-sm font-medium"
                                >
                                    详情
                                </Link>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

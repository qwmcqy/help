import Link from "next/link";
import { redirect } from "next/navigation";
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
            return "border-amber-200 bg-amber-50 text-amber-800";
        case "in_progress":
            return "border-sky-200 bg-sky-50 text-sky-800";
        case "awaiting_acceptance":
            return "border-indigo-200 bg-indigo-50 text-indigo-800";
        case "completed":
            return "border-teal-200 bg-teal-50 text-teal-800";
        case "canceled":
            return "border-slate-200 bg-slate-50 text-slate-600";
        case "disputed":
            return "border-rose-200 bg-rose-50 text-rose-800";
        default:
            return "border-slate-200 bg-white text-slate-700";
    }
}

function statusAccentClass(status: string) {
    switch (status) {
        case "open":
            return "bg-amber-300";
        case "in_progress":
            return "bg-sky-300";
        case "awaiting_acceptance":
            return "bg-indigo-300";
        case "completed":
            return "bg-teal-300";
        case "disputed":
            return "bg-rose-300";
        case "canceled":
        default:
            return "bg-slate-300";
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
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        const nextParams = new URLSearchParams();
        if (status) nextParams.set("status", status);
        if (category) nextParams.set("category", category);
        const next = nextParams.size ? `/tasks?${nextParams.toString()}` : "/tasks";
        redirect(`/auth?next=${encodeURIComponent(next)}`);
    }

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
        <div className="app-shell">
            <section className="page-card p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="eyebrow">Task market</div>
                        <h1 className="page-title mt-2">任务大厅</h1>
                        <p className="page-subtitle">
                            全站任务池（最多展示 50 条）
                        </p>
                    </div>
                    <Link
                        href="/tasks/new"
                        className="btn-primary"
                    >
                        发布任务
                    </Link>
                </div>
            </section>

            <section className="section-card mt-5 p-4">
                <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="field-label">
                        状态
                        <select
                            name="status"
                            defaultValue={status}
                            className="field-control"
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
                    <label className="field-label">
                        分类
                        <input
                            name="category"
                            defaultValue={category}
                            placeholder="如：快递/代买/搬运"
                            className="field-control"
                        />
                    </label>
                    <button className="btn-primary">
                        筛选
                    </button>
                </form>
            </section>

            {error ? (
                <p className="mt-6 text-sm text-red-600">{error.message}</p>
            ) : null}

            <ul className="mt-6 space-y-3">
                {tasks.map((t) => (
                    <li
                        key={t.id}
                        className="list-row pl-5"
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
                                    className="block truncate text-base font-semibold text-slate-950"
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
                                        <span className="status-pill border-slate-200 bg-slate-50 text-slate-600">
                                            {t.category}
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            <div className="shrink-0 text-right">
                                <div className="text-lg font-semibold text-slate-950">
                                    ￥{(t.reward_cents / 100).toFixed(2)}
                                </div>
                                <Link
                                    href={`/tasks/${t.id}`}
                                    className="btn-secondary mt-2 px-3 py-1.5"
                                >
                                    详情
                                </Link>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {!error && tasks.length === 0 ? (
                <div className="section-card mt-6 p-6 text-center">
                    <div className="text-base font-semibold text-slate-950">
                        没有找到符合条件的任务
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                        可以调整筛选条件，或者发布一个新的任务。
                    </p>
                    <div className="mt-4 flex justify-center gap-3">
                        <Link href="/tasks" className="btn-secondary">
                            清空筛选
                        </Link>
                        <Link href="/tasks/new" className="btn-primary">
                            发布任务
                        </Link>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

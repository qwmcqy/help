import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoleSwitchForm, TopUpForm } from "./DashboardForms";

type TaskListItem = {
    id: string;
    title: string;
    status: string;
    reward_cents: number;
    created_at: string;
};

const roleLabels: Record<string, string> = {
    requester: "需求方（requester）",
    helper: "接单方（helper）",
    admin: "管理员（admin）",
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

export default async function DashboardPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth?next=/dashboard");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("display_name,role,credit_score")
        .eq("id", user.id)
        .maybeSingle();

    const { data: account } = await supabase
        .from("accounts")
        .select("available_cents,frozen_cents")
        .eq("user_id", user.id)
        .maybeSingle();

    const { data: myRequester } = await supabase
        .from("tasks")
        .select("id,title,status,reward_cents,created_at")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

    const { data: myHelper } = await supabase
        .from("tasks")
        .select("id,title,status,reward_cents,created_at")
        .eq("helper_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

    const requesterTasks = (myRequester ?? []) as TaskListItem[];
    const helperTasks = (myHelper ?? []) as TaskListItem[];

    return (
        <div className="app-shell">
            <section className="page-card p-5 sm:p-6">
                <div className="eyebrow">Dashboard</div>
                <h1 className="page-title mt-2">我的看板</h1>
                <p className="page-subtitle">账号信息、余额与我的任务汇总</p>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="section-card p-5">
                    <div className="text-sm font-semibold text-slate-900">账号</div>
                    <div className="mt-3 space-y-3 text-sm text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">昵称</span>
                            <span className="font-medium text-slate-950">
                                {profile?.display_name ?? "未设置"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">角色</span>
                            <span className="status-pill border-teal-200 bg-teal-50 text-teal-800">
                                {profile?.role
                                    ? roleLabels[profile.role] ?? profile.role
                                    : "未知"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">信用分</span>
                            <span className="font-medium text-slate-950">
                                {profile?.credit_score ?? 100}
                            </span>
                        </div>
                    </div>

                    {profile?.role !== "admin" ? (
                        <>
                            <RoleSwitchForm currentRole={profile?.role} />
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                说明：角色用于演示 RBAC，切换后会影响“发布/接单”等操作权限。
                            </p>
                        </>
                    ) : (
                        <p className="mt-4 text-xs text-slate-500">
                            管理员账号不提供角色切换。
                        </p>
                    )}
                </div>

                <div className="section-card p-5">
                    <div className="text-sm font-semibold text-slate-900">余额</div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-teal-50 p-3">
                            <div className="text-xs text-teal-700">可用</div>
                            <div className="mt-1 text-lg font-semibold text-slate-950">
                                ￥{((account?.available_cents ?? 0) / 100).toFixed(2)}
                            </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">冻结</div>
                            <div className="mt-1 text-lg font-semibold text-slate-950">
                                ￥{((account?.frozen_cents ?? 0) / 100).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <TopUpForm />
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                        课程设计演示用：不对接真实支付，仅用于资金托管流程验证。
                    </p>
                </div>

                <div className="section-card p-5">
                    <div className="text-sm font-semibold text-slate-900">快捷入口</div>
                    <div className="mt-3 flex flex-col gap-2 text-sm">
                        <Link href="/tasks" className="btn-secondary justify-start">
                            去任务大厅
                        </Link>
                        <Link href="/tasks/new" className="btn-primary justify-start">
                            发布任务
                        </Link>
                    </div>
                </div>
            </section>

            <section className="mt-10 grid gap-6 md:grid-cols-2">
                <div>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">我发布的任务</h2>
                        <Link href="/tasks" className="soft-link text-sm">
                            查看全部
                        </Link>
                    </div>
                    <ul className="mt-3 space-y-2">
                        {requesterTasks.map((t) => (
                            <li
                                key={t.id}
                                className="list-row p-3 pl-5"
                            >
                                <div
                                    className={`absolute inset-y-0 left-0 w-1.5 ${statusAccentClass(
                                        t.status,
                                    )}`}
                                />
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Link href={`/tasks/${t.id}`} className="block truncate font-medium">
                                            {t.title}
                                        </Link>
                                        <div className="mt-2">
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${statusBadgeClass(
                                                    t.status,
                                                )}`}
                                            >
                                                {labelStatus(t.status)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-sm text-slate-500">报酬</div>
                                        <div className="text-base font-semibold text-slate-950">
                                            ￥{(t.reward_cents / 100).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {!requesterTasks.length ? (
                            <li className="section-card p-3 text-sm text-slate-500">
                                暂无发布记录
                            </li>
                        ) : null}
                    </ul>
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">我接到的任务</h2>
                        <Link href="/tasks" className="soft-link text-sm">
                            查看全部
                        </Link>
                    </div>
                    <ul className="mt-3 space-y-2">
                        {helperTasks.map((t) => (
                            <li
                                key={t.id}
                                className="list-row p-3 pl-5"
                            >
                                <div
                                    className={`absolute inset-y-0 left-0 w-1.5 ${statusAccentClass(
                                        t.status,
                                    )}`}
                                />
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Link href={`/tasks/${t.id}`} className="block truncate font-medium">
                                            {t.title}
                                        </Link>
                                        <div className="mt-2">
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${statusBadgeClass(
                                                    t.status,
                                                )}`}
                                            >
                                                {labelStatus(t.status)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-sm text-slate-500">报酬</div>
                                        <div className="text-base font-semibold text-slate-950">
                                            ￥{(t.reward_cents / 100).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {!helperTasks.length ? (
                            <li className="section-card p-3 text-sm text-slate-500">
                                暂无接单记录
                            </li>
                        ) : null}
                    </ul>
                </div>
            </section>
        </div>
    );
}

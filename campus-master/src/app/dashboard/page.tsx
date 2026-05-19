import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { topUpAction } from "@/app/actions/taskActions";
import { updateRoleAction } from "@/app/actions/profileActions";

type TaskListItem = {
    id: string;
    title: string;
    status: string;
    reward_cents: number;
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
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
            <div className="overflow-hidden rounded-2xl bg-white/70 shadow-sm ring-1 ring-zinc-200/60">
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400" />
                <div className="p-5">
                    <h1 className="text-2xl font-semibold tracking-tight">我的看板</h1>
                    <p className="mt-1 text-sm text-zinc-600">账号信息、余额与我的任务汇总</p>
                </div>
            </div>

            <section className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="overflow-hidden rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                    <div className="-mx-4 -mt-4 mb-3 h-1.5 bg-gradient-to-r from-amber-400 via-rose-400 to-violet-400" />
                    <div className="text-sm font-medium">账号</div>
                    <div className="mt-2 space-y-1 text-sm text-zinc-700">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-zinc-600">昵称</span>
                            <span className="font-medium text-zinc-900">
                                {profile?.display_name ?? "未设置"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-zinc-600">角色</span>
                            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700">
                                {profile?.role ?? "未知"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-zinc-600">信用分</span>
                            <span className="font-medium text-zinc-900">
                                {profile?.credit_score ?? 100}
                            </span>
                        </div>
                    </div>

                    {profile?.role !== "admin" ? (
                        <>
                            <form action={updateRoleAction} className="mt-4 flex items-center gap-2">
                                <select
                                    name="role"
                                    defaultValue={profile?.role ?? "requester"}
                                    className="rounded-lg border border-zinc-200/70 bg-white/80 px-2 py-1 text-sm"
                                >
                                    <option value="requester">需求方（发布任务）</option>
                                    <option value="helper">接单方（接任务）</option>
                                </select>
                                <button className="rounded-full border border-zinc-200/70 bg-white/80 px-3 py-1 text-sm font-medium">
                                    切换角色
                                </button>
                            </form>
                            <p className="mt-2 text-xs text-zinc-600">
                                说明：角色用于演示 RBAC，切换后会影响“发布/接单”等操作权限。
                            </p>
                        </>
                    ) : (
                        <p className="mt-4 text-xs text-zinc-600">
                            管理员账号不提供角色切换。
                        </p>
                    )}
                </div>

                <div className="overflow-hidden rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                    <div className="-mx-4 -mt-4 mb-3 h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400" />
                    <div className="text-sm font-medium">余额</div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3">
                            <div className="text-xs text-zinc-600">可用</div>
                            <div className="mt-1 text-lg font-semibold text-zinc-900">
                                ￥{((account?.available_cents ?? 0) / 100).toFixed(2)}
                            </div>
                        </div>
                        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3">
                            <div className="text-xs text-zinc-600">冻结</div>
                            <div className="mt-1 text-lg font-semibold text-zinc-900">
                                ￥{((account?.frozen_cents ?? 0) / 100).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <form action={topUpAction} className="mt-4 flex gap-2">
                        <input
                            name="amountCents"
                            type="number"
                            min={1}
                            className="w-32 rounded-lg border border-zinc-200/70 bg-white/80 px-2 py-1 text-sm"
                            placeholder="充值(分)"
                            required
                        />
                        <button className="rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium text-white shadow-sm">
                            模拟充值
                        </button>
                    </form>
                    <p className="mt-2 text-xs text-zinc-600">
                        课程设计演示用：不对接真实支付，仅用于资金托管流程验证。
                    </p>
                </div>

                <div className="overflow-hidden rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                    <div className="-mx-4 -mt-4 mb-3 h-1.5 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400" />
                    <div className="text-sm font-medium">快捷入口</div>
                    <div className="mt-3 flex flex-col gap-2 text-sm">
                        <Link href="/tasks" className="rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 font-medium">
                            去任务大厅
                        </Link>
                        <Link href="/tasks/new" className="rounded-xl bg-zinc-900 px-3 py-2 font-medium text-white shadow-sm">
                            发布任务
                        </Link>
                    </div>
                </div>
            </section>

            <section className="mt-10 grid gap-6 md:grid-cols-2">
                <div>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">我发布的任务</h2>
                        <Link href="/tasks" className="text-sm underline">
                            查看全部
                        </Link>
                    </div>
                    <ul className="mt-3 space-y-2">
                        {requesterTasks.map((t) => (
                            <li
                                key={t.id}
                                className="relative overflow-hidden rounded-2xl bg-white/70 p-3 pl-5 shadow-sm ring-1 ring-zinc-200/60"
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
                                        <div className="text-sm text-zinc-600">报酬</div>
                                        <div className="text-base font-semibold text-zinc-900">
                                            ￥{(t.reward_cents / 100).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {!requesterTasks.length ? (
                            <li className="rounded-2xl bg-white/70 p-3 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200/60">
                                暂无发布记录
                            </li>
                        ) : null}
                    </ul>
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">我接到的任务</h2>
                        <Link href="/tasks" className="text-sm underline">
                            查看全部
                        </Link>
                    </div>
                    <ul className="mt-3 space-y-2">
                        {helperTasks.map((t) => (
                            <li
                                key={t.id}
                                className="relative overflow-hidden rounded-2xl bg-white/70 p-3 pl-5 shadow-sm ring-1 ring-zinc-200/60"
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
                                        <div className="text-sm text-zinc-600">报酬</div>
                                        <div className="text-base font-semibold text-zinc-900">
                                            ￥{(t.reward_cents / 100).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {!helperTasks.length ? (
                            <li className="rounded-2xl bg-white/70 p-3 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200/60">
                                暂无接单记录
                            </li>
                        ) : null}
                    </ul>
                </div>
            </section>
        </div>
    );
}

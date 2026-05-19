import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoleSwitchForm, TopUpForm } from "../DashboardForms";

type LedgerEntry = {
    id: string;
    direction: string;
    amount_cents: number;
    reference_type: string;
    note: string | null;
    created_at: string;
};

const roleLabels: Record<string, string> = {
    requester: "需求方（requester）",
    helper: "接单方（helper）",
    admin: "管理员（admin）",
};

function directionLabel(direction: string) {
    switch (direction) {
        case "in":
            return "入账";
        case "out":
            return "支出";
        case "freeze":
            return "冻结";
        case "unfreeze":
            return "解冻";
        default:
            return direction;
    }
}

function directionClass(direction: string) {
    switch (direction) {
        case "in":
        case "unfreeze":
            return "border-teal-200 bg-teal-50 text-teal-800";
        case "out":
        case "freeze":
            return "border-amber-200 bg-amber-50 text-amber-800";
        default:
            return "border-slate-200 bg-slate-50 text-slate-600";
    }
}

function formatTime(value: string) {
    return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export default async function AccountPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth?next=/dashboard/account");
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

    const { data: ledger } = await supabase
        .from("ledger_entries")
        .select("id,direction,amount_cents,reference_type,note,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

    const entries = (ledger ?? []) as LedgerEntry[];

    return (
        <div className="app-shell">
            <section className="page-card p-5 sm:p-6">
                <div className="eyebrow">Account</div>
                <h1 className="page-title mt-2">账号与角色</h1>
                <p className="page-subtitle">
                    这里集中处理身份切换、信用分、余额充值和资金流水；任务推进回到看板处理。
                </p>
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="section-card p-5">
                    <div className="text-sm font-semibold text-slate-900">个人身份</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">昵称</span>
                            <span className="font-medium text-slate-950">
                                {profile?.display_name ?? "未设置"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">当前角色</span>
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
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                                角色会影响“发布任务”和“接单”的可操作范围；管理员账号不提供角色切换。
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
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-teal-50 p-4">
                            <div className="text-xs text-teal-700">可用余额</div>
                            <div className="mt-1 text-2xl font-semibold text-slate-950">
                                ￥{((account?.available_cents ?? 0) / 100).toFixed(2)}
                            </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-4">
                            <div className="text-xs text-slate-500">冻结金额</div>
                            <div className="mt-1 text-2xl font-semibold text-slate-950">
                                ￥{((account?.frozen_cents ?? 0) / 100).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <TopUpForm />
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                        课程设计演示用途：充值为模拟入账，不对接真实支付。
                    </p>
                </div>
            </section>

            <section className="mt-6 section-card p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-950">最近资金流水</h2>
                        <p className="text-sm text-slate-500">
                            发布、冻结、解冻和完成支付会在这里留下记录。
                        </p>
                    </div>
                    <Link href="/dashboard" className="soft-link text-sm">
                        返回任务看板
                    </Link>
                </div>

                <ul className="mt-4 divide-y divide-slate-100">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${directionClass(
                                            entry.direction,
                                        )}`}
                                    >
                                        {directionLabel(entry.direction)}
                                    </span>
                                    <span className="text-sm font-medium text-slate-950">
                                        {entry.note ?? entry.reference_type}
                                    </span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                    {formatTime(entry.created_at)} · {entry.reference_type}
                                </div>
                            </div>
                            <div className="text-base font-semibold text-slate-950">
                                ￥{(entry.amount_cents / 100).toFixed(2)}
                            </div>
                        </li>
                    ))}
                </ul>

                {entries.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                        暂无资金流水
                    </div>
                ) : null}
            </section>
        </div>
    );
}

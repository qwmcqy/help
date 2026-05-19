import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminResolveForm from "./AdminResolveForm";

type TaskSummary = {
    id: string;
    title: string;
    status: string;
    reward_cents: number;
    created_at: string;
};

type HighRiskAudit = {
    task_id: string;
    risk_level: string;
    reason: string | null;
    updated_at: string;
};

type DisputeSummary = {
    task_id: string;
    reason: string | null;
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

export default async function AdminPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth?next=/admin");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (profile?.role !== "admin") {
        return (
            <div className="app-shell max-w-3xl">
                <h1 className="page-title">管理员</h1>
                <p className="page-subtitle">无权限访问。</p>
            </div>
        );
    }

    const { data: tasks } = await supabase
        .from("tasks")
        .select("id,title,status,reward_cents,created_at")
        .eq("status", "disputed")
        .order("created_at", { ascending: false })
        .limit(50);

    const { data: highRisk } = await supabase
        .from("ai_audits")
        .select("task_id,risk_level,reason,updated_at")
        .eq("risk_level", "high")
        .order("updated_at", { ascending: false })
        .limit(50);

    const highRiskRows = (highRisk ?? []) as HighRiskAudit[];
    const highRiskTaskIds = highRiskRows.map((r) => r.task_id);
    const { data: highRiskTasks } = highRiskTaskIds.length
        ? await supabase
            .from("tasks")
            .select("id,title,reward_cents,status,created_at")
            .in("id", highRiskTaskIds)
        : { data: [] as TaskSummary[] };

    const highRiskTaskRows = (highRiskTasks ?? []) as TaskSummary[];
    const highRiskTaskMap = new Map(
        highRiskTaskRows.map((t) => [t.id, t]),
    );

    const { data: disputes } = await supabase
        .from("disputes")
        .select("task_id,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(50);

    const disputeRows = (disputes ?? []) as DisputeSummary[];
    const disputeMap = new Map(
        disputeRows.map((d) => [d.task_id, d]),
    );
    const taskRows = (tasks ?? []) as TaskSummary[];

    return (
        <div className="app-shell">
            <section className="page-card p-5 sm:p-6">
                <div className="eyebrow">Admin</div>
                <h1 className="page-title mt-2">管理员：争议处理</h1>
                <p className="page-subtitle">对“争议中”的任务进行裁决：完成支付或退款回滚。</p>
            </section>

            <ul className="mt-6 space-y-3">
                {taskRows.map((t) => (
                    <li key={t.id} className="list-row pl-5">
                        <div className="absolute inset-y-0 left-0 w-1.5 bg-rose-300" />
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <Link href={`/tasks/${t.id}`} className="block truncate font-semibold">
                                    {t.title}
                                </Link>
                                <div className="mt-2 text-sm text-slate-600">
                                    <span>报酬</span>{" "}
                                    <span className="font-semibold text-slate-950">￥{(t.reward_cents / 100).toFixed(2)}</span>
                                </div>
                                {disputeMap.get(t.id)?.reason ? (
                                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                        <div className="text-xs font-semibold text-slate-500">争议原因</div>
                                        <div className="mt-1 whitespace-pre-wrap">
                                            {disputeMap.get(t.id)?.reason}
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <AdminResolveForm taskId={t.id} />
                        </div>
                    </li>
                ))}
            </ul>

            {!taskRows.length ? (
                <div className="section-card mt-6 p-5 text-sm text-slate-500">
                    当前没有待处理的争议任务。
                </div>
            ) : null}

            <section className="section-card mt-10 p-5">
                <h2 className="text-lg font-semibold text-slate-950">AI 高风险提示</h2>
                <p className="mt-1 text-sm text-slate-600">
                    AI 审核仅做辅助，不直接封禁；建议结合人工复核。
                </p>
            </section>
            <ul className="mt-4 space-y-3">
                {highRiskRows.map((r) => {
                    const t = highRiskTaskMap.get(r.task_id);
                    return (
                        <li key={r.task_id} className="list-row pl-5">
                            <div className="absolute inset-y-0 left-0 w-1.5 bg-rose-300" />
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <Link href={`/tasks/${r.task_id}`} className="block truncate font-semibold">
                                        {t?.title ?? r.task_id}
                                    </Link>
                                    <div className="mt-1 text-xs text-slate-500">
                                        风险：{r.risk_level}
                                        {t?.status ? `；状态：${labelStatus(t.status)}` : ""}
                                        {typeof t?.reward_cents === "number"
                                            ? `；报酬：￥${(t.reward_cents / 100).toFixed(2)}`
                                            : ""}
                                    </div>
                                    {r.reason ? (
                                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                            <div className="text-xs font-semibold text-slate-500">原因</div>
                                            <div className="mt-1 whitespace-pre-wrap">{r.reason}</div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {!highRiskRows.length ? (
                <div className="section-card mt-4 p-5 text-sm text-slate-500">
                    当前没有 AI 高风险提示。
                </div>
            ) : null}
        </div>
    );
}

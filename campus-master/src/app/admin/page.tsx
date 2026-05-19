import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminResolveDisputeAction } from "@/app/actions/taskActions";

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
            <div className="mx-auto w-full max-w-3xl px-4 py-8">
                <h1 className="text-2xl font-semibold tracking-tight">管理员</h1>
                <p className="mt-2 text-sm text-zinc-600">无权限访问。</p>
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
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
            <div className="overflow-hidden rounded-2xl bg-white/70 p-5 shadow-sm ring-1 ring-zinc-200/60">
                <div className="-mx-5 -mt-5 mb-4 h-1.5 bg-gradient-to-r from-rose-400 via-amber-400 to-violet-400" />
                <h1 className="text-2xl font-semibold tracking-tight">管理员：争议处理</h1>
                <p className="mt-1 text-sm text-zinc-600">对“争议中”的任务进行裁决：完成支付或退款回滚。</p>
            </div>

            <ul className="mt-6 space-y-3">
                {taskRows.map((t) => (
                    <li key={t.id} className="relative overflow-hidden rounded-2xl bg-white/70 p-4 pl-5 shadow-sm ring-1 ring-zinc-200/60">
                        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-rose-400 to-rose-600" />
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <Link href={`/tasks/${t.id}`} className="block truncate font-semibold">
                                    {t.title}
                                </Link>
                                <div className="mt-2 text-sm text-zinc-700">
                                    <span className="text-zinc-600">报酬</span>{" "}
                                    <span className="font-semibold text-zinc-900">￥{(t.reward_cents / 100).toFixed(2)}</span>
                                </div>
                                {disputeMap.get(t.id)?.reason ? (
                                    <div className="mt-3 rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                                        <div className="text-xs font-medium text-zinc-600">争议原因</div>
                                        <div className="mt-1 whitespace-pre-wrap">
                                            {disputeMap.get(t.id)?.reason}
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <form action={adminResolveDisputeAction} className="shrink-0">
                                <input type="hidden" name="taskId" value={t.id} />
                                <div className="flex flex-col gap-2">
                                    <button
                                        name="resolution"
                                        value="complete"
                                        className="rounded-full bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm"
                                    >
                                        裁决：完成并支付
                                    </button>
                                    <button
                                        name="resolution"
                                        value="refund"
                                        className="rounded-full border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm font-medium"
                                    >
                                        裁决：退款并回到待接单
                                    </button>
                                </div>
                            </form>
                        </div>
                    </li>
                ))}
            </ul>

            <div className="mt-10 overflow-hidden rounded-2xl bg-white/70 p-5 shadow-sm ring-1 ring-zinc-200/60">
                <div className="-mx-5 -mt-5 mb-4 h-1.5 bg-gradient-to-r from-red-400 via-rose-400 to-amber-400" />
                <h2 className="text-lg font-semibold">AI 高风险提示</h2>
                <p className="mt-1 text-sm text-zinc-600">
                    AI 审核仅做辅助，不直接封禁；建议结合人工复核。
                </p>
            </div>
            <ul className="mt-4 space-y-3">
                {highRiskRows.map((r) => {
                    const t = highRiskTaskMap.get(r.task_id);
                    return (
                        <li key={r.task_id} className="relative overflow-hidden rounded-2xl bg-white/70 p-4 pl-5 shadow-sm ring-1 ring-zinc-200/60">
                            <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-red-400 to-red-600" />
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <Link href={`/tasks/${r.task_id}`} className="block truncate font-semibold">
                                        {t?.title ?? r.task_id}
                                    </Link>
                                    <div className="mt-1 text-xs text-zinc-600">
                                        风险：{r.risk_level}
                                        {t?.status ? `；状态：${t.status}` : ""}
                                        {typeof t?.reward_cents === "number"
                                            ? `；报酬：￥${(t.reward_cents / 100).toFixed(2)}`
                                            : ""}
                                    </div>
                                    {r.reason ? (
                                        <div className="mt-3 rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                                            <div className="text-xs font-medium text-zinc-600">原因</div>
                                            <div className="mt-1 whitespace-pre-wrap">{r.reason}</div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

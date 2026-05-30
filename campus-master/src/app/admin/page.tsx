import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminResolveForm from "./AdminResolveForm";
import {
  labelStatus,
  statusBadgeClass,
} from "@/lib/taskDisplay";

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
  raw: unknown;
  updated_at: string;
};

type DisputeSummary = {
  task_id: string;
  reason: string | null;
  created_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function auditRaw(raw: unknown) {
  if (!isRecord(raw) || !isRecord(raw.audit)) return null;
  return raw.audit;
}

function actionLabel(action: unknown) {
  switch (action) {
    case "reject":
      return "建议拒绝/下架";
    case "review":
      return "建议人工复核";
    case "allow":
      return "建议通过";
    default:
      return "建议人工复核";
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
      <div className="app-shell max-w-lg">
        <div className="page-card p-6 text-center">
          <div className="text-lg font-semibold text-slate-950">无权限</div>
          <p className="mt-2 text-sm text-slate-500">仅管理员可访问此页面。</p>
        </div>
      </div>
    );
  }

  // --- Disputed tasks ---
  const { data: disputedTasks } = await supabase
    .from("tasks")
    .select("id,title,status,reward_cents,created_at")
    .eq("status", "disputed")
    .order("created_at", { ascending: false })
    .limit(50);
  const taskRows = (disputedTasks ?? []) as TaskSummary[];

  const { data: disputes } = await supabase
    .from("disputes")
    .select("task_id,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const disputeRows = (disputes ?? []) as DisputeSummary[];
  const disputeMap = new Map(disputeRows.map((d) => [d.task_id, d]));

  // --- Medium/high risk AI audits ---
  const { data: highRisk } = await supabase
    .from("ai_audits")
    .select("task_id,risk_level,reason,raw,updated_at")
    .in("risk_level", ["medium", "high"])
    .order("updated_at", { ascending: false })
    .limit(50);
  const highRiskRows = (highRisk ?? []) as HighRiskAudit[];

  const highRiskIds = highRiskRows.map((r) => r.task_id);
  const { data: hrt } = highRiskIds.length
    ? await supabase.from("tasks").select("id,title,reward_cents,status,created_at").in("id", highRiskIds)
    : { data: [] as TaskSummary[] };
  const highRiskTaskMap = new Map((hrt ?? []).map((t: TaskSummary) => [t.id, t]));

  return (
    <div className="app-shell">
      <div>
        <div className="eyebrow">Admin</div>
        <h1 className="page-title mt-2">管理员工作台</h1>
        <p className="page-subtitle">处理争议裁决，查看 AI 中高风险提示。</p>
      </div>

      {/* Disputed tasks */}
      <section className="mt-6">
        <h2 className="text-lg font-bold text-slate-950">争议任务</h2>
        <p className="text-sm text-slate-500">需要裁决的争议中任务</p>

        {taskRows.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {taskRows.map((t) => {
              const dispute = disputeMap.get(t.id);
              return (
                <li key={t.id} className="list-row pl-5">
                  <div className="absolute inset-y-0 left-0 w-1.5 bg-rose-300 rounded-l-full" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="text-base font-semibold text-slate-950 hover:text-teal-700"
                      >
                        {t.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-sm">
                        <span className="font-semibold text-slate-950">
                          ￥{(t.reward_cents / 100).toFixed(2)}
                        </span>
                        <span className={`status-pill ${statusBadgeClass(t.status)}`}>
                          {labelStatus(t.status)}
                        </span>
                      </div>
                      {dispute?.reason ? (
                        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-500">争议原因</div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                            {dispute.reason}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <AdminResolveForm taskId={t.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-sm text-slate-400">
            当前没有待处理的争议任务
          </div>
        )}
      </section>

      {/* Medium/high risk AI audits */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-slate-950">AI 中高风险提示</h2>
        <p className="text-sm text-slate-500">AI 审核标记为中/高风险的近期任务，仅供人工复核参考。</p>

        {highRiskRows.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {highRiskRows.map((r) => {
              const t = highRiskTaskMap.get(r.task_id);
              const raw = auditRaw(r.raw);
              const categories = stringArray(raw?.categories);
              const evidence = stringArray(raw?.evidence);
              return (
                <li key={r.task_id} className="list-row pl-5">
                  <div className="absolute inset-y-0 left-0 w-1.5 bg-rose-300 rounded-l-full" />
                  <div className="min-w-0">
                    <Link
                      href={`/tasks/${r.task_id}`}
                      className="text-base font-semibold text-slate-950 hover:text-teal-700"
                    >
                      {t?.title ?? r.task_id}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="status-pill border-rose-200 bg-rose-50 text-rose-700">
                        高风险
                      </span>
                      {raw ? <span>{raw.flagged ? "疑似违规" : "待复核"}</span> : null}
                      {raw ? <span>{actionLabel(raw.suggestedAction)}</span> : null}
                      {t?.status ? <span>{labelStatus(t.status)}</span> : null}
                      {typeof t?.reward_cents === "number"
                        ? <span>￥{(t.reward_cents / 100).toFixed(2)}</span>
                        : null}
                    </div>
                    {categories.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {categories.map((category) => (
                          <span key={category} className="status-pill border-slate-200 bg-white text-slate-600">
                            {category}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {r.reason ? (
                      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{r.reason}</p>
                      </div>
                    ) : null}
                    {evidence.length ? (
                      <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                        <div className="text-xs font-semibold text-amber-800">模型依据片段</div>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-amber-900">
                          {evidence.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-sm text-slate-400">
            当前没有 AI 中高风险提示
          </div>
        )}
      </section>
    </div>
  );
}

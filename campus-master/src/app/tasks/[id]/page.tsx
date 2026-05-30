import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AcceptTaskForm,
  CancelTaskForm,
  ConfirmCompletionForm,
  OpenDisputeForm,
  ReviewForm,
  SubmitEvidenceForm,
} from "./TaskActionForms";
import TaskChat from "@/components/TaskChat";
import {
  labelStatus,
  statusAccentClass,
  statusBadgeClass,
} from "@/lib/taskDisplay";

type MessageRow = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ReviewRow = {
  reviewer_id: string;
  reviewee_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
};

type AiAuditRaw = {
  audit?: {
    flagged?: boolean;
    categories?: unknown;
    evidence?: unknown;
    suggestedAction?: unknown;
  };
};

function riskBadgeClass(risk: string) {
  switch (risk) {
    case "high":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "low":
      return "border-teal-200 bg-teal-50 text-teal-800";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "skipped":
      return "border-slate-200 bg-white text-slate-700";
    case "pending":
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

function riskLabel(risk: string) {
  switch (risk) {
    case "high": return "高风险";
    case "medium": return "中风险";
    case "low": return "低风险";
    case "error": return "审核出错";
    case "skipped": return "已跳过";
    case "pending":
    default: return "待审核";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function getAiAuditRaw(raw: unknown): AiAuditRaw["audit"] | null {
  if (!isRecord(raw)) return null;
  const audit = raw.audit;
  return isRecord(audit) ? audit : null;
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=/tasks/${id}`);
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      "id,requester_id,helper_id,title,description,category,reward_cents,status,evidence_text,evidence_image_paths,created_at,accepted_at,completed_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !task) {
    return (
      <div className="app-shell max-w-lg">
        <div className="page-card p-6 text-center">
          <div className="text-lg font-semibold text-slate-950">
            {error ? "加载出错" : "任务不存在"}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {error ? error.message : "该任务可能已被删除或链接无效。"}
          </p>
          <Link href="/tasks" className="btn-primary mt-4 inline-flex">
            返回任务大厅
          </Link>
        </div>
      </div>
    );
  }

  const isRequester = user.id === task.requester_id;
  const isHelper = user.id === task.helper_id;
  const isParticipant = isRequester || isHelper;
  const myRole = (myProfile?.role as string | undefined) ?? null;

  const canAccept =
    task.status === "open" && !isRequester && (myRole === "helper" || myRole === "admin");

  const canChat = Boolean(user && task.helper_id && isParticipant);

  // --- Chat & Messages ---
  let conversationId: string | null = null;
  let initialMessages: MessageRow[] = [];

  if (canChat) {
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("task_id", id)
      .maybeSingle();

    conversationId = existingConv?.id ?? null;

    if (!conversationId) {
      const { data: upserted } = await supabase
        .from("conversations")
        .upsert({ task_id: id }, { onConflict: "task_id" })
        .select("id")
        .single();
      conversationId = upserted?.id ?? null;
    }

    if (conversationId) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id,sender_id,body,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (Array.isArray(msgs)) initialMessages = msgs as MessageRow[];
    }
  }

  // --- Evidence images ---
  const evidenceImagePaths: string[] = Array.isArray(task.evidence_image_paths)
    ? (task.evidence_image_paths as string[])
    : [];
  const signedEvidenceUrls = await Promise.all(
    evidenceImagePaths.map(async (p) => {
      const { data } = await supabase.storage
        .from("task-evidence")
        .createSignedUrl(p, 60 * 60);
      return data?.signedUrl ?? null;
    }),
  );

  // --- AI Audit ---
  const { data: aiAudit } = await supabase
    .from("ai_audits")
    .select("risk_level,reason,raw,updated_at")
    .eq("task_id", id)
    .maybeSingle();
  const aiAuditRaw = getAiAuditRaw(aiAudit?.raw);
  const aiCategories = stringArray(aiAuditRaw?.categories);
  const aiEvidence = stringArray(aiAuditRaw?.evidence);

  // --- Reviews ---
  const { data: reviews } = await supabase
    .from("task_reviews")
    .select("reviewer_id,reviewee_id,stars,comment,created_at")
    .eq("task_id", id)
    .order("created_at", { ascending: false });
  const reviewRows = (reviews ?? []) as ReviewRow[];
  const hasReviewed = reviewRows.some((r) => r.reviewer_id === user.id);
  const myRevieweeId = isRequester
    ? task.helper_id
    : isHelper
      ? task.requester_id
      : null;

  return (
    <div className="app-shell">
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <Link href="/tasks" className="soft-link text-sm">
          ← 任务大厅
        </Link>
      </div>

      {/* Title card */}
      <section className="page-card relative overflow-hidden">
        <div className={`absolute inset-y-0 left-0 w-1.5 ${statusAccentClass(task.status)}`} />
        <div className="flex flex-col gap-4 p-5 pl-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950">
              {task.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`status-pill ${statusBadgeClass(task.status)}`}>
                {labelStatus(task.status)}
              </span>
              {task.category ? (
                <span className="status-pill border-slate-200 bg-slate-50 text-slate-500">
                  {task.category}
                </span>
              ) : null}
              <span className="text-xs text-slate-400">
                {formatTime(task.created_at)}
              </span>
            </div>
          </div>
          <div className="shrink-0 rounded-lg bg-teal-50 px-5 py-3 text-center ring-1 ring-teal-100/60">
            <div className="text-xs font-medium text-teal-600">报酬（已托管）</div>
            <div className="mt-1 text-2xl font-bold text-teal-700">
              ￥{(task.reward_cents / 100).toFixed(2)}
            </div>
          </div>
        </div>
      </section>

      {/* Main content + Sidebar */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Main content */}
        <div className="space-y-5">
          {/* Description */}
          <section className="section-card p-5">
            <h2 className="text-sm font-semibold text-slate-900">任务描述</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {task.description}
            </p>
          </section>

          {/* AI Audit */}
          {aiAudit ? (
            <section className="section-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">AI 内容审核</h2>
                <span className={`status-pill ${riskBadgeClass(aiAudit.risk_level)}`}>
                  {riskLabel(aiAudit.risk_level)}
                </span>
              </div>
              {aiAuditRaw ? (
                <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                    识别结果：{aiAuditRaw.flagged ? "发现疑似违规/暴力风险" : "未发现明显违规风险"}
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                    处置建议：{actionLabel(aiAuditRaw.suggestedAction)}
                  </div>
                </div>
              ) : null}
              {aiCategories.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {aiCategories.map((category) => (
                    <span key={category} className="status-pill border-slate-200 bg-slate-50 text-slate-600">
                      {category}
                    </span>
                  ))}
                </div>
              ) : null}
              {aiAudit.reason ? (
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{aiAudit.reason}</p>
                </div>
              ) : null}
              {aiEvidence.length ? (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                  <div className="text-xs font-semibold text-amber-800">模型依据片段</div>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-amber-900">
                    {aiEvidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="section-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">AI 内容审核</h2>
                <span className={`status-pill ${riskBadgeClass("pending")}`}>
                  {riskLabel("pending")}
                </span>
              </div>
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm leading-6 text-slate-600">
                  暂无审核结果。新发布任务会自动调用大模型识别违规、暴力和违法风险。
                </p>
              </div>
            </section>
          )}

          {/* Evidence */}
          {task.evidence_text || signedEvidenceUrls.some(Boolean) ? (
            <section className="section-card p-5">
              <h2 className="text-sm font-semibold text-slate-900">完成凭证</h2>
              {task.evidence_text ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {task.evidence_text}
                </p>
              ) : null}
              {signedEvidenceUrls.filter(Boolean).length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {signedEvidenceUrls.map((url, idx) =>
                    url ? (
                      <a key={idx} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and should render directly. */}
                        <img
                          src={url}
                          alt={`凭证 ${idx + 1}`}
                          className="h-36 w-full rounded-lg border border-slate-200 object-cover shadow-sm transition hover:shadow-md"
                        />
                      </a>
                    ) : null,
                  )}
                </div>
              ) : null}
              <p className="mt-2 text-xs text-slate-400">图片链接有效期约 1 小时</p>
            </section>
          ) : null}

          {/* Chat */}
          {canChat && conversationId ? (
            <TaskChat
              taskId={task.id}
              conversationId={conversationId}
              currentUserId={user.id}
              initialMessages={initialMessages}
            />
          ) : null}

          {/* Reviews */}
          {task.status === "completed" && isParticipant ? (
            <section className="section-card p-5">
              <h2 className="text-sm font-semibold text-slate-900">评价</h2>

              {!hasReviewed && myRevieweeId ? (
                <div className="mt-3">
                  <ReviewForm taskId={task.id} revieweeId={myRevieweeId} />
                </div>
              ) : hasReviewed ? (
                <p className="mt-2 text-sm text-slate-500">你已提交评价</p>
              ) : null}

              {reviewRows.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {reviewRows.map((r, idx) => (
                    <li key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-950">{r.stars} 星</span>
                        <span className="text-xs text-slate-400">{formatTime(r.created_at)}</span>
                      </div>
                      {r.comment ? (
                        <p className="mt-1 text-sm text-slate-600">{r.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>

        {/* Right: Actions sidebar */}
        <aside>
          <div className="section-card p-5 lg:sticky lg:top-20">
            <h2 className="text-sm font-semibold text-slate-900">操作</h2>

            <div className="mt-4 space-y-3">
              {/* Accept */}
              {canAccept ? <AcceptTaskForm taskId={task.id} /> : null}
              {task.status === "open" && !isRequester && !canAccept ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-700">
                  需要切换到&quot;接单方&quot;角色才能接单，前往
                  <Link href="/dashboard/account" className="ml-1 font-semibold underline">
                    账号与角色
                  </Link>
                </div>
              ) : null}

              {/* Submit Evidence */}
              {task.status === "in_progress" && isHelper ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <SubmitEvidenceForm taskId={task.id} />
                </div>
              ) : null}

              {/* Confirm Completion */}
              {task.status === "awaiting_acceptance" && isRequester ? (
                <ConfirmCompletionForm taskId={task.id} />
              ) : null}

              {/* Dispute */}
              {!["completed", "canceled", "disputed"].includes(task.status) && isParticipant ? (
                <OpenDisputeForm taskId={task.id} />
              ) : null}

              {/* Cancel */}
              {!["completed", "canceled"].includes(task.status) && isParticipant ? (
                <CancelTaskForm taskId={task.id} />
              ) : null}

              {/* No actions available */}
              {task.status === "completed" && (
                <p className="text-xs text-slate-400">任务已完成，无需操作</p>
              )}
              {task.status === "canceled" && (
                <p className="text-xs text-slate-400">任务已取消</p>
              )}
              {task.status === "disputed" && !isParticipant && (
                <p className="text-xs text-slate-400">等待管理员裁决</p>
              )}
            </div>

            {/* Flow guide */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="text-xs font-medium text-slate-400">状态流转规则</div>
              <div className="mt-2 flex flex-wrap gap-1 text-xs text-slate-500">
                <span className="rounded bg-amber-50 px-1.5 py-0.5">待接单</span>
                <span className="text-slate-300">→</span>
                <span className="rounded bg-sky-50 px-1.5 py-0.5">进行中</span>
                <span className="text-slate-300">→</span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5">待验收</span>
                <span className="text-slate-300">→</span>
                <span className="rounded bg-teal-50 px-1.5 py-0.5">已完成</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

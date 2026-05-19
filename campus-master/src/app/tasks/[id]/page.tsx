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
            "id,requester_id,helper_id,title,description,category,reward_cents,status,evidence_text,evidence_image_paths,created_at",
        )
        .eq("id", id)
        .maybeSingle();

    const { data: aiAudit } = await supabase
        .from("ai_audits")
        .select("risk_level,reason,updated_at")
        .eq("task_id", id)
        .maybeSingle();

    if (error) {
        return (
            <div className="app-shell max-w-3xl">
                <p className="text-sm text-red-600">{error.message}</p>
                <Link href="/tasks" className="soft-link mt-4 inline-block">
                    返回任务大厅
                </Link>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="app-shell max-w-3xl">
                <p className="text-sm">任务不存在</p>
                <Link href="/tasks" className="soft-link mt-4 inline-block">
                    返回任务大厅
                </Link>
            </div>
        );
    }

    const isRequester = user.id === task.requester_id;
    const isHelper = user.id === task.helper_id;
    const isParticipant = isRequester || isHelper;

    const myRole = (myProfile?.role as string | undefined) ?? null;
    const canAccept =
        task.status === "open" &&
        !isRequester &&
        (myRole === "helper" || myRole === "admin");

    const canChat = Boolean(user && task.helper_id && (isRequester || isHelper));

    let conversationId: string | null = null;
    let initialMessages: MessageRow[] = [];

    if (canChat) {
        const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("task_id", id)
            .maybeSingle();

        if (existingConv?.id) {
            conversationId = existingConv.id as string;
        } else {
            const { data: upsertedConv } = await supabase
                .from("conversations")
                .upsert({ task_id: id }, { onConflict: "task_id" })
                .select("id")
                .single();
            conversationId = (upsertedConv?.id as string) ?? null;
        }

        if (conversationId) {
            const { data: msgs } = await supabase
                .from("messages")
                .select("id,sender_id,body,created_at")
                .eq("conversation_id", conversationId)
                .order("created_at", { ascending: true })
                .limit(50);

            if (Array.isArray(msgs)) {
                initialMessages = msgs as MessageRow[];
            }
        }
    }

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

    const { data: reviews } = await supabase
        .from("task_reviews")
        .select("reviewer_id,reviewee_id,stars,comment,created_at")
        .eq("task_id", id)
        .order("created_at", { ascending: false });
    const reviewRows = (reviews ?? []) as ReviewRow[];

    const hasReviewed = Boolean(
        reviewRows.some((r) => r.reviewer_id === user.id),
    );

    const myRevieweeId = isRequester
        ? task.helper_id
        : isHelper
            ? task.requester_id
            : null;

    return (
        <div className="app-shell">
            <section className="page-card relative overflow-hidden">
                <div
                    className={`absolute inset-y-0 left-0 w-1.5 ${statusAccentClass(
                        task.status,
                    )}`}
                />
                <div className="flex flex-col gap-4 p-5 pl-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <Link href="/tasks" className="soft-link text-sm">
                            返回任务大厅
                        </Link>
                        <h1 className="mt-2 break-words text-2xl font-semibold tracking-normal text-slate-950">
                            {task.title}
                        </h1>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${statusBadgeClass(
                                    task.status,
                                )}`}
                            >
                                {labelStatus(task.status)}
                            </span>
                            {task.category ? (
                                <span className="status-pill border-slate-200 bg-slate-50 text-slate-600">
                                    {task.category}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        <div className="text-2xl font-semibold tracking-normal text-slate-950">
                            ￥{(task.reward_cents / 100).toFixed(2)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">报酬（已托管）</div>
                    </div>
                </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    <section className="section-card p-4">
                        <div className="text-sm font-semibold text-slate-900">任务描述</div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {task.description}
                        </p>
                    </section>

                    {aiAudit ? (
                        <section className="section-card p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-slate-900">AI 审核（辅助）</div>
                                <span
                                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${riskBadgeClass(
                                        String(aiAudit.risk_level),
                                    )}`}
                                >
                                    {String(aiAudit.risk_level)}
                                </span>
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-600">
                                <div className="whitespace-pre-wrap">
                                    {aiAudit.reason ?? "（无说明）"}
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {task.evidence_text ? (
                        <section className="section-card p-4">
                            <div className="text-sm font-semibold text-slate-900">完成凭证</div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {task.evidence_text}
                            </p>
                        </section>
                    ) : null}

                    {signedEvidenceUrls.filter(Boolean).length ? (
                        <section className="section-card p-4">
                            <div className="text-sm font-semibold text-slate-900">凭证图片</div>
                            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {signedEvidenceUrls.map((url, idx) =>
                                    url ? (
                                        <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and should render directly. */}
                                            <img
                                                src={url}
                                                alt={`evidence-${idx + 1}`}
                                                className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                                            />
                                        </a>
                                    ) : null,
                                )}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                图片为签名链接（有效期约 1 小时）。
                            </p>
                        </section>
                    ) : null}

                    {canChat && conversationId ? (
                        <TaskChat
                            taskId={task.id}
                            conversationId={conversationId}
                            currentUserId={user.id}
                            initialMessages={initialMessages}
                        />
                    ) : null}

                    {task.status === "completed" && (isRequester || isHelper) ? (
                        <section className="section-card p-4">
                            <div className="text-sm font-semibold text-slate-900">评价与信用</div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                任务完成后，双方可进行一次互评；信用分会依据评分动态调整。
                            </p>

                            {!hasReviewed && myRevieweeId ? (
                                <ReviewForm taskId={task.id} revieweeId={myRevieweeId} />
                            ) : (
                                <p className="mt-4 text-sm text-slate-600">你已提交评价。</p>
                            )}

                            {reviewRows.length ? (
                                <div className="mt-6">
                                    <div className="text-sm font-semibold text-slate-900">已提交的评价</div>
                                    <ul className="mt-2 space-y-2 text-sm text-slate-600">
                                        {reviewRows.map((r, idx) => (
                                            <li key={idx} className="rounded-lg bg-slate-50 p-3">
                                                <div>星级：{r.stars}</div>
                                                {r.comment ? <div>评语：{r.comment}</div> : null}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </section>
                    ) : null}
                </div>

                <aside className="lg:col-span-1">
                    <section className="section-card p-4">
                        <div className="text-sm font-semibold text-slate-900">可执行操作</div>

                        {canAccept ? (
                            <AcceptTaskForm taskId={task.id} />
                        ) : null}

                        {task.status === "open" && !isRequester && !canAccept ? (
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                当前角色不是“接单方”，无法接单。可到{" "}
                                <Link href="/dashboard" className="soft-link">
                                    我的看板
                                </Link>
                                {" "}切换角色为“接单方（helper）”。
                            </p>
                        ) : null}

                        {task.status === "in_progress" && isHelper ? (
                            <SubmitEvidenceForm taskId={task.id} />
                        ) : null}

                        {task.status === "awaiting_acceptance" && isRequester ? (
                            <ConfirmCompletionForm taskId={task.id} />
                        ) : null}

                        {task.status !== "completed" && task.status !== "canceled" && isParticipant ? (
                            <OpenDisputeForm taskId={task.id} />
                        ) : null}

                        {task.status !== "completed" && task.status !== "canceled" && isParticipant ? (
                            <CancelTaskForm taskId={task.id} />
                        ) : null}

                        <p className="mt-4 text-xs leading-5 text-slate-500">
                            状态流转：待接单 → 进行中 → 待验收 → 已完成；任意阶段可进入争议中。
                        </p>
                    </section>
                </aside>
            </div>
        </div>
    );
}

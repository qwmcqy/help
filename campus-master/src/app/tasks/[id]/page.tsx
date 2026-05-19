import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
    acceptTaskAction,
    cancelTaskAction,
    confirmCompletionAction,
    openDisputeAction,
    submitEvidenceAction,
} from "@/app/actions/taskActions";
import { submitReviewAction } from "@/app/actions/reviewActions";
import EvidenceUploader from "@/components/EvidenceUploader";
import TaskChat from "@/components/TaskChat";

type ProfileRole = {
    role: string;
};

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

function riskBadgeClass(risk: string) {
    switch (risk) {
        case "high":
            return "border-red-200 bg-red-50 text-red-800";
        case "medium":
            return "border-amber-200 bg-amber-50 text-amber-900";
        case "low":
            return "border-emerald-200 bg-emerald-50 text-emerald-900";
        case "error":
            return "border-rose-200 bg-rose-50 text-rose-900";
        case "skipped":
            return "border-zinc-200 bg-white text-zinc-700";
        case "pending":
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

    const { data: myProfile } = user
        ? await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle()
        : { data: null as ProfileRole | null };

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
            <div className="mx-auto w-full max-w-3xl px-4 py-8">
                <p className="text-sm text-red-600">{error.message}</p>
                <Link href="/tasks" className="mt-4 inline-block underline">
                    返回任务大厅
                </Link>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="mx-auto w-full max-w-3xl px-4 py-8">
                <p className="text-sm">任务不存在</p>
                <Link href="/tasks" className="mt-4 inline-block underline">
                    返回任务大厅
                </Link>
            </div>
        );
    }

    const isRequester = user?.id === task.requester_id;
    const isHelper = user?.id === task.helper_id;

    const myRole = (myProfile?.role as string | undefined) ?? null;
    const canAccept =
        task.status === "open" &&
        Boolean(user) &&
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
        user?.id && reviewRows.some((r) => r.reviewer_id === user.id),
    );

    const myRevieweeId = isRequester
        ? task.helper_id
        : isHelper
            ? task.requester_id
            : null;

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
            <div className="relative overflow-hidden rounded-2xl bg-white/70 shadow-sm ring-1 ring-zinc-200/60">
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-blue-400 to-emerald-400" />
                <div
                    className={`absolute inset-y-0 left-0 w-1.5 ${statusAccentClass(
                        task.status,
                    )}`}
                />
                <div className="flex flex-col gap-4 p-5 pl-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <Link href="/tasks" className="text-sm text-zinc-600 underline">
                            返回任务大厅
                        </Link>
                        <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">
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
                                <span className="inline-flex items-center rounded-full border border-zinc-200/70 bg-white/80 px-2.5 py-1 text-xs text-zinc-700">
                                    {task.category}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                            ￥{(task.reward_cents / 100).toFixed(2)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">报酬（已托管）</div>
                    </div>
                </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    <section className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                        <div className="text-sm font-medium">任务描述</div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
                            {task.description}
                        </p>
                    </section>

                    {aiAudit ? (
                        <section className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium">AI 审核（辅助）</div>
                                <span
                                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${riskBadgeClass(
                                        String(aiAudit.risk_level),
                                    )}`}
                                >
                                    {String(aiAudit.risk_level)}
                                </span>
                            </div>
                            <div className="mt-2 text-sm text-zinc-700">
                                <div className="whitespace-pre-wrap">
                                    {aiAudit.reason ?? "（无说明）"}
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {task.evidence_text ? (
                        <section className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                            <div className="text-sm font-medium">完成凭证</div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
                                {task.evidence_text}
                            </p>
                        </section>
                    ) : null}

                    {signedEvidenceUrls.filter(Boolean).length ? (
                        <section className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                            <div className="text-sm font-medium">凭证图片</div>
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
                                                className="h-32 w-full rounded-xl border border-zinc-200/70 object-cover"
                                            />
                                        </a>
                                    ) : null,
                                )}
                            </div>
                            <p className="mt-2 text-xs text-zinc-600">
                                图片为签名链接（有效期约 1 小时）。
                            </p>
                        </section>
                    ) : null}

                    {canChat && conversationId && user ? (
                        <TaskChat
                            taskId={task.id}
                            conversationId={conversationId}
                            currentUserId={user.id}
                            initialMessages={initialMessages}
                        />
                    ) : null}

                    {task.status === "completed" && user && (isRequester || isHelper) ? (
                        <section className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                            <div className="text-sm font-medium">评价与信用</div>
                            <p className="mt-2 text-sm text-zinc-700">
                                任务完成后，双方可进行一次互评；信用分会依据评分动态调整。
                            </p>

                            {!hasReviewed && myRevieweeId ? (
                                <form action={submitReviewAction} className="mt-4 space-y-2">
                                    <input type="hidden" name="taskId" value={task.id} />
                                    <input type="hidden" name="revieweeId" value={myRevieweeId} />

                                    <label className="block text-sm">
                                        <div>星级</div>
                                        <select
                                            name="stars"
                                            defaultValue={5}
                                            className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                                        >
                                            <option value={5}>5 - 非常满意</option>
                                            <option value={4}>4 - 满意</option>
                                            <option value={3}>3 - 一般</option>
                                            <option value={2}>2 - 不满意</option>
                                            <option value={1}>1 - 很差</option>
                                        </select>
                                    </label>

                                    <label className="block text-sm">
                                        <div>评语（可选）</div>
                                        <input
                                            name="comment"
                                            className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                                            placeholder="简要描述体验"
                                        />
                                    </label>

                                    <button className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm">
                                        提交评价
                                    </button>
                                </form>
                            ) : (
                                <p className="mt-4 text-sm text-zinc-700">你已提交评价。</p>
                            )}

                            {reviewRows.length ? (
                                <div className="mt-6">
                                    <div className="text-sm font-medium">已提交的评价</div>
                                    <ul className="mt-2 space-y-2 text-sm text-zinc-700">
                                        {reviewRows.map((r, idx) => (
                                            <li key={idx} className="rounded-xl bg-white/80 p-3 ring-1 ring-zinc-200/60">
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
                    <section className="overflow-hidden rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                        <div className="-mx-4 -mt-4 mb-3 h-1.5 bg-gradient-to-r from-blue-400 via-violet-400 to-rose-400" />
                        <div className="text-sm font-medium">可执行操作</div>

                        {canAccept ? (
                            <form action={acceptTaskAction} className="mt-3">
                                <input type="hidden" name="taskId" value={task.id} />
                                <button className="w-full rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm">
                                    接单（进入进行中）
                                </button>
                            </form>
                        ) : null}

                        {task.status === "open" && user && !isRequester && !canAccept ? (
                            <p className="mt-3 text-sm text-zinc-600">
                                当前角色不是“接单方”，无法接单。可到{" "}
                                <Link href="/dashboard" className="underline">
                                    我的看板
                                </Link>
                                {" "}切换角色为“接单方（helper）”。
                            </p>
                        ) : null}

                        {task.status === "in_progress" && isHelper ? (
                            <form action={submitEvidenceAction} className="mt-4 space-y-2">
                                <input type="hidden" name="taskId" value={task.id} />
                                <label className="block text-sm">
                                    <div>凭证说明</div>
                                    <textarea
                                        name="evidenceText"
                                        required
                                        rows={4}
                                        className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                                        placeholder="例如：已代领并送达宿舍楼下"
                                    />
                                </label>

                                <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3">
                                    <div className="text-sm font-medium">上传图片（可选）</div>
                                    <div className="mt-2">
                                        <EvidenceUploader taskId={task.id} />
                                    </div>
                                </div>

                                <button className="w-full rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm">
                                    提交凭证（进入待验收）
                                </button>
                            </form>
                        ) : null}

                        {task.status === "awaiting_acceptance" && isRequester ? (
                            <form action={confirmCompletionAction} className="mt-4">
                                <input type="hidden" name="taskId" value={task.id} />
                                <button className="w-full rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm">
                                    确认完成并支付
                                </button>
                            </form>
                        ) : null}

                        {task.status !== "completed" && task.status !== "canceled" ? (
                            <form action={openDisputeAction} className="mt-4 space-y-2">
                                <input type="hidden" name="taskId" value={task.id} />
                                <label className="block text-sm">
                                    <div>发起争议</div>
                                    <input
                                        name="reason"
                                        required
                                        className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                                        placeholder="简述争议原因"
                                    />
                                </label>
                                <button className="w-full rounded-full border border-zinc-200/70 bg-white/80 px-4 py-2 text-sm font-medium">
                                    进入争议中
                                </button>
                            </form>
                        ) : null}

                        {task.status !== "completed" && task.status !== "canceled" && user && (isRequester || isHelper) ? (
                            <form action={cancelTaskAction} className="mt-4 space-y-2">
                                <input type="hidden" name="taskId" value={task.id} />
                                <label className="block text-sm">
                                    <div>取消任务</div>
                                    <input
                                        name="reason"
                                        className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                                        placeholder="可选：填写取消原因"
                                    />
                                </label>
                                <button className="w-full rounded-full border border-zinc-200/70 bg-white/80 px-4 py-2 text-sm font-medium">
                                    取消任务
                                </button>
                                <p className="text-xs text-zinc-600">
                                    接单后取消可能会触发违约扣分；超时也会由系统自动判定。
                                </p>
                            </form>
                        ) : null}

                        <p className="mt-4 text-xs text-zinc-600">
                            状态流转：待接单 → 进行中 → 待验收 → 已完成；任意阶段可进入争议中。
                        </p>
                    </section>
                </aside>
            </div>
        </div>
    );
}

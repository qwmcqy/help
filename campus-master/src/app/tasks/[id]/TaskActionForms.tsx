"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    acceptTaskWithStateAction,
    cancelTaskWithStateAction,
    confirmCompletionWithStateAction,
    openDisputeWithStateAction,
    submitEvidenceWithStateAction,
    type SimpleActionState,
} from "@/app/actions/taskActions";
import { submitReviewWithStateAction } from "@/app/actions/reviewActions";
import EvidenceUploader from "@/components/EvidenceUploader";
import PendingButton from "@/components/PendingButton";

const initialState: SimpleActionState = {
    error: null,
    ok: false,
};

function useRefreshOnSuccess(state: SimpleActionState) {
    const router = useRouter();

    useEffect(() => {
        if (state.ok) {
            router.refresh();
        }
    }, [state, router]);
}

function ActionError({ message }: { message: string | null }) {
    if (!message) return null;
    return <p className="text-sm leading-5 text-rose-700">{message}</p>;
}

export function AcceptTaskForm({ taskId }: { taskId: string }) {
    const [state, formAction] = useActionState(
        acceptTaskWithStateAction,
        initialState,
    );
    useRefreshOnSuccess(state);

    return (
        <form action={formAction} className="mt-3 space-y-2">
            <input type="hidden" name="taskId" value={taskId} />
            <PendingButton className="btn-primary w-full" pendingText="接单中…">
                接单（进入进行中）
            </PendingButton>
            <ActionError message={state.error} />
        </form>
    );
}

export function SubmitEvidenceForm({ taskId }: { taskId: string }) {
    const [state, formAction] = useActionState(
        submitEvidenceWithStateAction,
        initialState,
    );
    useRefreshOnSuccess(state);

    return (
        <form action={formAction} className="mt-4 space-y-2">
            <input type="hidden" name="taskId" value={taskId} />
            <label className="field-label">
                凭证说明
                <textarea
                    name="evidenceText"
                    required
                    rows={4}
                    className="field-control resize-y"
                    placeholder="例如：已代领并送达宿舍楼下"
                />
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-900">上传图片（可选）</div>
                <div className="mt-2">
                    <EvidenceUploader taskId={taskId} />
                </div>
            </div>

            <PendingButton
                className="btn-primary w-full"
                pendingText="提交凭证中…"
            >
                提交凭证（进入待验收）
            </PendingButton>
            <ActionError message={state.error} />
        </form>
    );
}

export function ConfirmCompletionForm({ taskId }: { taskId: string }) {
    const [state, formAction] = useActionState(
        confirmCompletionWithStateAction,
        initialState,
    );
    useRefreshOnSuccess(state);

    return (
        <form action={formAction} className="mt-4 space-y-2">
            <input type="hidden" name="taskId" value={taskId} />
            <PendingButton className="btn-primary w-full" pendingText="确认中…">
                确认完成并支付
            </PendingButton>
            <ActionError message={state.error} />
        </form>
    );
}

export function OpenDisputeForm({ taskId }: { taskId: string }) {
    const [state, formAction] = useActionState(
        openDisputeWithStateAction,
        initialState,
    );
    useRefreshOnSuccess(state);

    return (
        <form action={formAction} className="mt-4 space-y-2">
            <input type="hidden" name="taskId" value={taskId} />
            <label className="field-label">
                发起争议
                <input
                    name="reason"
                    required
                    className="field-control"
                    placeholder="简述争议原因"
                />
            </label>
            <PendingButton
                className="btn-secondary w-full"
                pendingText="提交争议中…"
            >
                进入争议中
            </PendingButton>
            <ActionError message={state.error} />
        </form>
    );
}

export function CancelTaskForm({ taskId }: { taskId: string }) {
    const [state, formAction] = useActionState(
        cancelTaskWithStateAction,
        initialState,
    );
    useRefreshOnSuccess(state);

    return (
        <form action={formAction} className="mt-4 space-y-2">
            <input type="hidden" name="taskId" value={taskId} />
            <label className="field-label">
                取消任务
                <input
                    name="reason"
                    className="field-control"
                    placeholder="可选：填写取消原因"
                />
            </label>
            <PendingButton className="btn-danger-soft w-full" pendingText="取消中…">
                取消任务
            </PendingButton>
            <p className="text-xs leading-5 text-slate-500">
                接单后取消可能会触发违约扣分；超时也会由系统自动判定。
            </p>
            <ActionError message={state.error} />
        </form>
    );
}

export function ReviewForm({
    taskId,
    revieweeId,
}: {
    taskId: string;
    revieweeId: string;
}) {
    const [state, formAction] = useActionState(
        submitReviewWithStateAction,
        initialState,
    );
    useRefreshOnSuccess(state);

    return (
        <form action={formAction} className="mt-4 space-y-2">
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="revieweeId" value={revieweeId} />

            <label className="field-label">
                星级
                <select
                    name="stars"
                    defaultValue={5}
                    className="field-control"
                >
                    <option value={5}>5 - 非常满意</option>
                    <option value={4}>4 - 满意</option>
                    <option value={3}>3 - 一般</option>
                    <option value={2}>2 - 不满意</option>
                    <option value={1}>1 - 很差</option>
                </select>
            </label>

            <label className="field-label">
                评语（可选）
                <input
                    name="comment"
                    className="field-control"
                    placeholder="简要描述体验"
                />
            </label>

            <PendingButton className="btn-primary" pendingText="提交评价中…">
                提交评价
            </PendingButton>
            <ActionError message={state.error} />
        </form>
    );
}

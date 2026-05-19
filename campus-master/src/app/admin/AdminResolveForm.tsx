"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    adminResolveDisputeWithStateAction,
    type SimpleActionState,
} from "@/app/actions/taskActions";
import PendingButton from "@/components/PendingButton";

const initialState: SimpleActionState = {
    error: null,
    ok: false,
};

export default function AdminResolveForm({ taskId }: { taskId: string }) {
    const router = useRouter();
    const [state, formAction] = useActionState(
        adminResolveDisputeWithStateAction,
        initialState,
    );

    useEffect(() => {
        if (state.ok) {
            router.refresh();
        }
    }, [state, router]);

    return (
        <form action={formAction} className="shrink-0">
            <input type="hidden" name="taskId" value={taskId} />
            <div className="flex flex-col gap-2">
                <PendingButton
                    name="resolution"
                    value="complete"
                    className="btn-primary px-3"
                    pendingText="裁决中…"
                >
                    裁决：完成并支付
                </PendingButton>
                <PendingButton
                    name="resolution"
                    value="refund"
                    className="btn-secondary px-3"
                    pendingText="裁决中…"
                >
                    裁决：退款并回到待接单
                </PendingButton>
                {state.error ? (
                    <p className="max-w-48 text-xs leading-5 text-rose-700">
                        {state.error}
                    </p>
                ) : null}
            </div>
        </form>
    );
}

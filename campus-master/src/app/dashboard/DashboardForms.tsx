"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    topUpWithStateAction,
    type SimpleActionState,
} from "@/app/actions/taskActions";
import { updateRoleWithStateAction } from "@/app/actions/profileActions";
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

export function RoleSwitchForm({ currentRole }: { currentRole?: string | null }) {
    const initialRole = currentRole ?? "requester";
    const [state, formAction] = useActionState(
        updateRoleWithStateAction,
        initialState,
    );
    useRefreshOnSuccess(state);

    return (
        <form action={formAction} className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" key={currentRole}>
            <select
                name="role"
                defaultValue={initialRole}
                className="field-control mt-0"
            >
                <option value="requester">需求方（发布任务）</option>
                <option value="helper">接单方（接任务）</option>
            </select>
            <PendingButton
                className="btn-secondary shrink-0 px-3 py-2"
                pendingText="切换中…"
            >
                切换角色
            </PendingButton>
            {state.error ? (
                <p className="text-sm text-rose-700 sm:basis-full">{state.error}</p>
            ) : null}
        </form>
    );
}

export function TopUpForm() {
    const [state, formAction] = useActionState(topUpWithStateAction, initialState);
    useRefreshOnSuccess(state);

    return (
        <form action={formAction} className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
                name="amountCents"
                type="number"
                min={1}
                className="field-control mt-0 sm:w-32"
                placeholder="充值(分)"
                required
            />
            <PendingButton
                className="btn-primary px-3 py-2"
                pendingText="充值中…"
            >
                模拟充值
            </PendingButton>
            {state.error ? (
                <p className="text-sm text-rose-700 sm:basis-full">{state.error}</p>
            ) : null}
        </form>
    );
}

"use client";

import Link from "next/link";
import React from "react";
import { useFormStatus } from "react-dom";
import {
    createTaskAction,
    type CreateTaskActionState,
} from "@/app/actions/taskActions";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            disabled={pending}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
        >
            {pending ? "提交中…" : "确认发布并冻结资金"}
        </button>
    );
}

const initialState: CreateTaskActionState = {
    formError: null,
    fieldErrors: {},
};

export default function NewTaskForm() {
    const [state, formAction] = React.useActionState(
        createTaskAction,
        initialState,
    );

    return (
        <form
            action={formAction}
            className="space-y-4 overflow-hidden rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60"
        >
            <div className="-mx-4 -mt-4 mb-2 h-1.5 bg-gradient-to-r from-amber-400 via-blue-400 to-emerald-400" />
            {state.formError ? (
                <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 p-3 text-sm text-rose-900">
                    {state.formError}{" "}
                    {state.formError.includes("余额") ? (
                        <Link href="/dashboard" className="underline">
                            去看板充值
                        </Link>
                    ) : null}
                </div>
            ) : null}

            <label className="block">
                <div className="text-sm">标题</div>
                <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={80}
                    className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                    placeholder="如：代领快递（西门菜鸟驿站）"
                />
                {state.fieldErrors.title?.length ? (
                    <p className="mt-1 text-sm text-red-600">
                        {state.fieldErrors.title[0]}
                    </p>
                ) : null}
            </label>

            <label className="block">
                <div className="text-sm">描述</div>
                <textarea
                    name="description"
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={6}
                    className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                    placeholder="补充时间、地点、注意事项等"
                />
                {state.fieldErrors.description?.length ? (
                    <p className="mt-1 text-sm text-red-600">
                        {state.fieldErrors.description[0]}
                    </p>
                ) : null}
            </label>

            <label className="block">
                <div className="text-sm">分类（可选）</div>
                <input
                    name="category"
                    minLength={2}
                    maxLength={40}
                    className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                    placeholder="快递/代买/搬运"
                />
                {state.fieldErrors.category?.length ? (
                    <p className="mt-1 text-sm text-red-600">
                        {state.fieldErrors.category[0]}
                    </p>
                ) : null}
            </label>

            <label className="block">
                <div className="text-sm">报酬（分）</div>
                <input
                    name="rewardCents"
                    type="number"
                    min={1}
                    max={1000000}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
                    placeholder="例如 500 表示 5.00 元"
                />
                {state.fieldErrors.rewardCents?.length ? (
                    <p className="mt-1 text-sm text-red-600">
                        {state.fieldErrors.rewardCents[0]}
                    </p>
                ) : null}
            </label>

            <SubmitButton />
        </form>
    );
}

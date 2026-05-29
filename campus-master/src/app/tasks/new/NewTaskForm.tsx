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
    <button disabled={pending} className="btn-primary w-full sm:w-auto">
      {pending ? "发布中…" : "确认发布并冻结资金"}
    </button>
  );
}

const initialState: CreateTaskActionState = {
  formError: null,
  fieldErrors: {},
};

export default function NewTaskForm() {
  const [state, formAction] = React.useActionState(createTaskAction, initialState);

  return (
    <form action={formAction} className="section-card space-y-5 p-5 sm:p-6">
      {state.formError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100/50">
          {state.formError}{" "}
          {state.formError.includes("余额") ? (
            <Link href="/dashboard/account" className="soft-link">
              去充值
            </Link>
          ) : null}
        </div>
      ) : null}

      <label className="field-label">
        标题
        <input
          name="title"
          required
          minLength={2}
          maxLength={80}
          className="field-control"
          placeholder="如：代领快递（西门菜鸟驿站）"
        />
        {state.fieldErrors.title?.length ? (
          <p className="mt-1 text-sm text-rose-600">{state.fieldErrors.title[0]}</p>
        ) : null}
      </label>

      <label className="field-label">
        描述
        <textarea
          name="description"
          required
          minLength={5}
          maxLength={1000}
          rows={5}
          className="field-control resize-y"
          placeholder="补充时间、地点、注意事项等"
        />
        {state.fieldErrors.description?.length ? (
          <p className="mt-1 text-sm text-rose-600">{state.fieldErrors.description[0]}</p>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          分类（可选）
          <input
            name="category"
            minLength={2}
            maxLength={40}
            className="field-control"
            placeholder="快递 / 代买 / 搬运"
          />
          {state.fieldErrors.category?.length ? (
            <p className="mt-1 text-sm text-rose-600">{state.fieldErrors.category[0]}</p>
          ) : null}
        </label>

        <label className="field-label">
          报酬（分）
          <input
            name="rewardCents"
            type="number"
            min={1}
            max={1000000}
            required
            className="field-control"
            placeholder="500 = 5.00 元"
          />
          {state.fieldErrors.rewardCents?.length ? (
            <p className="mt-1 text-sm text-rose-600">{state.fieldErrors.rewardCents[0]}</p>
          ) : null}
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}

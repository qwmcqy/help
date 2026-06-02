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

type GeoStatus = "idle" | "loading" | "ready" | "error";

function LocationField() {
  const [status, setStatus] = React.useState<GeoStatus>("idle");
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [message, setMessage] = React.useState<string>("");

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setMessage("当前浏览器不支持定位，可不填位置直接发布。");
      return;
    }

    setStatus("loading");
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setStatus("ready");
      },
      (err) => {
        setStatus("error");
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? "已拒绝定位授权，可不填位置直接发布。"
            : "获取位置失败，可稍后重试或不填位置。",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className="field-label">
      <span>任务位置（可选）</span>
      <input type="hidden" name="lat" value={coords?.lat ?? ""} readOnly />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} readOnly />
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={locate}
          disabled={status === "loading"}
          className="btn-secondary"
        >
          {status === "loading" ? "定位中…" : "📍 获取当前位置"}
        </button>
        {status === "ready" && coords ? (
          <span className="text-sm text-teal-600">
            已定位 ✓（{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}）
          </span>
        ) : null}
        {coords ? (
          <button
            type="button"
            onClick={() => {
              setCoords(null);
              setStatus("idle");
              setMessage("");
            }}
            className="soft-link text-sm"
          >
            清除位置
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-1 text-sm text-amber-600">{message}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">
          填写位置后，接单方可在任务大厅按距离优先看到你的任务。
        </p>
      )}
    </div>
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

      <LocationField />

      <SubmitButton />
    </form>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type NotificationRow = {
    id: string;
    type: string;
    title: string;
    body: string | null;
    reference_id: string | null;
    created_at: string;
    is_read: boolean;
};

function typeAccentClass(type: string) {
    switch (type) {
        case "message":
            return "bg-sky-300";
        case "task":
        case "task_status":
            return "bg-indigo-300";
        case "ai_risk":
            return "bg-rose-300";
        default:
            return "bg-slate-300";
    }
}

function typeLabel(type: string) {
    switch (type) {
        case "message":
            return "私聊消息";
        case "task":
        case "task_status":
            return "任务动态";
        case "ai_risk":
            return "风险提示";
        case "violation":
            return "违约记录";
        default:
            return "系统通知";
    }
}

function typeBadgeClass(type: string) {
    switch (type) {
        case "message":
            return "border-sky-200 bg-sky-50 text-sky-700";
        case "task":
        case "task_status":
            return "border-indigo-200 bg-indigo-50 text-indigo-700";
        case "ai_risk":
        case "violation":
            return "border-rose-200 bg-rose-50 text-rose-700";
        default:
            return "border-slate-200 bg-slate-50 text-slate-600";
    }
}

function labelStatus(status: string) {
    switch (status) {
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
            return status;
    }
}

function formatBody(body: string | null) {
    if (!body) return null;
    return body.replace(
        /任务已变更为：(open|in_progress|awaiting_acceptance|completed|canceled|disputed)/g,
        (_, status: string) => `任务已变更为：${labelStatus(status)}`,
    );
}

function formatTime(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function NotificationsClient() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [items, setItems] = useState<NotificationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let channel: RealtimeChannel | null = null;

        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (cancelled) return;
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error: fetchError } = await supabase
                .from("notifications")
                .select("id,type,title,body,reference_id,created_at,is_read")
                .order("created_at", { ascending: false })
                .limit(50);

            if (fetchError) {
                setError(fetchError.message);
                setLoading(false);
                return;
            }

            if (!cancelled) {
                setItems((data ?? []) as NotificationRow[]);
                setLoading(false);
            }

            channel = supabase
                .channel(`notifications-changes-${user.id}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "notifications",
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        const n = payload.new as Partial<NotificationRow>;
                        setItems((prev) =>
                            [
                                {
                                    id: String(n.id ?? ""),
                                    type: String(n.type ?? ""),
                                    title: String(n.title ?? ""),
                                    body: n.body == null ? null : String(n.body),
                                    reference_id:
                                        n.reference_id == null
                                            ? null
                                            : String(n.reference_id),
                                    created_at: String(n.created_at ?? ""),
                                    is_read: Boolean(n.is_read),
                                },
                                ...prev,
                            ].slice(0, 50),
                        );
                    },
                )
                .subscribe();
        })();

        return () => {
            cancelled = true;
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [supabase]);

    return (
        <div className="app-shell">
            <section className="page-card p-5 sm:p-6">
                <div className="eyebrow">Notifications</div>
                <h1 className="page-title mt-2">最新通知</h1>
                <p className="page-subtitle">
                    展示最近 50 条；新通知会实时出现。
                </p>
            </section>

            {loading ? (
                <div className="section-card mt-6 p-4">
                    <div className="text-sm text-slate-500">加载中…</div>
                </div>
            ) : null}

            {!loading && !error && items.length === 0 ? (
                <div className="section-card mt-6 p-4">
                    <div className="text-sm text-slate-500">暂无通知</div>
                </div>
            ) : null}

            {error ? (
                <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    通知加载失败：{error}
                </div>
            ) : null}

            <ul className="mt-6 space-y-3">
                {items.map((n) => {
                    const href = n.reference_id
                        ? `/tasks/${n.reference_id}${n.type === "message" ? "#chat" : ""}`
                        : null;
                    const body = formatBody(n.body);

                    return (
                        <li
                            key={n.id}
                            className="list-row pl-5"
                        >
                            <div
                                className={`absolute inset-y-0 left-0 w-1.5 ${typeAccentClass(
                                    n.type,
                                )}`}
                            />
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className={`status-pill ${typeBadgeClass(n.type)}`}>
                                            {typeLabel(n.type)}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {formatTime(n.created_at)}
                                        </span>
                                    </div>
                                    {href ? (
                                        <Link
                                            href={href}
                                            className="block underline-offset-4 hover:underline"
                                        >
                                            <span className="block font-semibold text-slate-950">
                                                {n.title}
                                            </span>
                                            {body ? (
                                                <span className="mt-1 block whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                                                    {body}
                                                </span>
                                            ) : null}
                                        </Link>
                                    ) : (
                                        <div>
                                            <span className="block font-semibold text-slate-950">
                                                {n.title}
                                            </span>
                                            {body ? (
                                                <span className="mt-1 block whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                                                    {body}
                                                </span>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

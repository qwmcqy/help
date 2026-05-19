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
            return "bg-gradient-to-b from-blue-400 to-blue-600";
        case "task_status":
            return "bg-gradient-to-b from-violet-400 to-violet-600";
        case "ai_risk":
            return "bg-gradient-to-b from-rose-400 to-rose-600";
        default:
            return "bg-gradient-to-b from-zinc-300 to-zinc-500";
    }
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

    useEffect(() => {
        let cancelled = false;
        let channel: RealtimeChannel | null = null;

        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (cancelled || !user) return;

            const { data } = await supabase
                .from("notifications")
                .select("id,type,title,body,reference_id,created_at,is_read")
                .order("created_at", { ascending: false })
                .limit(50);

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
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
            <div className="overflow-hidden rounded-2xl bg-white/70 p-5 shadow-sm ring-1 ring-zinc-200/60">
                <div className="-mx-5 -mt-5 mb-4 h-1.5 bg-gradient-to-r from-blue-400 via-violet-400 to-rose-400" />
                <h1 className="text-2xl font-semibold tracking-tight">最新通知</h1>
                <p className="mt-1 text-sm text-zinc-600">
                    展示最近 50 条；新通知会实时出现。
                </p>
            </div>

            {loading ? (
                <div className="mt-6 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                    <div className="text-sm text-zinc-600">加载中…</div>
                </div>
            ) : null}

            {!loading && items.length === 0 ? (
                <div className="mt-6 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
                    <div className="text-sm text-zinc-600">暂无通知</div>
                </div>
            ) : null}

            <ul className="mt-6 space-y-3">
                {items.map((n) => {
                    const href = n.reference_id
                        ? `/tasks/${n.reference_id}${n.type === "message" ? "#chat" : ""}`
                        : null;

                    const title = (
                        <>
                            <span
                                className={
                                    n.is_read
                                        ? "font-medium text-zinc-900"
                                        : "font-semibold text-zinc-900"
                                }
                            >
                                {n.title}
                            </span>
                            {n.body ? (
                                <span className="text-zinc-600">：{n.body}</span>
                            ) : null}
                        </>
                    );

                    return (
                        <li
                            key={n.id}
                            className="relative overflow-hidden rounded-2xl bg-white/70 p-4 pl-5 shadow-sm ring-1 ring-zinc-200/60"
                        >
                            <div
                                className={`absolute inset-y-0 left-0 w-1.5 ${typeAccentClass(
                                    n.type,
                                )}`}
                            />
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    {href ? (
                                        <Link href={href} className="block truncate hover:underline">
                                            {title}
                                        </Link>
                                    ) : (
                                        <div className="truncate">{title}</div>
                                    )}
                                    <div className="mt-1 text-xs text-zinc-500">
                                        {formatTime(n.created_at)}
                                    </div>
                                </div>
                                <span className="shrink-0 rounded-full border border-zinc-200/70 bg-white/80 px-2.5 py-1 text-xs text-zinc-700">
                                    {n.type}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

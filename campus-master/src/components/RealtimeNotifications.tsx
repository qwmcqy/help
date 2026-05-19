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

export default function RealtimeNotifications() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [items, setItems] = useState<NotificationRow[]>([]);

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
                .limit(5);

            if (!cancelled && data) setItems(data as NotificationRow[]);

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
                            [{
                                id: String(n.id ?? ""),
                                type: String(n.type ?? ""),
                                title: String(n.title ?? ""),
                                body: n.body == null ? null : String(n.body),
                                reference_id: n.reference_id == null ? null : String(n.reference_id),
                                created_at: String(n.created_at ?? ""),
                                is_read: Boolean(n.is_read),
                            }, ...prev].slice(0, 5),
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

    if (items.length === 0) return null;

    return (
        <section className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
            <div className="section-card p-3">
                <div className="text-sm font-semibold text-slate-900">最新通知</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    {items.map((n) => (
                        <li key={n.id} className="break-words leading-6">
                            {n.reference_id ? (
                                <Link
                                    href={`/tasks/${n.reference_id}${n.type === "message" ? "#chat" : ""}`}
                                    className="underline-offset-4 hover:underline"
                                >
                                    <span className="font-medium">{n.title}</span>
                                    {n.body ? (
                                        <span className="text-slate-600">：{n.body}</span>
                                    ) : null}
                                </Link>
                            ) : (
                                <>
                                    <span className="font-medium">{n.title}</span>
                                    {n.body ? (
                                        <span className="text-slate-600">：{n.body}</span>
                                    ) : null}
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

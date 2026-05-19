"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type MessageRow = {
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
};

export default function TaskChat(props: {
    taskId: string;
    conversationId: string;
    currentUserId: string;
    initialMessages: MessageRow[];
}) {
    const { conversationId, currentUserId, initialMessages } = props;
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const [messages, setMessages] = useState<MessageRow[]>(initialMessages ?? []);
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length]);

    useEffect(() => {
        const channel = supabase
            .channel(`messages-${conversationId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const m = payload.new as Partial<MessageRow>;
                    const next: MessageRow = {
                        id: String(m.id),
                        sender_id: String(m.sender_id),
                        body: String(m.body),
                        created_at: String(m.created_at),
                    };

                    setMessages((prev) => {
                        if (prev.some((x) => x.id === next.id)) return prev;
                        return [...prev, next];
                    });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, conversationId]);

    async function onSend(e: FormEvent) {
        e.preventDefault();
        setError(null);

        const body = text.trim();
        if (!body) return;
        if (body.length > 2000) {
            setError("消息过长（最多 2000 字）");
            return;
        }

        setSending(true);
        try {
            const { data, error: insertError } = await supabase
                .from("messages")
                .insert({
                    conversation_id: conversationId,
                    sender_id: currentUserId,
                    body,
                })
                .select("id,sender_id,body,created_at")
                .single();

            if (insertError) throw insertError;

            if (data) {
                const next = data as MessageRow;
                setMessages((prev) => {
                    if (prev.some((x) => x.id === next.id)) return prev;
                    return [...prev, next];
                });
            }

            setText("");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "发送失败");
        } finally {
            setSending(false);
        }
    }

    return (
        <section id="chat" className="section-card p-4">
            <div className="text-sm font-semibold text-slate-900">私聊（仅任务双方可见）</div>
            <div className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                {messages.length ? (
                    <ul className="space-y-2 text-sm">
                        {messages.map((m) => {
                            const mine = m.sender_id === currentUserId;
                            return (
                                <li
                                    key={m.id}
                                    className={mine ? "text-right" : "text-left"}
                                >
                                    <div
                                        className={
                                            "inline-block max-w-[85%] whitespace-pre-wrap break-words rounded-md border px-3 py-2 " +
                                            (mine
                                                ? "border-teal-100 bg-teal-50 text-slate-900"
                                                : "border-slate-200 bg-white text-slate-700")
                                        }
                                    >
                                        {m.body}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        {new Date(m.created_at).toLocaleString()}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="text-sm text-slate-500">暂无消息</div>
                )}
                <div ref={bottomRef} />
            </div>

            <form onSubmit={onSend} className="mt-3 flex gap-2">
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="field-control mt-0"
                    placeholder="输入消息…"
                    maxLength={2000}
                />
                <button
                    disabled={sending}
                    className="btn-primary shrink-0"
                >
                    {sending ? "发送中…" : "发送"}
                </button>
            </form>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <p className="mt-2 text-xs text-slate-500">
                提示：发送后对方会收到实时通知（顶部“最新通知”）。
            </p>
        </section>
    );
}

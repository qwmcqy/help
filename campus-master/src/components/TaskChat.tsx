"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type MessageRow = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Partial<MessageRow>;
          setMessages((prev) => {
            const next: MessageRow = {
              id: String(m.id),
              sender_id: String(m.sender_id),
              body: String(m.body),
              created_at: String(m.created_at),
            };
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
        .insert({ conversation_id: conversationId, sender_id: currentUserId, body })
        .select("id,sender_id,body,created_at")
        .single();
      if (insertError) throw insertError;
      if (data) {
        setMessages((prev) => {
          const next = data as MessageRow;
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
    <section id="chat" className="section-card p-5">
      <h2 className="text-sm font-semibold text-slate-900">任务私聊</h2>
      <p className="text-xs text-slate-400">仅任务双方可见</p>

      <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/70 p-3">
        {messages.length > 0 ? (
          <ul className="space-y-2.5">
            {messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-6 ${
                      mine
                        ? "bg-teal-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <span className={`mt-1 block text-right text-[11px] ${mine ? "text-teal-100" : "text-slate-400"}`}>
                      {timeStr(m.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-slate-400">暂无消息，开始私聊吧</p>
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
        <button disabled={sending} className="btn-primary shrink-0" type="submit">
          {sending ? "…" : "发送"}
        </button>
      </form>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AuthPage() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const params = useSearchParams();
    const router = useRouter();

    const mode = params.get("mode") || "login";
    const rawNext = params.get("next") || "/tasks";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//")
        ? rawNext
        : "/tasks";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function logout() {
        setBusy(true);
        setError(null);
        const { error } = await supabase.auth.signOut();
        setBusy(false);
        if (error) {
            setError(error.message);
            return;
        }
        window.location.replace("/");
    }

    async function login(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        setBusy(false);
        if (error) {
            setError(error.message);
            return;
        }
        router.push(next);
        router.refresh();
    }

    async function register(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName || null,
                },
            },
        });
        setBusy(false);
        if (error) {
            setError(error.message);
            return;
        }
        router.push(next);
        router.refresh();
    }

    if (mode === "logout") {
        return (
            <div className="mx-auto w-full max-w-md px-4 py-12">
                <div className="page-card p-6">
                    <h1 className="text-xl font-semibold tracking-normal text-slate-950">退出登录</h1>
                    <p className="mt-2 text-sm text-slate-600">确认退出当前账号。</p>
                    {error ? (
                        <p className="mt-3 text-sm text-red-600">{error}</p>
                    ) : null}
                    <button
                        onClick={logout}
                        disabled={busy}
                        className="btn-primary mt-4 w-full"
                    >
                        退出
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-md px-4 py-12">
            <div className="page-card p-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold tracking-normal text-slate-950">
                        {mode === "register" ? "注册" : "登录"}
                    </h1>
                    <a
                        href={mode === "register" ? "/auth" : "/auth?mode=register"}
                        className="soft-link text-sm"
                    >
                        {mode === "register" ? "去登录" : "去注册"}
                    </a>
                </div>

                <form
                    onSubmit={mode === "register" ? register : login}
                    className="mt-6 space-y-4"
                >
                    {mode === "register" ? (
                        <label className="field-label">
                            昵称（可选）
                            <input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="field-control"
                            />
                        </label>
                    ) : null}

                    <label className="field-label">
                        邮箱
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="field-control"
                        />
                    </label>

                    <label className="field-label">
                        密码
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="field-control"
                        />
                    </label>

                    {error ? <p className="text-sm text-red-600">{error}</p> : null}

                    <button
                        disabled={busy}
                        className="btn-primary w-full"
                    >
                        {busy
                            ? "处理中…"
                            : mode === "register"
                                ? "注册并进入"
                                : "登录并进入"}
                    </button>
                </form>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                    注：注册后如需邮件验证，请在 Supabase Auth 设置里关闭或完成验证配置。
                </p>
            </div>
        </div>
    );
}

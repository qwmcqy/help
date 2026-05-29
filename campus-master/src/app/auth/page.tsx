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
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/tasks";

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      options: { data: { display_name: displayName || null } },
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
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="page-card w-full max-w-sm p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-teal-100 text-xl">
            👋
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-950">退出登录</h1>
          <p className="mt-2 text-sm text-slate-500">确认退出当前账号？</p>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          <button onClick={logout} disabled={busy} className="btn-primary mt-5 w-full">
            {busy ? "退出中…" : "确认退出"}
          </button>
        </div>
      </div>
    );
  }

  const isLogin = mode !== "register";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="page-card w-full max-w-sm p-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-teal-100">
            <span className="text-lg font-bold text-teal-700">万</span>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-950">
            {isLogin ? "登录" : "注册"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLogin ? "欢迎回到校园万事达" : "加入校园互助平台"}
          </p>
        </div>

        <form onSubmit={isLogin ? login : register} className="mt-6 space-y-4">
          {!isLogin ? (
            <label className="field-label">
              昵称（可选）
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="field-control"
                placeholder="你的显示名称"
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
              placeholder="you@example.com"
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
              placeholder="输入密码"
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button disabled={busy} className="btn-primary w-full">
            {busy ? "处理中…" : isLogin ? "登录" : "注册并进入"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <a
            href={isLogin ? "/auth?mode=register" : "/auth"}
            className="soft-link"
          >
            {isLogin ? "没有账号？去注册" : "已有账号？去登录"}
          </a>
        </div>

        <p className="mt-4 text-center text-xs leading-5 text-slate-400">
          课程设计项目，非生产环境
        </p>
      </div>
    </div>
  );
}

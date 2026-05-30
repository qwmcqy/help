import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoleSwitchForm, TopUpForm } from "../DashboardForms";

type LedgerEntry = {
  id: string;
  direction: string;
  amount_cents: number;
  reference_type: string;
  note: string | null;
  created_at: string;
};

const roleLabels: Record<string, string> = {
  requester: "需求方",
  helper: "接单方",
  admin: "管理员",
};

function directionLabel(d: string) {
  switch (d) {
    case "in": return "入账";
    case "out": return "支出";
    case "freeze": return "冻结";
    case "unfreeze": return "解冻";
    default: return d;
  }
}

function directionClass(d: string) {
  return d === "in" || d === "unfreeze"
    ? "border-teal-200 bg-teal-50 text-teal-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/dashboard/account");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,role,credit_score")
    .eq("id", user.id)
    .maybeSingle();

  const { data: account } = await supabase
    .from("accounts")
    .select("available_cents,frozen_cents")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: ledger } = await supabase
    .from("ledger_entries")
    .select("id,direction,amount_cents,reference_type,note,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const entries = (ledger ?? []) as LedgerEntry[];

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">Account</div>
          <h1 className="page-title mt-2">账号与角色</h1>
          <p className="page-subtitle">管理个人资料、角色、余额和资金流水</p>
        </div>
        <Link href="/dashboard" className="btn-secondary">
          返回看板
        </Link>
      </div>

      {/* Profile + Balance */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Profile card */}
        <div className="section-card p-5">
          <h2 className="text-sm font-semibold text-slate-900">个人资料</h2>
          <div className="mt-4 space-y-3 text-sm">
            <Row label="昵称" value={profile?.display_name ?? "未设置"} />
            <Row
              label="当前角色"
              value={
                <span className="status-pill border-teal-200 bg-teal-50 text-teal-700">
                  {profile?.role ? roleLabels[profile.role] ?? profile.role : "未知"}
                </span>
              }
            />
            <Row
              label="信用分"
              value={<span className="font-bold text-slate-950">{profile?.credit_score ?? 100}</span>}
            />
          </div>

          {profile?.role !== "admin" ? (
            <>
              <RoleSwitchForm currentRole={profile?.role} />
              <p className="mt-3 text-xs text-slate-400">
                角色切换后刷新即生效；管理员不提供角色切换。
              </p>
            </>
          ) : (
            <p className="mt-4 text-xs text-slate-400">管理员账号不提供角色切换。</p>
          )}
        </div>

        {/* Balance card */}
        <div className="section-card p-5">
          <h2 className="text-sm font-semibold text-slate-900">虚拟余额</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-teal-50 p-4 ring-1 ring-teal-100/50">
              <div className="text-xs font-medium text-teal-600">可用余额</div>
              <div className="mt-1 text-2xl font-bold text-teal-700">
                ￥{((account?.available_cents ?? 0) / 100).toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100/50">
              <div className="text-xs font-medium text-slate-500">冻结中</div>
              <div className="mt-1 text-2xl font-bold text-slate-700">
                ￥{((account?.frozen_cents ?? 0) / 100).toFixed(2)}
              </div>
            </div>
          </div>
          <TopUpForm />
          <p className="mt-3 text-xs text-slate-400">演示用途，不对接真实支付。</p>
        </div>
      </div>

      {/* Ledger */}
      <section className="section-card mt-5 p-5">
        <h2 className="text-sm font-semibold text-slate-900">最近资金流水</h2>
        <p className="mt-1 text-xs text-slate-400">最近 10 条记录</p>

        {entries.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`status-pill text-[11px] ${directionClass(entry.direction)}`}>
                      {directionLabel(entry.direction)}
                    </span>
                    <span className="text-sm font-medium text-slate-900">
                      {entry.note ?? entry.reference_type}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {formatTime(entry.created_at)} · {entry.reference_type}
                  </div>
                </div>
                <span className="shrink-0 text-base font-bold text-slate-950">
                  ￥{(entry.amount_cents / 100).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
            暂无资金流水
          </p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

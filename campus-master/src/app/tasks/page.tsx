import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  labelStatus,
  statusAccentClass,
  statusBadgeClass,
} from "@/lib/taskDisplay";

type TaskListItem = {
  id: string;
  title: string;
  category: string | null;
  reward_cents: number;
  status: string;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status || "";
  const category = sp.category || "";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextParams = new URLSearchParams();
    if (status) nextParams.set("status", status);
    if (category) nextParams.set("category", category);
    const next = nextParams.size ? `/tasks?${nextParams.toString()}` : "/tasks";
    redirect(`/auth?next=${encodeURIComponent(next)}`);
  }

  let q = supabase
    .from("tasks")
    .select("id,title,category,reward_cents,status,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) q = q.eq("status", status);
  if (category) q = q.ilike("category", `%${category}%`);

  const { data, error } = await q;
  const tasks = (data ?? []) as TaskListItem[];

  return (
    <div className="app-shell">
      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">Task Market</div>
          <h1 className="page-title mt-2">任务大厅</h1>
          <p className="page-subtitle">
            {status ? `筛选：${labelStatus(status)}` : "全站任务池"} · 最近 50 条
          </p>
        </div>
        <Link href="/tasks/new" className="btn-primary">
          发布任务
        </Link>
      </section>

      {/* Filters */}
      <section className="mt-5 rounded-lg border border-slate-200/60 bg-white/70 p-4 shadow-sm ring-1 ring-slate-100/30">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-slate-500">状态筛选</label>
            <select
              name="status"
              defaultValue={status}
              className="field-control mt-1"
            >
              <option value="">全部</option>
              <option value="open">待接单</option>
              <option value="in_progress">进行中</option>
              <option value="awaiting_acceptance">待验收</option>
              <option value="completed">已完成</option>
              <option value="canceled">已取消</option>
              <option value="disputed">争议中</option>
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs font-medium text-slate-500">分类搜索</label>
            <input
              name="category"
              defaultValue={category}
              placeholder="快递 / 代买 / 搬运"
              className="field-control mt-1"
            />
          </div>
          <button className="btn-primary">筛选</button>
          {(status || category) && (
            <Link href="/tasks" className="btn-ghost text-sm">
              清空
            </Link>
          )}
        </form>
      </section>

      {/* Error */}
      {error ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error.message}
        </div>
      ) : null}

      {/* Task list */}
      {!error && tasks.length > 0 ? (
        <ul className="mt-5 space-y-2.5">
          {tasks.map((t) => (
            <li key={t.id} className="list-row pl-5">
              <div
                className={`absolute inset-y-0 left-0 w-1 rounded-l-full ${statusAccentClass(t.status)}`}
              />
              <Link href={`/tasks/${t.id}`} className="block">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-base font-semibold text-slate-950">
                        {t.title}
                      </span>
                      {t.category ? (
                        <span className="status-pill border-slate-200 bg-slate-50 text-slate-500">
                          {t.category}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`status-pill ${statusBadgeClass(t.status)}`}>
                        {labelStatus(t.status)}
                      </span>
                      <span className="text-xs text-slate-400">{timeAgo(t.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:block sm:text-right">
                    <div className="text-lg font-bold text-slate-950">
                      ￥{(t.reward_cents / 100).toFixed(2)}
                    </div>
                    <span className="text-xs text-teal-600 font-medium">查看详情 →</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Empty state */}
      {!error && tasks.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 py-12 text-center">
          <div className="text-4xl">📋</div>
          <div>
            <div className="text-lg font-semibold text-slate-950">没有找到符合条件的任务</div>
            <p className="mt-1 text-sm text-slate-500">试试调整筛选条件，或者发布一个新任务</p>
          </div>
          <div className="flex gap-3">
            <Link href="/tasks" className="btn-secondary">清空筛选</Link>
            <Link href="/tasks/new" className="btn-primary">发布任务</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

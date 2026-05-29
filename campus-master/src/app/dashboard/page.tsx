import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  labelStatus,
  statusAccentClass,
  statusBadgeClass,
  taskStatusOrder,
} from "@/lib/taskDisplay";

type BoardTask = {
  id: string;
  requester_id: string;
  helper_id: string | null;
  title: string;
  category: string | null;
  reward_cents: number;
  status: string;
  created_at: string;
  updated_at: string;
};

const boardColumns: { status: typeof taskStatusOrder[number]; title: string; hint: string }[] = [
  { status: "open", title: "待接单", hint: "等待接单方领取" },
  { status: "in_progress", title: "进行中", hint: "已接单，等待凭证" },
  { status: "awaiting_acceptance", title: "待验收", hint: "等待需求方确认" },
  { status: "disputed", title: "争议中", hint: "管理员介入裁决" },
  { status: "completed", title: "已完成", hint: "最近完成的任务" },
  { status: "canceled", title: "已取消", hint: "已关闭的任务" },
];

function roleTag(task: BoardTask, userId: string) {
  if (task.requester_id === userId) return { label: "我发布", cls: "border-sky-200 bg-sky-50 text-sky-700" };
  if (task.helper_id === userId) return { label: "我接单", cls: "border-teal-200 bg-teal-50 text-teal-700" };
  return { label: "相关", cls: "border-slate-200 bg-slate-50 text-slate-500" };
}

function actionHint(task: BoardTask, userId: string): string {
  if (task.status === "awaiting_acceptance" && task.requester_id === userId) return "待你验收";
  if (task.status === "in_progress" && task.helper_id === userId) return "待提交凭证";
  if (task.status === "open" && task.requester_id === userId) return "等待接单";
  if (task.status === "disputed") return "查看争议";
  return "查看详情";
}

function BoardCard({ task, userId }: { task: BoardTask; userId: string }) {
  const role = roleTag(task, userId);
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group block rounded-lg border border-slate-200/70 bg-white p-3 shadow-sm ring-1 ring-slate-100/30 transition hover:border-teal-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-950 group-hover:text-teal-700">
            {task.title}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`status-pill text-[11px] ${role.cls}`}>{role.label}</span>
            {task.category ? (
              <span className="truncate text-[11px] text-slate-400">· {task.category}</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-sm font-bold text-slate-950">
          ￥{(task.reward_cents / 100).toFixed(2)}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="text-slate-400">{actionHint(task, userId)}</span>
        <span className="text-teal-600 opacity-0 transition group-hover:opacity-100">进入 →</span>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,credit_score")
    .eq("id", user.id)
    .maybeSingle();

  const { data } = await supabase
    .from("tasks")
    .select("id,requester_id,helper_id,title,category,reward_cents,status,created_at,updated_at")
    .or(`requester_id.eq.${user.id},helper_id.eq.${user.id}`)
    .order("updated_at", { ascending: false })
    .limit(80);

  const tasks = (data ?? []) as BoardTask[];
  const tasksByStatus = new Map(
    taskStatusOrder.map((status) => [
      status,
      tasks.filter((task) => task.status === status),
    ]),
  );

  const activeTasks = tasks.filter((t) =>
    ["open", "in_progress", "awaiting_acceptance"].includes(t.status),
  ).length;
  const awaitingMe = tasks.filter(
    (t) =>
      (t.status === "awaiting_acceptance" && t.requester_id === user.id) ||
      (t.status === "in_progress" && t.helper_id === user.id),
  ).length;
  const disputed = tasks.filter((t) => t.status === "disputed").length;
  const completed = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1 className="page-title mt-2">我的任务看板</h1>
          <p className="page-subtitle">按状态查看和处理与你相关的任务</p>
        </div>
        <Link href="/dashboard/account" className="btn-secondary">
          账号与余额
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="进行中" value={activeTasks} accent="bg-sky-50 text-sky-700" />
        <StatCard label="待我处理" value={awaitingMe} accent="bg-amber-50 text-amber-700" />
        <StatCard label="争议中" value={disputed} accent="bg-rose-50 text-rose-700" />
        <StatCard label="已完成" value={completed} accent="bg-teal-50 text-teal-700" />
      </div>

      {/* Role hint */}
      {profile?.role !== "helper" ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 ring-1 ring-amber-100/50">
          当前角色非"接单方"，无法接单。前往
          <Link href="/dashboard/account" className="ml-1 font-semibold underline">
            账号与角色
          </Link>
          切换。
        </div>
      ) : null}

      {/* Kanban columns */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boardColumns.map((col) => {
          const colTasks = tasksByStatus.get(col.status) ?? [];
          return (
            <div
              key={col.status}
              className="rounded-xl border border-slate-200/50 bg-slate-50/60 p-4 ring-1 ring-slate-100/30"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusAccentClass(col.status)}`} />
                  <h3 className="text-sm font-semibold text-slate-950">{col.title}</h3>
                </div>
                <span className={`status-pill text-[11px] ${statusBadgeClass(col.status)}`}>
                  {colTasks.length}
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-400">{col.hint}</p>
              <div className="space-y-2">
                {colTasks.slice(0, 8).map((task) => (
                  <BoardCard key={task.id} task={task} userId={user.id} />
                ))}
              </div>
              {colTasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 bg-white/60 py-6 text-center text-xs text-slate-400">
                  暂无{labelStatus(col.status)}任务
                </p>
              )}
              {colTasks.length > 8 && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  还有 {colTasks.length - 8} 条，请到任务大厅查看
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={`rounded-xl px-5 py-4 ring-1 ring-slate-100/30 ${accent} bg-white/80 border border-slate-200/50`}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

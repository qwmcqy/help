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

const boardColumns = [
    {
        status: "open",
        title: "待接单",
        hint: "我发布后等待接单的任务",
    },
    {
        status: "in_progress",
        title: "进行中",
        hint: "已接单，等待履约凭证",
    },
    {
        status: "awaiting_acceptance",
        title: "待验收",
        hint: "接单方已提交，需求方待确认",
    },
    {
        status: "disputed",
        title: "争议中",
        hint: "需要双方或管理员介入",
    },
    {
        status: "completed",
        title: "已完成",
        hint: "最近完成的任务",
    },
    {
        status: "canceled",
        title: "已取消",
        hint: "已关闭的任务",
    },
];

function roleLabel(task: BoardTask, userId: string) {
    if (task.requester_id === userId) return "我发布";
    if (task.helper_id === userId) return "我接单";
    return "相关任务";
}

function actionHint(task: BoardTask, userId: string) {
    if (task.status === "awaiting_acceptance" && task.requester_id === userId) {
        return "待你验收";
    }

    if (task.status === "in_progress" && task.helper_id === userId) {
        return "待你提交凭证";
    }

    if (task.status === "open" && task.requester_id === userId) {
        return "等待接单";
    }

    if (task.status === "disputed") {
        return "查看争议";
    }

    return "查看详情";
}

function countTasks(tasks: BoardTask[], predicate: (task: BoardTask) => boolean) {
    return tasks.filter(predicate).length;
}

function BoardCard({ task, userId }: { task: BoardTask; userId: string }) {
    return (
        <Link
            href={`/tasks/${task.id}`}
            className="group relative block overflow-hidden rounded-lg border border-slate-200 bg-white p-3 pl-4 shadow-sm transition hover:border-teal-200 hover:shadow-md"
        >
            <div
                className={`absolute inset-y-0 left-0 w-1 ${statusAccentClass(
                    task.status,
                )}`}
            />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950 group-hover:text-teal-800">
                        {task.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="status-pill border-slate-200 bg-slate-50 text-slate-600">
                            {roleLabel(task, userId)}
                        </span>
                        {task.category ? (
                            <span className="status-pill border-slate-200 bg-white text-slate-600">
                                {task.category}
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="shrink-0 text-right text-sm font-semibold text-slate-950">
                    ￥{(task.reward_cents / 100).toFixed(2)}
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500">{actionHint(task, userId)}</span>
                <span className="font-medium text-teal-700">进入</span>
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
        .select(
            "id,requester_id,helper_id,title,category,reward_cents,status,created_at,updated_at",
        )
        .or(`requester_id.eq.${user.id},helper_id.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(80);

    const tasks = (data ?? []) as BoardTask[];
    const tasksByStatus = new Map<string, BoardTask[]>(
        taskStatusOrder.map((status) => [
            status,
            tasks.filter((task) => task.status === status),
        ]),
    );

    const awaitingMe = countTasks(
        tasks,
        (task) =>
            (task.status === "awaiting_acceptance" &&
                task.requester_id === user.id) ||
            (task.status === "in_progress" && task.helper_id === user.id),
    );
    const activeTasks = countTasks(tasks, (task) =>
        ["open", "in_progress", "awaiting_acceptance"].includes(task.status),
    );
    const disputedTasks = countTasks(tasks, (task) => task.status === "disputed");
    const completedTasks = countTasks(tasks, (task) => task.status === "completed");

    return (
        <div className="app-shell">
            <section className="page-card p-5 sm:p-6">
                <div>
                    <div className="eyebrow">Workspace</div>
                    <h1 className="page-title mt-2">我的任务看板</h1>
                    <p className="page-subtitle">
                        按状态拆分任务推进节奏，账户、余额和角色设置已移动到独立页面。
                    </p>
                </div>
            </section>

            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="section-card p-4">
                    <div className="text-xs font-medium text-slate-500">进行中的相关任务</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {activeTasks}
                    </div>
                </div>
                <div className="section-card p-4">
                    <div className="text-xs font-medium text-slate-500">待我处理</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {awaitingMe}
                    </div>
                </div>
                <div className="section-card p-4">
                    <div className="text-xs font-medium text-slate-500">争议任务</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {disputedTasks}
                    </div>
                </div>
                <div className="section-card p-4">
                    <div className="text-xs font-medium text-slate-500">已完成</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {completedTasks}
                    </div>
                </div>
            </section>

            {profile?.role !== "helper" ? (
                <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    当前角色不是接单方，如需接单，请到{" "}
                    <Link href="/dashboard/account" className="font-semibold underline">
                        账号与角色
                    </Link>
                    {" "}切换。
                </section>
            ) : null}

            <section className="mt-6">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-950">状态列</h2>
                        <p className="text-sm text-slate-500">
                            每张卡片只保留推进任务所需的信息，详情与操作进入任务页处理。
                        </p>
                    </div>
                    <Link href="/dashboard/account" className="soft-link text-sm">
                        管理余额与角色
                    </Link>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                    {boardColumns.map((column) => {
                        const columnTasks = tasksByStatus.get(column.status) ?? [];

                        return (
                            <div
                                key={column.status}
                                className="min-h-48 rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                            >
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`h-2.5 w-2.5 rounded-full ${statusAccentClass(
                                                    column.status,
                                                )}`}
                                            />
                                            <h3 className="text-sm font-semibold text-slate-950">
                                                {column.title}
                                            </h3>
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                            {column.hint}
                                        </p>
                                    </div>
                                    <span
                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(
                                            column.status,
                                        )}`}
                                    >
                                        {columnTasks.length}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {columnTasks.slice(0, 8).map((task) => (
                                        <BoardCard
                                            key={task.id}
                                            task={task}
                                            userId={user.id}
                                        />
                                    ))}
                                </div>

                                {columnTasks.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4 text-center text-sm text-slate-500">
                                        暂无{labelStatus(column.status)}任务
                                    </div>
                                ) : null}

                                {columnTasks.length > 8 ? (
                                    <div className="mt-3 text-center text-xs text-slate-500">
                                        还有 {columnTasks.length - 8} 条，请到任务大厅筛选查看
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

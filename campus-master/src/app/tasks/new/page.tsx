import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewTaskForm from "./NewTaskForm";

export default async function NewTaskPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/tasks/new");
  }

  return (
    <div className="app-shell max-w-2xl">
      <div className="mb-6">
        <div className="eyebrow">Create Task</div>
        <h1 className="page-title mt-2">发布任务</h1>
        <p className="page-subtitle">发布时将冻结对应金额，任务完成后自动划拨。</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-3 text-sm text-slate-600 ring-1 ring-teal-100/30">
          <span className="font-semibold text-teal-700">提示</span>：写清楚时间、地点、交付方式
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500 ring-1 ring-slate-100/50">
          报酬单位：<span className="font-semibold text-slate-950">分</span>，如 500 = 5.00 元
        </div>
      </div>

      <NewTaskForm />
    </div>
  );
}

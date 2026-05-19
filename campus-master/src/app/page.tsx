import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/tasks");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-16">
      <div className="overflow-hidden rounded-2xl bg-white/70 p-6 shadow-sm ring-1 ring-zinc-200/60">
        <div className="-mx-6 -mt-6 mb-5 h-1.5 bg-gradient-to-r from-amber-400 via-blue-400 to-emerald-400" />
        <h1 className="text-3xl font-semibold tracking-tight">
          校园“万事达”——互助与众包任务平台
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-700">
          面向校园高频、碎片化、强时效需求（代领快递、代买餐食、搬运重物等），提供任务发布、
          接单履约、状态机流转、资金托管与信用评价的闭环。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/auth"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm"
          >
            登录/注册
          </Link>
          <Link
            href="/tasks"
            className="rounded-full border border-zinc-200/70 bg-white/80 px-4 py-2 text-sm font-medium"
          >
            浏览任务大厅
          </Link>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="overflow-hidden rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
          <div className="-mx-4 -mt-4 mb-3 h-1.5 bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400" />
          <div className="text-sm font-medium">状态机</div>
          <p className="mt-2 text-sm text-zinc-700">
            待接单 → 进行中 → 待验收 → 已完成；任意阶段可进入争议中。
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
          <div className="-mx-4 -mt-4 mb-3 h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400" />
          <div className="text-sm font-medium">资金托管</div>
          <p className="mt-2 text-sm text-zinc-700">
            发布即冻结，完成后自动划拨；流水可追溯。
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-zinc-200/60">
          <div className="-mx-4 -mt-4 mb-3 h-1.5 bg-gradient-to-r from-amber-400 via-rose-400 to-violet-400" />
          <div className="text-sm font-medium">RBAC</div>
          <p className="mt-2 text-sm text-zinc-700">
            需求方 / 接单方 / 管理员三类角色，权限隔离。
          </p>
        </div>
      </div>
    </div>
  );
}

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
    <div className="app-shell">
      <section className="grid gap-8 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-10">
        <div>
          <div className="eyebrow">Campus errands</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
          校园“万事达”——互助与众包任务平台
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          面向校园高频、碎片化、强时效需求（代领快递、代买餐食、搬运重物等），提供任务发布、
          接单履约、状态机流转、资金托管与信用评价的闭环。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/auth"
            className="btn-primary"
          >
            登录/注册
          </Link>
          <Link
            href="/tasks"
            className="btn-secondary"
          >
            浏览任务大厅
          </Link>
          </div>
        </div>

        <div className="page-card p-5">
          <div className="grid gap-3">
            <div className="muted-card p-4">
              <div className="text-sm font-semibold text-slate-900">任务流转</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                {["待接单", "进行中", "待验收", "已完成"].map((item) => (
                  <span key={item} className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="muted-card p-4">
                <div className="text-xs text-slate-500">资金托管</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">闭环</div>
              </div>
              <div className="muted-card p-4">
                <div className="text-xs text-slate-500">角色权限</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">RBAC</div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">典型场景</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                快递代领、食堂代买、物品搬运、资料打印等校园即时互助需求。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="section-card p-5">
          <div className="text-sm font-semibold text-slate-900">状态机</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            待接单 → 进行中 → 待验收 → 已完成；任意阶段可进入争议中。
          </p>
        </div>
        <div className="section-card p-5">
          <div className="text-sm font-semibold text-slate-900">资金托管</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            发布即冻结，完成后自动划拨；流水可追溯。
          </p>
        </div>
        <div className="section-card p-5">
          <div className="text-sm font-semibold text-slate-900">RBAC</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            需求方 / 接单方 / 管理员三类角色，权限隔离。
          </p>
        </div>
      </section>
    </div>
  );
}

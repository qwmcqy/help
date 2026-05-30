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
      {/* Hero */}
      <section className="flex flex-col items-center py-12 text-center sm:py-16 lg:py-20">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-4 py-1 text-xs font-semibold text-teal-700">
          北京邮电大学 · 课程设计项目
        </span>
        <h1 className="mt-6 max-w-2xl text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
          校园<span className="text-teal-600">&quot;万事达&quot;</span>
        </h1>
        <p className="mt-4 text-xl font-medium text-slate-500">互助与众包任务平台</p>
        <p className="mt-4 max-w-lg text-base leading-7 text-slate-500">
          代领快递、代买餐食、搬运重物——发布任务、资金托管、信用评价，一站式搞定校园互助需求。
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/auth" className="btn-primary px-6 py-3 text-base">
            立即开始
          </Link>
          <Link href="/tasks" className="btn-secondary px-6 py-3 text-base">
            浏览任务大厅
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          icon="01"
          title="任务流转"
          desc="待接单 → 进行中 → 待验收 → 已完成，状态机严格驱动，每次变更全记录。"
        />
        <FeatureCard
          icon="02"
          title="资金托管"
          desc="发布即冻结，完成自动划拨。每笔流水可追溯，事务保障不丢一分钱。"
        />
        <FeatureCard
          icon="03"
          title="信用评价"
          desc="双向互评驱动信用分，违约自动扣分，社区健康度透明可见。"
        />
        <FeatureCard
          icon="04"
          title="AI 护航"
          desc="任务发布时语义级合规审核，风险分级提示辅助人工决策。"
        />
      </section>

      {/* Scenario section */}
      <section className="mt-16">
        <div className="text-center">
          <div className="eyebrow">使用场景</div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            覆盖校园高频需求
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: "📦", title: "代领快递", desc: "西门菜鸟驿站代取，送到宿舍楼下" },
            { icon: "🍱", title: "代买餐食", desc: "食堂代买打包，免去排队等待" },
            { icon: "📦", title: "搬运重物", desc: "搬宿舍、搬教材，搭把手就搞定" },
            { icon: "🖨️", title: "资料打印", desc: "帮忙打印提交，省去跑打印店" },
            { icon: "🔑", title: "物品转交", desc: "忘带钥匙、忘拿东西，找人帮忙" },
            { icon: "📚", title: "更多需求", desc: "任何碎片化校园需求都可发布" },
          ].map((s) => (
            <div key={s.title} className="muted-card flex items-start gap-3 p-4">
              <span className="shrink-0 text-xl">{s.icon}</span>
              <div>
                <div className="font-semibold text-slate-950">{s.title}</div>
                <p className="mt-1 text-sm leading-5 text-slate-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-16">
        <div className="text-center">
          <div className="eyebrow">三步完成</div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            如何使用
          </h2>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <StepCard step={1} title="注册并充值" desc="选择角色（需求方/接单方），模拟充值获得余额。" />
          <StepCard step={2} title="发布或接单" desc="需求方发布任务冻结资金；接单方浏览任务大厅并接单。" />
          <StepCard step={3} title="履约与结算" desc="接单方提交凭证，需求方验收确认，资金自动划拨。" />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="stat-card">
      <div className="text-xs font-semibold text-teal-500/60">{icon}</div>
      <div className="mt-3 text-base font-semibold text-slate-950">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  desc,
}: {
  step: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative rounded-xl border border-slate-200/60 bg-white p-6 pt-12 shadow-sm ring-1 ring-slate-100/30">
      <span className="absolute left-6 top-4 text-3xl font-extrabold text-teal-100">
        {String(step).padStart(2, "0")}
      </span>
      <div className="text-base font-semibold text-slate-950">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
    </div>
  );
}

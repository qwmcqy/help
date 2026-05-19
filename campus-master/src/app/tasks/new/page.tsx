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
        <div className="app-shell">
            <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
                <div className="page-card p-6">
                    <div className="eyebrow">Create task</div>
                    <h1 className="page-title mt-2">发布任务</h1>
                    <p className="page-subtitle">
                        发布时会冻结对应金额（单位：分），任务完成后自动划拨。
                    </p>
                    <div className="mt-6 space-y-3 text-sm text-slate-600">
                        <div className="rounded-lg border border-teal-100 bg-teal-50/70 p-3">
                            建议写清楚时间、地点、交付方式和验收标准。
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            报酬使用“分”为单位，例如 500 表示 5.00 元。
                        </div>
                    </div>
                </div>
                <div>
                <NewTaskForm />
                </div>
            </section>
        </div>
    );
}

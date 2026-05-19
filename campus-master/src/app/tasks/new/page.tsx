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
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
            <h1 className="text-2xl font-semibold tracking-tight">发布任务</h1>
            <p className="mt-1 text-sm text-zinc-600">
                发布时会冻结对应金额（单位：分），任务完成后自动划拨。
            </p>

            <div className="mt-6 max-w-2xl">
                <NewTaskForm />
            </div>
        </div>
    );
}

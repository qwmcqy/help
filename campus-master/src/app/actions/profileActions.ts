"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SimpleActionState } from "@/app/actions/taskActions";

export async function updateRoleAction(formData: FormData) {
    const role = String(formData.get("role") || "");
    if (!role || !["requester", "helper"].includes(role)) {
        throw new Error("Invalid role");
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Not authenticated");
    }

    const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
    revalidatePath("/tasks");
    redirect("/dashboard/account");
}

export async function updateRoleWithStateAction(
    _prevState: SimpleActionState,
    formData: FormData,
): Promise<SimpleActionState> {
    const role = String(formData.get("role") || "");
    if (!["requester", "helper"].includes(role)) {
        return { error: "请选择有效角色。", ok: false };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "请先登录后再切换角色。", ok: false };
    }

    const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", user.id);

    if (error) {
        return { error: error.message, ok: false };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
    revalidatePath("/tasks");
    return { error: null, ok: true };
}

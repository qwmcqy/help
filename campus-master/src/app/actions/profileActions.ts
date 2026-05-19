"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    revalidatePath("/tasks");
    redirect("/dashboard");
}

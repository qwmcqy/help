"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewSchema } from "@/lib/validation";
import type { SimpleActionState } from "@/app/actions/taskActions";

export async function submitReviewAction(formData: FormData) {
    const parsed = ReviewSchema.safeParse({
        taskId: formData.get("taskId"),
        revieweeId: formData.get("revieweeId"),
        stars: formData.get("stars"),
        comment: formData.get("comment"),
    });

    if (!parsed.success) {
        throw new Error(parsed.error.message);
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("task_reviews").insert({
        task_id: parsed.data.taskId,
        reviewer_id: user.id,
        reviewee_id: parsed.data.revieweeId,
        stars: parsed.data.stars,
        comment: parsed.data.comment || null,
    });

    if (error) throw new Error(error.message);

    revalidatePath(`/tasks/${parsed.data.taskId}`);
    revalidatePath("/dashboard");
}

export async function submitReviewWithStateAction(
    _prevState: SimpleActionState,
    formData: FormData,
): Promise<SimpleActionState> {
    const parsed = ReviewSchema.safeParse({
        taskId: formData.get("taskId"),
        revieweeId: formData.get("revieweeId"),
        stars: formData.get("stars"),
        comment: formData.get("comment"),
    });

    if (!parsed.success) {
        return { error: "请检查评分和评语内容。", ok: false };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "请先登录后再提交评价。", ok: false };
    }

    const { error } = await supabase.from("task_reviews").insert({
        task_id: parsed.data.taskId,
        reviewer_id: user.id,
        reviewee_id: parsed.data.revieweeId,
        stars: parsed.data.stars,
        comment: parsed.data.comment || null,
    });

    if (error) {
        return { error: error.message, ok: false };
    }

    revalidatePath(`/tasks/${parsed.data.taskId}`);
    revalidatePath("/dashboard");
    return { error: null, ok: true };
}

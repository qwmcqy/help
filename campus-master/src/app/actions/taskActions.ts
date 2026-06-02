"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
    CancelTaskSchema,
    CreateTaskSchema,
    DisputeSchema,
    EvidenceSchema,
    TopUpSchema,
} from "@/lib/validation";
import { reviewTaskTextWithAI } from "@/lib/ai/reviewTask";
import { encodeGeohash } from "@/lib/geohash";

export type CreateTaskActionState = {
    formError: string | null;
    fieldErrors: Partial<
        Record<"title" | "description" | "category" | "rewardCents", string[]>
    >;
};

export type SimpleActionState = {
    error: string | null;
    ok: boolean;
};

export async function topUpAction(formData: FormData) {
    const parsed = TopUpSchema.safeParse({
        amountCents: formData.get("amountCents"),
    });
    if (!parsed.success) {
        throw new Error(parsed.error.message);
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("top_up", {
        p_amount_cents: parsed.data.amountCents,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
}

export async function topUpWithStateAction(
    _prevState: SimpleActionState,
    formData: FormData,
): Promise<SimpleActionState> {
    const parsed = TopUpSchema.safeParse({
        amountCents: formData.get("amountCents"),
    });

    if (!parsed.success) {
        return { error: "请输入 1 到 10000000 之间的整数金额（单位：分）。", ok: false };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "请先登录后再充值。", ok: false };
    }

    const { error } = await supabase.rpc("top_up", {
        p_amount_cents: parsed.data.amountCents,
    });

    if (error) {
        return { error: error.message, ok: false };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
    return { error: null, ok: true };
}

export async function createTaskAction(
    _prevState: CreateTaskActionState,
    formData: FormData,
): Promise<CreateTaskActionState> {
    const parsed = CreateTaskSchema.safeParse({
        title: formData.get("title"),
        description: formData.get("description"),
        category: formData.get("category"),
        rewardCents: formData.get("rewardCents"),
        lat: formData.get("lat"),
        lng: formData.get("lng"),
    });

    if (!parsed.success) {
        const flattened = parsed.error.flatten();
        return {
            formError: "请检查表单输入",
            fieldErrors: flattened.fieldErrors,
        };
    }

    const lat = typeof parsed.data.lat === "number" ? parsed.data.lat : null;
    const lng = typeof parsed.data.lng === "number" ? parsed.data.lng : null;
    const hasLocation = lat !== null && lng !== null;
    const geohash = hasLocation ? encodeGeohash(lat, lng) : null;

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            formError: "请先登录后再发布任务。",
            fieldErrors: {},
        };
    }

    const { data, error } = await supabase.rpc("create_task", {
        p_title: parsed.data.title,
        p_description: parsed.data.description,
        p_category: parsed.data.category ?? "",
        p_reward_cents: parsed.data.rewardCents,
        p_lat: lat,
        p_lng: lng,
        p_geohash: geohash,
    });

    if (error) {
        const msg = String(error.message || "创建失败");
        const details = String(error.details || "");
        const hint = String(error.hint || "");
        const code = String(error.code || "");

        if (msg.toLowerCase().includes("insufficient balance")) {
            return { formError: "余额不足，无法发布该报酬的任务。", fieldErrors: {} };
        }

        const extra = [
            details ? `details: ${details}` : "",
            hint ? `hint: ${hint}` : "",
            code ? `code: ${code}` : "",
        ]
            .filter(Boolean)
            .join("\n");

        return {
            formError: extra ? `${msg}\n${extra}` : msg,
            fieldErrors: {},
        };
    }

    if (!data) {
        return { formError: "创建失败，请稍后再试", fieldErrors: {} };
    }

    // Best-effort AI audit (optional). Failure should not block task creation.
    try {
        const result = await reviewTaskTextWithAI({
            title: parsed.data.title,
            description: parsed.data.description,
        });

        await supabase
            .from("ai_audits")
            .update({
                risk_level: result.riskLevel,
                reason: result.reason,
                raw: result.raw ?? null,
            })
            .eq("task_id", data);
    } catch {
        // ignore
    }

    redirect(`/tasks/${data}`);
}

export async function acceptTaskAction(formData: FormData) {
    const taskId = String(formData.get("taskId") || "");
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.rpc("accept_task", { p_task_id: taskId });
    if (error) throw new Error(error.message);

    revalidatePath(`/tasks/${taskId}`);
}

export async function acceptTaskWithStateAction(
    _prevState: SimpleActionState,
    formData: FormData,
): Promise<SimpleActionState> {
    const taskId = String(formData.get("taskId") || "");
    if (!taskId) {
        return { error: "任务参数无效，请刷新页面后重试。", ok: false };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "请先登录后再接单。", ok: false };
    }

    const { error } = await supabase.rpc("accept_task", { p_task_id: taskId });
    if (error) {
        return { error: error.message, ok: false };
    }

    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
    return { error: null, ok: true };
}

export async function submitEvidenceAction(formData: FormData) {
    const taskId = String(formData.get("taskId") || "");
    const imagePaths = formData
        .getAll("imagePath")
        .map((x) => String(x))
        .filter(Boolean);
    const parsed = EvidenceSchema.safeParse({
        evidenceText: formData.get("evidenceText"),
        imagePaths,
    });
    if (!parsed.success) {
        throw new Error(parsed.error.message);
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("submit_evidence", {
        p_task_id: taskId,
        p_evidence_text: parsed.data.evidenceText,
        p_evidence_image_paths: parsed.data.imagePaths ?? [],
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/tasks/${taskId}`);
}

export async function submitEvidenceWithStateAction(
    _prevState: SimpleActionState,
    formData: FormData,
): Promise<SimpleActionState> {
    const taskId = String(formData.get("taskId") || "");
    const imagePaths = formData
        .getAll("imagePath")
        .map((x) => String(x))
        .filter(Boolean);
    const parsed = EvidenceSchema.safeParse({
        evidenceText: formData.get("evidenceText"),
        imagePaths,
    });

    if (!taskId || !parsed.success) {
        return { error: "请填写至少 2 个字的凭证说明。", ok: false };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "请先登录后再提交凭证。", ok: false };
    }

    const { error } = await supabase.rpc("submit_evidence", {
        p_task_id: taskId,
        p_evidence_text: parsed.data.evidenceText,
        p_evidence_image_paths: parsed.data.imagePaths ?? [],
    });

    if (error) {
        return { error: error.message, ok: false };
    }

    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
    return { error: null, ok: true };
}

export async function confirmCompletionAction(formData: FormData) {
    const taskId = String(formData.get("taskId") || "");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("confirm_completion", {
        p_task_id: taskId,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
}

export async function confirmCompletionWithStateAction(
    _prevState: SimpleActionState,
    formData: FormData,
): Promise<SimpleActionState> {
    const taskId = String(formData.get("taskId") || "");
    if (!taskId) {
        return { error: "任务参数无效，请刷新页面后重试。", ok: false };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "请先登录后再确认完成。", ok: false };
    }

    const { error } = await supabase.rpc("confirm_completion", {
        p_task_id: taskId,
    });

    if (error) {
        return { error: error.message, ok: false };
    }

    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
    return { error: null, ok: true };
}

export async function openDisputeAction(formData: FormData) {
    const taskId = String(formData.get("taskId") || "");
    const parsed = DisputeSchema.safeParse({ reason: formData.get("reason") });
    if (!parsed.success) {
        throw new Error(parsed.error.message);
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("open_dispute", {
        p_task_id: taskId,
        p_reason: parsed.data.reason,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/admin");
}

export async function openDisputeWithStateAction(
    _prevState: SimpleActionState,
    formData: FormData,
): Promise<SimpleActionState> {
    const taskId = String(formData.get("taskId") || "");
    const parsed = DisputeSchema.safeParse({ reason: formData.get("reason") });

    if (!taskId || !parsed.success) {
        return { error: "请填写至少 2 个字的争议原因。", ok: false };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "请先登录后再发起争议。", ok: false };
    }

    const { error } = await supabase.rpc("open_dispute", {
        p_task_id: taskId,
        p_reason: parsed.data.reason,
    });

    if (error) {
        return { error: error.message, ok: false };
    }

    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/admin");
    return { error: null, ok: true };
}

export async function cancelTaskAction(formData: FormData) {
    const parsed = CancelTaskSchema.safeParse({
        taskId: formData.get("taskId"),
        reason: formData.get("reason"),
    });
    if (!parsed.success) {
        throw new Error(parsed.error.message);
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("cancel_task", {
        p_task_id: parsed.data.taskId,
        p_reason: parsed.data.reason ?? "",
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/tasks/${parsed.data.taskId}`);
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
}

export async function cancelTaskWithStateAction(
    _prevState: SimpleActionState,
    formData: FormData,
): Promise<SimpleActionState> {
    const parsed = CancelTaskSchema.safeParse({
        taskId: formData.get("taskId"),
        reason: formData.get("reason"),
    });

    if (!parsed.success) {
        return { error: "取消参数无效，请刷新页面后重试。", ok: false };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "请先登录后再取消任务。", ok: false };
    }

    const { error } = await supabase.rpc("cancel_task", {
        p_task_id: parsed.data.taskId,
        p_reason: parsed.data.reason ?? "",
    });

    if (error) {
        return { error: error.message, ok: false };
    }

    revalidatePath(`/tasks/${parsed.data.taskId}`);
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
    return { error: null, ok: true };
}

export async function adminResolveDisputeAction(formData: FormData) {
    const taskId = String(formData.get("taskId") || "");
    const resolution = String(formData.get("resolution") || "");
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.rpc("resolve_dispute", {
        p_task_id: taskId,
        p_resolution: resolution,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
}

export async function adminResolveDisputeWithStateAction(
    _prevState: SimpleActionState,
    formData: FormData,
): Promise<SimpleActionState> {
    const taskId = String(formData.get("taskId") || "");
    const resolution = String(formData.get("resolution") || "");

    if (!taskId || !["complete", "refund"].includes(resolution)) {
        return { error: "裁决参数无效，请刷新页面后重试。", ok: false };
    }

    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "请先登录后再处理争议。", ok: false };
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (profile?.role !== "admin") {
        return { error: "当前账号没有管理员权限。", ok: false };
    }

    const { error } = await supabase.rpc("resolve_dispute", {
        p_task_id: taskId,
        p_resolution: resolution,
    });

    if (error) {
        return { error: error.message, ok: false };
    }

    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/account");
    return { error: null, ok: true };
}

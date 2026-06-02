import { z } from "zod";

export const CreateTaskSchema = z.object({
    title: z.string().trim().min(2).max(80),
    description: z.string().trim().min(5).max(1000),
    category: z.string().trim().min(2).max(40).optional().or(z.literal("")),
    rewardCents: z.coerce.number().int().min(1).max(1_000_000),
    lat: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.coerce.number().min(-90).max(90).optional(),
    ),
    lng: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.coerce.number().min(-180).max(180).optional(),
    ),
});

export const EvidenceSchema = z.object({
    evidenceText: z.string().trim().min(2).max(1000),
    imagePaths: z.array(z.string().min(1)).max(3).optional(),
});

export const DisputeSchema = z.object({
    reason: z.string().trim().min(2).max(500),
});

export const CancelTaskSchema = z.object({
    taskId: z.string().uuid(),
    reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const TopUpSchema = z.object({
    amountCents: z.coerce.number().int().min(1).max(10_000_000),
});

export const ReviewSchema = z.object({
    taskId: z.string().uuid(),
    revieweeId: z.string().uuid(),
    stars: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(300).optional().or(z.literal("")),
});

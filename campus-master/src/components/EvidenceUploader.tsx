"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_FILES = 3;
const MAX_MB = 5;

function sanitizeFilename(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function splitFilename(name: string) {
    const safeName = sanitizeFilename(name);
    const dotIndex = safeName.lastIndexOf(".");
    if (dotIndex <= 0) {
        return { base: safeName || "evidence", ext: "png" };
    }

    return {
        base: safeName.slice(0, dotIndex) || "evidence",
        ext: safeName.slice(dotIndex + 1) || "png",
    };
}

export default function EvidenceUploader({
    taskId,
    disabled,
}: {
    taskId: string;
    disabled?: boolean;
}) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paths, setPaths] = useState<string[]>([]);

    async function onPickFiles(files: FileList | null) {
        if (!files || files.length === 0) return;

        setError(null);

        const availableSlots = MAX_FILES - paths.length;
        if (availableSlots <= 0) {
            setError(`最多只能上传 ${MAX_FILES} 张图片。`);
            return;
        }

        const picked = Array.from(files).slice(0, availableSlots);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setError("未登录，无法上传。");
            return;
        }

        setBusy(true);
        try {
            const newPaths: string[] = [];

            for (const file of picked) {
                if (!file.type.startsWith("image/")) {
                    throw new Error("仅支持图片文件。");
                }

                if (file.size > MAX_MB * 1024 * 1024) {
                    throw new Error(`图片大小不能超过 ${MAX_MB}MB。`);
                }

                const { base, ext } = splitFilename(file.name);
                const uniqueId =
                    typeof crypto.randomUUID === "function"
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const objectPath = `${taskId}/${user.id}/${uniqueId}-${base}.${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from("task-evidence")
                    .upload(objectPath, file, {
                        upsert: false,
                        contentType: file.type,
                    });

                if (uploadError) throw uploadError;
                newPaths.push(objectPath);
            }

            setPaths((prev) => [...prev, ...newPaths].slice(0, MAX_FILES));
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "上传失败");
        } finally {
            setBusy(false);
        }
    }

    function removePath(p: string) {
        setPaths((prev) => prev.filter((x) => x !== p));
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-col gap-2">
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={busy || disabled || paths.length >= MAX_FILES}
                    onChange={(e) => {
                        const input = e.currentTarget;
                        void onPickFiles(input.files).finally(() => {
                            input.value = "";
                        });
                    }}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-100"
                />
                <div className="text-xs text-slate-500">
                    最多 {MAX_FILES} 张，每张 ≤ {MAX_MB}MB
                </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            {paths.length ? (
                <ul className="space-y-1 text-sm text-slate-600">
                    {paths.map((p) => (
                        <li key={p} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                            <span className="truncate">{p}</span>
                            <button
                                type="button"
                                className="soft-link shrink-0 text-xs"
                                onClick={() => removePath(p)}
                                disabled={busy || disabled}
                            >
                                移除
                            </button>
                            <input type="hidden" name="imagePath" value={p} />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-slate-500">未上传图片（可只提交文字凭证）。</p>
            )}

            {busy ? <p className="text-xs text-slate-500">上传中…</p> : null}
        </div>
    );
}

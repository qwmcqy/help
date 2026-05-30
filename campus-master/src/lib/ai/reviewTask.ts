export type AiRiskLevel =
    | "pending"
    | "low"
    | "medium"
    | "high"
    | "skipped"
    | "error";

export type AiAuditResult = {
    riskLevel: AiRiskLevel;
    reason: string;
    flagged: boolean;
    categories: string[];
    evidence: string[];
    suggestedAction: "allow" | "review" | "reject";
    raw?: unknown;
};

type ModelAuditJson = {
    flagged: boolean;
    riskLevel: "low" | "medium" | "high";
    categories: string[];
    reason: string;
    evidence: string[];
    suggestedAction: "allow" | "review" | "reject";
};

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const API_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
const PROVIDER = API_BASE_URL.includes("deepseek") ? "deepseek" : "openai-compatible";
const USE_OPENAI_RESPONSES = API_BASE_URL === "https://api.openai.com";

function safeJsonParse(text: string): unknown | null {
    const trimmed = text.trim();
    const withoutFence = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");

    try {
        return JSON.parse(withoutFence);
    } catch {
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readPath(value: unknown, path: Array<string | number>): unknown {
    let current = value;
    for (const key of path) {
        if (typeof key === "number") {
            if (!Array.isArray(current)) return undefined;
            current = current[key];
            continue;
        }

        if (!isRecord(current)) return undefined;
        current = current[key];
    }
    return current;
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

function toModelAuditJson(value: unknown): ModelAuditJson | null {
    if (!isRecord(value)) return null;

    const riskLevel = value.riskLevel;
    const suggestedAction = value.suggestedAction;
    const reason = value.reason;
    const flagged = value.flagged;

    if (
        typeof flagged !== "boolean" ||
        !(riskLevel === "low" || riskLevel === "medium" || riskLevel === "high") ||
        !(suggestedAction === "allow" || suggestedAction === "review" || suggestedAction === "reject") ||
        typeof reason !== "string"
    ) {
        return null;
    }

    return {
        flagged,
        riskLevel,
        categories: stringArray(value.categories),
        reason,
        evidence: stringArray(value.evidence),
        suggestedAction,
    };
}

function normalizeAudit(audit: ModelAuditJson, providerResponse: unknown): AiAuditResult {
    const categoryText = audit.categories.length
        ? `命中类别：${audit.categories.join("、")}。`
        : "未命中明确违规类别。";
    const evidenceText = audit.evidence.length
        ? `依据：${audit.evidence.join("；")}`
        : "";

    return {
        riskLevel: audit.riskLevel,
        flagged: audit.flagged,
        categories: audit.categories,
        evidence: audit.evidence,
        suggestedAction: audit.suggestedAction,
        reason: [audit.reason, categoryText, evidenceText].filter(Boolean).join("\n"),
        raw: {
            audit,
            model: MODEL,
            provider: PROVIDER,
            baseUrl: API_BASE_URL,
            response: providerResponse,
        },
    };
}

function parseAuditFromResponse(response: unknown): AiAuditResult | null {
    const text =
        readPath(response, ["output", 0, "content", 0, "text"]) ??
        readPath(response, ["output_text"]) ??
        readPath(response, ["output", "text"]) ??
        readPath(response, ["choices", 0, "message", "content"]);

    if (typeof text !== "string") return null;

    const parsed = safeJsonParse(text);
    const audit = toModelAuditJson(parsed);
    return audit ? normalizeAudit(audit, response) : null;
}

function skippedResult(): AiAuditResult {
    return {
        riskLevel: "skipped",
        flagged: false,
        categories: [],
        evidence: [],
        suggestedAction: "review",
        reason: "未配置 OPENAI_API_KEY，已跳过 AI 辅助审核。",
    };
}

function errorResult(reason: string, raw?: unknown): AiAuditResult {
    return {
        riskLevel: "error",
        flagged: false,
        categories: [],
        evidence: [],
        suggestedAction: "review",
        reason,
        raw,
    };
}

function providerErrorMessage(raw: unknown): string | null {
    const directMessage = readPath(raw, ["error", "message"]);
    const nestedMessage = readPath(raw, ["response", "error", "message"]);

    const message = typeof directMessage === "string"
        ? directMessage
        : typeof nestedMessage === "string"
            ? nestedMessage
            : null;

    if (!message) return null;
    if (/insufficient balance/i.test(message)) {
        return "DeepSeek API 余额不足，请先充值或开通可用额度。";
    }
    return message;
}

function requestFailedResult(raw: unknown): AiAuditResult {
    const detail = providerErrorMessage(raw);
    return errorResult(
        detail
            ? `AI 审核请求失败：${detail}`
            : "AI 审核请求失败，请检查模型 API 配置。",
        raw,
    );
}

export async function reviewTaskTextWithAI(input: {
    title: string;
    description: string;
}): Promise<AiAuditResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return skippedResult();

    const system = [
        "你是校园互助任务平台的内容安全审核助手。",
        "请判断任务标题和描述是否包含违规、暴力、伤害、诈骗、色情、隐私泄露、违法交易、考试作弊、代考、危险物品交易等风险。",
        "只输出严格 JSON，不要输出 Markdown 或额外解释。",
    ].join("");

    const prompt = {
        taskTitle: input.title,
        taskDescription: input.description,
        outputSchema: {
            flagged: "boolean，是否发现明确违规/暴力/违法或高风险内容",
            riskLevel: "low | medium | high",
            categories: "string[]，例如 violence, illegal_trade, fraud, privacy, sexual, exam_cheating, self_harm, other",
            reason: "string，中文说明，简明指出判断原因",
            evidence: "string[]，从任务文本中提炼的风险片段或依据，不要编造",
            suggestedAction: "allow | review | reject",
        },
        rules: [
            "明确要求伤害、暴力威胁、违法交易、诈骗、色情服务、代考作弊等，riskLevel=high，suggestedAction=reject。",
            "语义不明确但可能涉及违规或人身风险，riskLevel=medium，suggestedAction=review。",
            "普通校园跑腿、代取、搬运、学习互助且无违规内容，riskLevel=low，suggestedAction=allow。",
            "reason 和 evidence 必须基于标题/描述文本，不要臆测用户未写出的事实。",
        ],
    };

    const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
    };

    if (USE_OPENAI_RESPONSES) {
        try {
            const r = await fetch(`${API_BASE_URL}/v1/responses`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    model: MODEL,
                    input: [
                        { role: "system", content: system },
                        { role: "user", content: JSON.stringify(prompt) },
                    ],
                    temperature: 0,
                }),
            });

            const json: unknown = await r.json();
            if (r.ok) {
                const result = parseAuditFromResponse(json);
                if (result) return result;
            }

            if (!r.ok) {
                return requestFailedResult(json);
            }
        } catch {
            // Fall back to Chat Completions for compatible OpenAI-style endpoints.
        }
    }

    try {
        const r = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: JSON.stringify(prompt) },
                ],
                temperature: 0,
            }),
        });

        const json: unknown = await r.json();
        if (!r.ok) {
            return requestFailedResult(json);
        }

        const result = parseAuditFromResponse(json);
        return result ?? errorResult("AI 返回格式无法解析，已转入人工复核。", json);
    } catch (e: unknown) {
        return errorResult(
            `AI 审核请求异常：${e instanceof Error ? e.message : "unknown"}`,
        );
    }
}

export const taskStatusOrder = [
    "open",
    "in_progress",
    "awaiting_acceptance",
    "disputed",
    "completed",
    "canceled",
] as const;

export type TaskStatus = (typeof taskStatusOrder)[number];

export function labelStatus(status: string) {
    switch (status) {
        case "open":
            return "待接单";
        case "in_progress":
            return "进行中";
        case "awaiting_acceptance":
            return "待验收";
        case "completed":
            return "已完成";
        case "canceled":
            return "已取消";
        case "disputed":
            return "争议中";
        default:
            return status;
    }
}

export function statusBadgeClass(status: string) {
    switch (status) {
        case "open":
            return "border-amber-200 bg-amber-50 text-amber-800";
        case "in_progress":
            return "border-sky-200 bg-sky-50 text-sky-800";
        case "awaiting_acceptance":
            return "border-indigo-200 bg-indigo-50 text-indigo-800";
        case "completed":
            return "border-teal-200 bg-teal-50 text-teal-800";
        case "canceled":
            return "border-slate-200 bg-slate-50 text-slate-600";
        case "disputed":
            return "border-rose-200 bg-rose-50 text-rose-800";
        default:
            return "border-slate-200 bg-white text-slate-700";
    }
}

export function statusAccentClass(status: string) {
    switch (status) {
        case "open":
            return "bg-amber-300";
        case "in_progress":
            return "bg-sky-300";
        case "awaiting_acceptance":
            return "bg-indigo-300";
        case "completed":
            return "bg-teal-300";
        case "disputed":
            return "bg-rose-300";
        case "canceled":
        default:
            return "bg-slate-300";
    }
}


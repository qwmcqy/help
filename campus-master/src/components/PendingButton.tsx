"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingButtonProps = {
    children: ReactNode;
    pendingText?: string;
    className?: string;
    name?: string;
    value?: string;
};

export default function PendingButton({
    children,
    pendingText = "处理中…",
    className = "btn-primary",
    name,
    value,
}: PendingButtonProps) {
    const { pending } = useFormStatus();

    return (
        <button
            name={name}
            value={value}
            disabled={pending}
            aria-busy={pending}
            className={className}
        >
            {pending ? pendingText : children}
        </button>
    );
}

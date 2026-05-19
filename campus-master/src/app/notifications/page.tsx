import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth?next=/notifications");
    }

    return <NotificationsClient />;
}

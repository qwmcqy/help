import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isProtectedPath(pathname: string) {
    return (
        pathname === "/tasks" ||
        pathname.startsWith("/tasks/") ||
        pathname === "/dashboard" ||
        pathname.startsWith("/dashboard/") ||
        pathname === "/admin" ||
        pathname.startsWith("/admin/") ||
        pathname === "/notifications" ||
        pathname.startsWith("/notifications/")
    );
}

export async function middleware(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        return response;
    }

    const supabase = createServerClient(url, anonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith("/auth")) {
        return response;
    }

    if (isProtectedPath(pathname) && !user) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/auth";
        redirectUrl.search = "";
        redirectUrl.searchParams.set(
            "next",
            `${pathname}${request.nextUrl.search}`,
        );
        return NextResponse.redirect(redirectUrl);
    }

    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function NearbyControl({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  function buildUrl(params: URLSearchParams) {
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function enableNearby() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("当前浏览器不支持定位。");
      return;
    }

    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("lat", pos.coords.latitude.toFixed(6));
        params.set("lng", pos.coords.longitude.toFixed(6));
        params.set("sort", "nearby");
        setLoading(false);
        router.push(buildUrl(params));
      },
      (err) => {
        setLoading(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "已拒绝定位授权，无法按距离排序。"
            : "获取位置失败，请稍后重试。",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function disableNearby() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lat");
    params.delete("lng");
    params.delete("sort");
    router.push(buildUrl(params));
  }

  return (
    <div className="flex flex-col gap-1">
      {active ? (
        <button type="button" onClick={disableNearby} className="btn-primary">
          ✓ 按距离排序中（点击取消）
        </button>
      ) : (
        <button
          type="button"
          onClick={enableNearby}
          disabled={loading}
          className="btn-secondary"
        >
          {loading ? "定位中…" : "📍 按距离排序"}
        </button>
      )}
      {error ? <span className="text-xs text-amber-600">{error}</span> : null}
    </div>
  );
}

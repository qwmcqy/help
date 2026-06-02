// Minimal, dependency-free GeoHash encoder.
// GeoHash interleaves longitude/latitude bits and maps every 5 bits to a
// base32 character. Nearby points share a common prefix, which lets us do
// cheap proximity pre-filtering with a simple `like 'prefix%'` query.

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encodeGeohash(
    lat: number,
    lng: number,
    precision = 8,
): string {
    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
    ) {
        throw new Error("Invalid coordinates");
    }

    let latMin = -90;
    let latMax = 90;
    let lngMin = -180;
    let lngMax = 180;

    let hash = "";
    let bit = 0;
    let ch = 0;
    let evenBit = true; // even bits encode longitude

    while (hash.length < precision) {
        if (evenBit) {
            const mid = (lngMin + lngMax) / 2;
            if (lng >= mid) {
                ch = (ch << 1) + 1;
                lngMin = mid;
            } else {
                ch = ch << 1;
                lngMax = mid;
            }
        } else {
            const mid = (latMin + latMax) / 2;
            if (lat >= mid) {
                ch = (ch << 1) + 1;
                latMin = mid;
            } else {
                ch = ch << 1;
                latMax = mid;
            }
        }

        evenBit = !evenBit;

        if (++bit === 5) {
            hash += BASE32[ch];
            bit = 0;
            ch = 0;
        }
    }

    return hash;
}

// Haversine distance in meters between two coordinates.
export function distanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters: number): string {
    if (!Number.isFinite(meters)) return "";
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
}

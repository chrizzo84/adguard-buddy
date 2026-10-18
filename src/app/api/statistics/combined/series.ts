/**
 * Rolls an hourly series up into days, grouping 24 buckets at a time from the
 * newest one backwards so the last entry stays the current bucket. The oldest
 * day may be partial.
 */
export function hoursToDays(hourly: number[]): number[] {
    const days: number[] = [];
    for (let end = hourly.length; end > 0; end -= 24) {
        days.unshift(hourly.slice(Math.max(0, end - 24), end).reduce((sum, v) => sum + (v || 0), 0));
    }
    return days;
}

/**
 * Sums series bucket by bucket. AdGuard Home returns them oldest to newest,
 * so they are aligned at the newest bucket: arrays of different lengths would
 * otherwise mix different time ranges in one bucket.
 */
export function sumAlignedAtEnd(series: number[][]): number[] {
    const maxLen = Math.max(...series.map(arr => arr.length), 0);
    const result: number[] = new Array(maxLen).fill(0);
    for (const arr of series) {
        const offset = maxLen - arr.length;
        for (let i = 0; i < arr.length; i++) {
            result[offset + i] += arr[i] || 0;
        }
    }
    return result;
}

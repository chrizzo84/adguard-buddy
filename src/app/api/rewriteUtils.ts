import { components } from '../../types/adguard';

/**
 * Normalize rewrites by removing version-specific fields
 * 
 * Newer AdGuard versions include an 'enabled' field in rewrite responses,
 * but it's not documented in the official API type definition. This can cause
 * version compatibility issues when master and replica run different versions.
 * 
 * This utility removes undocumented fields to ensure consistent rewrite objects
 * across different AdGuard versions.
 * 
 * @param rewrites - Array of rewrite entries (can be from any source)
 * @returns Normalized rewrites with version-specific fields removed
 */
export function normalizeRewrites(rewrites: unknown[]): components['schemas']['RewriteList'] {
    return rewrites.map((item) => {
        if (typeof item === 'object' && item !== null) {
            const rewrite = item as Record<string, unknown>;
            const normalized: Record<string, unknown> = { ...rewrite };
            
            // Remove version-specific fields that may be present in newer AdGuard versions
            delete normalized.enabled;
            
            return normalized as components['schemas']['RewriteEntry'];
        }
        // Fallback for non-object items (shouldn't happen in normal cases)
        return item as components['schemas']['RewriteEntry'];
    });
}

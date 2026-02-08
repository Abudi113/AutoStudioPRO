// Supabase client configuration
// This will be used for Edge Functions, Auth, and Database in the future

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase credentials not configured. Some features may not work.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Call a Supabase Edge Function
 */
export async function callEdgeFunction<T = any>(
    functionName: string,
    payload: Record<string, any>
): Promise<T> {
    // Add cache-busting timestamp to force using latest deployed version
    const timestamp = Date.now();
    const url = `${SUPABASE_URL}/functions/v1/${functionName}?v=${timestamp}`;

    console.log('🌐 Calling edge function:', url);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `Edge function failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };

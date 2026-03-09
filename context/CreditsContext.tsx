import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../services/supabaseClient';
import { useAuth } from './AuthContext';

interface CreditsContextType {
    totalCredits: number;
    loading: boolean;
    refreshCredits: () => Promise<void>;
    deductCredit: () => Promise<{ success: boolean }>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

/**
 * Get the access token from localStorage (bypasses supabase-js client issues)
 */
function getAccessToken(): string | null {
    try {
        const keys = Object.keys(localStorage);
        const sbKey = keys.find(k => k.startsWith('sb-'));
        if (!sbKey) return null;
        const raw = localStorage.getItem(sbKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.access_token || parsed?.currentSession?.access_token || null;
    } catch {
        return null;
    }
}

/**
 * Fetch credits via direct REST call
 */
async function fetchCreditsDirectly(userId: string): Promise<number> {
    try {
        const token = getAccessToken();
        if (!token) {
            console.warn('[Credits] No access token found');
            return 0;
        }

        const url = `${SUPABASE_URL}/rest/v1/profiles?select=credits_monthly,credits_purchased,credits_vault&id=eq.${userId}`;
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!res.ok) {
            console.error('[Credits] API error:', res.status);
            return 0;
        }

        const rows = await res.json();
        const row = rows?.[0];
        return (row?.credits_monthly ?? 0) + (row?.credits_purchased ?? 0) + (row?.credits_vault ?? 0);
    } catch (err) {
        console.error('[Credits] Fetch error:', err);
        return 0;
    }
}

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [totalCredits, setTotalCredits] = useState(0);
    const [loading, setLoading] = useState(false);

    const refreshCredits = async () => {
        const uid = user?.id;
        if (!uid) {
            setTotalCredits(0);
            return;
        }

        setLoading(true);
        try {
            let credits = await fetchCreditsDirectly(uid);

            // Retry once if 0 (DB trigger may still be committing)
            if (credits === 0) {
                await new Promise(r => setTimeout(r, 2000));
                credits = await fetchCreditsDirectly(uid);
            }

            setTotalCredits(credits);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshCredits();
    }, [user?.id]);

    const deductCredit = async (): Promise<{ success: boolean }> => {
        if (!user) return { success: false };

        try {
            const token = getAccessToken();
            if (!token) return { success: false };

            // Call deduct_credits RPC via direct fetch
            const url = `${SUPABASE_URL}/rest/v1/rpc/deduct_credits`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: '{}',
            });

            if (!res.ok) {
                console.error('[Credits] Deduct API error:', res.status);
                return { success: false };
            }

            const data = await res.json();
            if (data?.success) {
                await refreshCredits();
                return { success: true };
            }

            return { success: false };
        } catch (err) {
            console.error('[Credits] Deduct error:', err);
            return { success: false };
        }
    };

    return (
        <CreditsContext.Provider value={{
            totalCredits,
            loading,
            refreshCredits,
            deductCredit,
        }}>
            {children}
        </CreditsContext.Provider>
    );
};

export const useCredits = () => {
    const context = useContext(CreditsContext);
    if (!context) throw new Error('useCredits must be used within a CreditsProvider');
    return context;
};

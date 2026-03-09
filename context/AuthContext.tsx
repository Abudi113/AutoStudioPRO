
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

export interface UserProfile {
    username: string;
    car_inventory: number;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string) => Promise<{ error: any }>;          // magic link (OTP)
    signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
    signUp: (email: string, password: string, username: string, carInventory: number) => Promise<{ error: any }>;
    signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string, userMeta?: Record<string, any>): Promise<UserProfile | null> {
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, car_inventory')
            .eq('id', userId)
            .single();
        if (data) return data;
    } catch (err) {
        console.warn('[Auth] fetchProfile error, will use metadata fallback:', err);
    }

    // Fall back to user_metadata (set during signUp before email confirmation)
    if (userMeta?.username) {
        return { username: userMeta.username, car_inventory: userMeta.car_inventory ?? 0 };
    }
    return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Safety timeout: if Supabase is blocked (e.g. by Opera GX's ad-blocker),
        // stop the loading state after 3s so the app still renders.
        const timeout = setTimeout(() => setLoading(false), 3000);

        supabase.auth.getSession().then(({ data: { session } }) => {
            clearTimeout(timeout);
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.user_metadata).then(setProfile);
            }
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                const p = await fetchProfile(session.user.id, session.user.user_metadata);
                setProfile(p);
            } else {
                setProfile(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    /** Send a magic-link / OTP email */
    const signIn = async (email: string) => {
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        return { error };
    };

    /** Sign in with email + password */
    const signInWithPassword = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    };

    /** Register a new account — stores extra fields in user_metadata so they're
     *  immediately available even before email confirmation (no separate DB insert
     *  needed, which avoids RLS rejections on unconfirmed sessions). */
    const signUp = async (
        email: string,
        password: string,
        username: string,
        carInventory: number
    ) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth`,
                data: { username, car_inventory: carInventory },
            },
        });
        if (error) return { error };

        // Write to profiles table with 5 free credits BEFORE auto-login
        const userId = data.user?.id;
        if (userId) {
            await supabase.from('profiles').upsert({
                id: userId,
                username,
                car_inventory: carInventory,
                credits_purchased: 5,
                credits: 5,
            });
        }

        // Auto-login immediately after registration
        const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (loginError) return { error: loginError };

        return { error: null };
    };

    const signOut = async () => {
        // Force-clear all Supabase session keys from localStorage immediately.
        // This makes sign-out work even when Opera GX's tracker blocker prevents
        // the network call from reaching Supabase.
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) localStorage.removeItem(key);
            });
        } catch (_) { }

        // Reset local state right away so the UI reacts instantly.
        setUser(null);
        setSession(null);
        setProfile(null);

        // Redirect to homepage BEFORE the supabase call (which may hang)
        window.location.href = '/';

        // Best-effort API call — may be blocked or hang, but session is already cleared
        try { supabase.auth.signOut(); } catch (_) { }

        return { error: null };
    };

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, signIn, signInWithPassword, signUp, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
};

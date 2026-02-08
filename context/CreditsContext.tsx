import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';

interface CreditsContextType {
    creditsMonthly: number;
    creditsPurchased: number;
    creditsVault: number;
    totalCredits: number;
    expiryDate: string | null;
    loading: boolean;
    refreshCredits: () => Promise<void>;
    deductCredit: () => Promise<{ success: boolean; pool?: string }>;
    moveToVault: (amount: number) => Promise<boolean>;
    moveFromVault: (amount: number) => Promise<boolean>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [creditsMonthly, setCreditsMonthly] = useState(0);
    const [creditsPurchased, setCreditsPurchased] = useState(0);
    const [creditsVault, setCreditsVault] = useState(0);
    const [expiryDate, setExpiryDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const totalCredits = creditsMonthly + creditsPurchased + creditsVault;

    const refreshCredits = async () => {
        if (!user) {
            setCreditsPurchased(5); // Guest default
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('credits_monthly, credits_purchased, credits_vault, credits_purchased_expiry')
            .eq('id', user.id)
            .single();

        if (data) {
            setCreditsMonthly(data.credits_monthly);
            setCreditsPurchased(data.credits_purchased);
            setCreditsVault(data.credits_vault);
            setExpiryDate(data.credits_purchased_expiry);
        } else if (error) {
            console.error('Error fetching credits:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        refreshCredits();
    }, [user]);

    const deductCredit = async () => {
        if (!user) return { success: false };

        const { data, error } = await supabase.rpc('deduct_credits');

        if (error) {
            console.error('Error deducting credit:', error);
            return { success: false };
        }

        if (data?.success) {
            await refreshCredits(); // Sync full state after deduction
            return { success: true, pool: data.pool };
        }

        return { success: false };
    };

    const moveToVault = async (amount: number) => {
        if (!user) return false;

        // Try positive amount for move_to_vault
        const { data, error } = await supabase.rpc('move_to_vault', {
            amount
        });

        if (error || !data) {
            console.error('Error moving to vault:', error);
            return false;
        }

        await refreshCredits();
        return true;
    };

    const moveFromVault = async (amount: number) => {
        if (!user) return false;

        // Try calling move_from_vault
        const { data, error } = await supabase.rpc('move_from_vault', {
            amount
        });

        if (error) {
            console.error('Error moving from vault:', error);
            return false;
        }

        await refreshCredits();
        return true;
    };

    return (
        <CreditsContext.Provider value={{
            creditsMonthly,
            creditsPurchased,
            creditsVault,
            totalCredits,
            expiryDate,
            loading,
            refreshCredits,
            deductCredit,
            moveToVault,
            moveFromVault
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

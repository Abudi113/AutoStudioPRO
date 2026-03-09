
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/** Redirects unauthenticated users to /?auth=1 so the AuthModal opens automatically */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return null; // wait for session check before deciding

    if (!user) {
        // Preserve the intended destination so we can redirect back after login
        return <Navigate to={`/?auth=1&next=${encodeURIComponent(location.pathname)}`} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;


import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Placeholder redirect
        setTimeout(() => navigate('/dashboard'), 1500);
    }, []);

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <p>Authenticating...</p>
        </div>
    );
};

export default AuthCallback;

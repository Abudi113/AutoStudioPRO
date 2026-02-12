import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CreateTool from '../components/CreateTool.tsx';
import LandingPage from '../components/LandingPage.tsx';
import AuthCallback from '../components/AuthCallback.tsx';

import ContactPage from '../components/ContactPage.tsx';
import AboutPage from '../components/AboutPage.tsx';
import Layout from '../components/Layout.tsx';

import ScrollToTop from '../components/ScrollToTop.tsx';

// Placeholder for Dashboard (Order History)
const DashboardPlaceholder = () => (
    <div className="p-10 text-white bg-black min-h-screen">
        <h1 className="text-2xl mb-4">Your Dashboard</h1>
        <p>Order history coming soon...</p>
        <a href="/create" className="text-blue-400 hover:underline">Create New Project</a>
    </div>
);

const AppRoutes: React.FC = () => {
    return (
        <BrowserRouter>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<Layout><LandingPage /></Layout>} />
                <Route path="/about" element={<Layout><AboutPage /></Layout>} />

                <Route path="/contact" element={<Layout><ContactPage /></Layout>} />
                <Route path="/auth" element={<AuthCallback />} />
                <Route path="/dashboard" element={<Layout><CreateTool /></Layout>} />
                {/* The existing App is now the "Create" tool */}
                <Route path="/create" element={<Layout><CreateTool /></Layout>} />
                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
};

export default AppRoutes;

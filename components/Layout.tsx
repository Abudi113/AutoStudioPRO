
import React from 'react';
import Navbar from './Navbar';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300 font-sans selection:bg-blue-500/30">
            <Navbar />
            <main className="pt-16 min-h-screen flex flex-col relative z-0">
                {children}
            </main>
        </div>
    );
};

export default Layout;

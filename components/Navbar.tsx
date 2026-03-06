import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Camera, Sun, Moon, LogOut, User, Menu, X, Globe, CreditCard, LayoutDashboard, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCredits } from '../context/CreditsContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import VaultModal from './VaultModal';
import AppTokenModal from './AppTokenModal';
import AuthModal from './AuthModal';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar: React.FC = () => {
    const { user, signOut } = useAuth();
    const { totalCredits } = useCredits();
    const { theme, toggleTheme } = useTheme();
    const { language, setLanguage, t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [showVault, setShowVault] = useState(false);
    const [showAppToken, setShowAppToken] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const location = useLocation();

    // Handle hash navigation on mount
    useEffect(() => {
        if (location.hash) {
            setTimeout(() => {
                const id = location.hash.replace('#', '');
                const element = document.getElementById(id);
                if (element) {
                    element.scrollIntoView({ behavior: 'auto', block: 'start' });
                }
            }, 0);
        }
    }, [location]);

    const isActive = (path: string) => location.pathname === path;

    const handleHowItWorksClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (location.pathname === '/') {
            e.preventDefault();
            const element = document.getElementById('how-it-works');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    const navLinks = [
        { name: t('home'), path: '/' },
        { name: t('howItWorks'), path: '/#how-it-works', onClick: handleHowItWorksClick },
        { name: t('aboutUs'), path: '/about' },
        { name: t('contact'), path: '/contact' },
    ];

    const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    ];

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] transition-colors duration-300">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        {/* Logo */}
                        <Link to="/" className="flex items-center">
                            <img
                                src="/logo.png"
                                alt="Carveo Logo"
                                className="h-14 w-auto object-contain brightness-125 contrast-110 drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]"
                                style={{ minWidth: '160px' }}
                            />
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-8">
                            {navLinks.map((link) => {
                                // Links with hashes (like /#how-it-works) should never be marked as active
                                const hasHash = link.path.includes('#');
                                const isLinkActive = !hasHash && isActive(link.path);

                                return (
                                    <Link
                                        key={link.name}
                                        to={link.path}
                                        onClick={(link as any).onClick}
                                        className={`text-base font-medium transition-colors hover:text-blue-500 ${isLinkActive ? 'text-blue-500' : 'opacity-70'}`}
                                    >
                                        {link.name}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center gap-5">
                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="p-2.5 rounded-lg hover:bg-gray-500/10 transition-colors"
                                title={theme === 'dark' ? t('lightMode') : t('darkMode')}
                            >
                                {theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                            </button>

                            {/* Language Selector */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsLangOpen(!isLangOpen)}
                                    className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-500/10 transition-colors"
                                >
                                    <Globe className="w-6 h-6" />
                                    <span className="text-sm uppercase font-bold">{language}</span>
                                </button>
                                <AnimatePresence>
                                    {isLangOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute right-0 mt-2 w-40 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl py-2 z-50"
                                        >
                                            {languages.map((lang) => (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => {
                                                        setLanguage(lang.code as any);
                                                        setIsLangOpen(false);
                                                    }}
                                                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-base text-left hover:bg-blue-500/10 transition-colors ${language === lang.code ? 'text-blue-500 font-bold' : ''}`}
                                                >
                                                    <span>{lang.flag}</span>
                                                    {lang.name}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="h-6 w-px bg-[var(--border)] mx-2" />

                            {user ? (
                                <>
                                    <Link to="/create">
                                        <button className="flex items-center gap-2 px-5 py-2.5 text-base font-medium transition-colors hover:text-blue-500">
                                            <LayoutDashboard className="w-5 h-5" />
                                            {t('dashboard')}
                                        </button>
                                    </Link>
                                    <button
                                        onClick={() => setShowVault(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer"
                                    >
                                        <CreditCard className="w-4 h-4 text-blue-500" />
                                        <span className="text-sm font-bold text-blue-500">{totalCredits}</span>
                                    </button>
                                    <div className="h-6 w-px bg-[var(--border)] mx-2" />
                                    <div className="relative group">
                                        <button className="p-2.5 rounded-full hover:bg-gray-500/10 transition-colors">
                                            <User className="w-6 h-6" />
                                        </button>
                                        <div className="absolute right-0 mt-2 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right">
                                            <div className="py-2">
                                                <button
                                                    onClick={() => setShowAppToken(true)}
                                                    className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-base hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                                                >
                                                    <Smartphone className="w-4 h-4" />
                                                    Mobile App Access
                                                </button>
                                                <div className="border-t border-[var(--border)] my-1" />
                                                <button
                                                    onClick={() => signOut()}
                                                    className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-base hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                    {t('signOut')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setAuthMode('login'); setShowAuth(true); }}
                                        className="px-6 py-2.5 text-base font-bold text-gray-700 dark:text-gray-300 hover:text-blue-500 transition-colors"
                                    >
                                        {t('login')}
                                    </button>
                                    <button
                                        onClick={() => { setAuthMode('register'); setShowAuth(true); }}
                                        className="px-6 py-2.5 text-base font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
                                    >
                                        {t('register')}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center gap-2">
                            <button
                                onClick={toggleTheme}
                                className="p-2.5 rounded-lg hover:bg-gray-500/10 transition-colors"
                            >
                                {theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                            </button>
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="p-2.5 transition-colors overflow-hidden"
                            >
                                {isOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden bg-[var(--card)] border-b border-[var(--border)] overflow-hidden"
                        >
                            <div className="px-4 pt-2 pb-6 space-y-2">
                                {navLinks.map((link) => {
                                    // Links with hashes (like /#how-it-works) should never be marked as active
                                    const hasHash = link.path.includes('#');
                                    const isLinkActive = !hasHash && isActive(link.path);

                                    return (
                                        <Link
                                            key={link.name}
                                            to={link.path}
                                            onClick={(e) => {
                                                if ((link as any).onClick) {
                                                    (link as any).onClick(e);
                                                }
                                                setIsOpen(false);
                                            }}
                                            className={`block px-3 py-2 text-base font-medium rounded-xl hover:bg-blue-500/10 transition-colors ${isLinkActive ? 'text-blue-500 bg-blue-500/10' : ''}`}
                                        >
                                            {link.name}
                                        </Link>
                                    );
                                })}

                                <div className="border-t border-[var(--border)] my-4 pt-4 space-y-4">
                                    <div className="flex items-center justify-between px-3">
                                        <span className="text-sm font-medium opacity-70">Language</span>
                                        <div className="flex gap-2">
                                            {languages.map(l => (
                                                <button
                                                    key={l.code}
                                                    onClick={() => setLanguage(l.code as any)}
                                                    className={`p-1.5 rounded-lg border ${language === l.code ? 'border-blue-500 bg-blue-500/10' : 'border-[var(--border)]'}`}
                                                >
                                                    {l.flag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {user ? (
                                        <>
                                            <Link
                                                to="/create"
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-2 px-3 py-2 text-base font-medium opacity-70 hover:opacity-100 rounded-xl"
                                            >
                                                <LayoutDashboard className="w-5 h-5" />
                                                {t('dashboard')}
                                            </Link>
                                            <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 rounded-xl">
                                                <span className="text-sm font-medium">{t('credits')}</span>
                                                <span className="text-blue-500 font-bold">{totalCredits}</span>
                                            </div>
                                            <button
                                                onClick={() => { setShowAppToken(true); setIsOpen(false); }}
                                                className="flex items-center gap-2 w-full text-left px-3 py-2 text-base font-medium opacity-70 hover:opacity-100 rounded-xl"
                                            >
                                                <Smartphone className="w-5 h-5" />
                                                Mobile App Access
                                            </button>
                                            <button
                                                onClick={() => { signOut(); setIsOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-base font-medium text-red-500 hover:bg-red-500/10 rounded-xl"
                                            >
                                                {t('signOut')}
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col gap-3 px-3">
                                            <button
                                                onClick={() => { setAuthMode('login'); setShowAuth(true); setIsOpen(false); }}
                                                className="w-full py-3 text-center text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                                            >
                                                {t('login')}
                                            </button>
                                            <button
                                                onClick={() => { setAuthMode('register'); setShowAuth(true); setIsOpen(false); }}
                                                className="w-full py-3 text-center text-sm font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
                                            >
                                                {t('register')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </nav>

            <VaultModal isOpen={showVault} onClose={() => setShowVault(false)} />
            <AppTokenModal isOpen={showAppToken} onClose={() => setShowAppToken(false)} />
            <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} initialMode={authMode} />
        </>
    );
};

export default Navbar;

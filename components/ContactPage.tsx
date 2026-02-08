
import React from 'react';
import { Mail, MessageSquare, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

const ContactPage: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pt-24 pb-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-[var(--foreground)]">
                        {t('getInTouch')}
                    </h1>
                    <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium">
                        {t('contactSubtitle')}
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <div className="space-y-8">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-lg"
                        >
                            <h3 className="text-2xl font-bold mb-6 text-[var(--foreground)]">{t('contactInfo')}</h3>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <Mail className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-[var(--foreground)]">{t('emailUs')}</h4>
                                        <p className="text-gray-400 mt-1">{t('needsUpdate')}</p>
                                        <p className="text-sm text-gray-500 mt-1">{t('responseTwoHours')}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <MessageSquare className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-[var(--foreground)]">{t('liveSupport')}</h4>
                                        <p className="text-gray-400 mt-1">{t('needsUpdate')}</p>
                                        <p className="text-sm text-gray-500 mt-1">{t('availableHours')}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <MapPin className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-[var(--foreground)]">{t('office')}</h4>
                                        <p className="text-gray-400 mt-1">{t('needsUpdate')}</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Simple Form Placeholder */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 shadow-lg"
                    >
                        <form className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-2">{t('labelName')}</label>
                                <input
                                    type="text"
                                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder={t('yourName')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-2">{t('labelEmail')}</label>
                                <input
                                    type="email"
                                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder={t('yourEmail')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-2">{t('labelMessage')}</label>
                                <textarea
                                    rows={4}
                                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder={t('messagePlaceholder')}
                                />
                            </div>
                            <button className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-500/20 text-white">
                                {t('sendMessage')}
                            </button>
                        </form>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Check, ShieldCheck, Rocket, Zap, Crosshair } from 'lucide-react';
import { submitDemoRequest } from '../services/demoRequestService';

const ContactPage: React.FC = () => {
    const { t, language } = useLanguage();
    const { theme } = useTheme();
    const [stockLevel, setStockLevel] = useState('251+');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        phone: '',
        website: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const steps = [
        { num: '1', title: 'contactStep1Title', desc: 'contactStep1Desc' },
        { num: '2', title: 'contactStep2Title', desc: 'contactStep2Desc' },
        { num: '3', title: 'contactStep3Title', desc: 'contactStep3Desc' },
    ];

    const features = [
        'contactIncluded1',
        'contactIncluded2',
        'contactIncluded3',
        'contactIncluded4',
        'contactIncluded5',
    ];

    const inputClass = `w-full px-6 py-4 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white' : 'bg-zinc-800/50 border-white/10 text-white focus:bg-zinc-800'}`;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitMessage(null);
        setSubmitError(null);
        setIsSubmitting(true);

        try {
            await submitDemoRequest({
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                company: formData.company,
                phone: formData.phone,
                website: formData.website,
                stockLevel,
                source: 'contact_page',
                language,
            });

            setSubmitMessage(t('contactFormSuccess'));
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                company: '',
                phone: '',
                website: '',
            });
            setStockLevel('251+');
        } catch {
            setSubmitError(t('contactFormError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`min-h-screen flex flex-col transition-colors duration-300 ${theme === 'light' ? 'bg-white text-gray-900' : 'bg-zinc-900 text-white'}`}>
            <div className="flex-grow flex flex-col justify-center pt-32 pb-20 px-4">
                <div className="max-w-7xl mx-auto w-full">
                    <div className="text-center mb-20 max-w-5xl mx-auto">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-5xl md:text-7xl font-black mb-8 tracking-tighter"
                        >
                            {t('contactTitle')}
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className={`text-xl md:text-2xl leading-relaxed ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}
                        >
                            {t('contactSubtitle')}
                        </motion.p>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h3 className="text-3xl font-bold mb-10">{t('contactNextStepsTitle')}</h3>

                            <div className="space-y-10 mb-16">
                                {steps.map((step, i) => (
                                    <div key={i} className="flex gap-6">
                                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-white/10 text-white'}`}>
                                            {step.num}
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold mb-2">{t(step.title)}</h4>
                                            <p className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>{t(step.desc)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className={`p-8 rounded-3xl border ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-[#0a0a0a] border-white/10'}`}>
                                <h4 className="text-xl font-bold mb-6">{t('contactIncludedTitle')}</h4>
                                <ul className="grid md:grid-cols-2 gap-4">
                                    {features.map((key, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className={`text-sm md:text-base ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                                                {t(key)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className={`rounded-[2.5rem] p-8 md:p-10 shadow-2xl ${theme === 'light' ? 'bg-white text-gray-900' : 'bg-[#0a0a0a] text-white border border-white/10'}`}
                        >
                            <h3 className="text-3xl font-bold mb-8 text-center">{t('contactFormTitle')}</h3>

                            <form className="space-y-5" onSubmit={handleSubmit}>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        name="firstName"
                                        placeholder={t('contactFormFirstName')}
                                        className={inputClass}
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <input
                                        type="text"
                                        name="lastName"
                                        placeholder={t('contactFormLastName')}
                                        className={inputClass}
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder={t('contactFormEmail')}
                                        className={inputClass}
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <input
                                        type="text"
                                        name="company"
                                        placeholder={t('contactFormCompany')}
                                        className={inputClass}
                                        value={formData.company}
                                        onChange={handleInputChange}
                                    />
                                    <input
                                        type="tel"
                                        name="phone"
                                        placeholder={t('contactFormPhone')}
                                        className={inputClass}
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="pt-4">
                                    <label className="block text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{t('contactFormStock')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['251+', '101-250', '61-100', '31-60', '0-30'].map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setStockLevel(opt)}
                                                className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${stockLevel === opt ? 'bg-blue-600 text-white border-blue-600' : (theme === 'light' ? 'bg-white text-gray-600 border-gray-200 hover:border-gray-400' : 'bg-zinc-800 text-gray-300 border-white/10 hover:bg-zinc-700')}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <input
                                    type="url"
                                    name="website"
                                    placeholder={t('contactFormWebsite')}
                                    className={inputClass}
                                    value={formData.website}
                                    onChange={handleInputChange}
                                />

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold text-xl rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    {isSubmitting ? t('contactFormSubmitting') : t('contactFormButton')}
                                </button>
                                {submitMessage && (
                                    <p className="text-sm text-green-600 font-medium">{submitMessage}</p>
                                )}
                                {submitError && (
                                    <p className="text-sm text-red-500 font-medium">{submitError}</p>
                                )}
                            </form>
                        </motion.div>
                    </div>
                </div>
            </div>

            <div className={`py-24 px-4 border-t ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-black border-white/10'}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { icon: ShieldCheck, title: 'contactBadge1Title', sub: 'contactBadge1Sub', desc: 'contactBadge1Desc' },
                            { icon: Rocket, title: 'contactBadge2Title', sub: 'contactBadge2Sub', desc: 'contactBadge2Desc' },
                            { icon: Zap, title: 'contactBadge3Title', sub: 'contactBadge3Sub', desc: 'contactBadge3Desc' },
                            { icon: Crosshair, title: 'contactBadge4Title', sub: 'contactBadge4Sub', desc: 'contactBadge4Desc' },
                        ].map((badge, i) => (
                            <div key={i} className="flex flex-col items-start gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400'}`}>
                                    <badge.icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className={`font-bold text-lg mb-1 leading-tight ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{t(badge.title)}</h4>
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>{t(badge.sub)}</p>
                                    <p className={`text-sm leading-relaxed ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>{t(badge.desc)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;

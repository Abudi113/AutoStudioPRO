
import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const PrivacyPolicyPage: React.FC = () => {
    const { theme } = useTheme();
    const bg = theme === 'light' ? 'bg-white' : 'bg-[#0a0a0a]';
    const cardBg = theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-zinc-900 border-white/10';
    const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
    const textBody = theme === 'light' ? 'text-gray-600' : 'text-gray-400';
    const textMuted = theme === 'light' ? 'text-gray-500' : 'text-gray-500';
    const linkColor = 'text-blue-500 hover:text-blue-400';
    const divider = theme === 'light' ? 'border-gray-200' : 'border-white/10';

    const sections = [
        {
            num: '1',
            title: 'Data Controller',
            content: (
                <>
                    <p className={`${textBody} leading-relaxed mb-4`}>Responsible for data processing:</p>
                    <div className={`p-4 rounded-xl border ${cardBg}`}>
                        <p className={`font-bold ${textTitle}`}>Carveo</p>
                        <p className={textBody}>
                            Email: <a href="mailto:privacy@carveo.app" className={linkColor}>privacy@carveo.app</a>
                        </p>
                    </div>
                </>
            ),
        },
        {
            num: '2',
            title: 'Data We Collect',
            content: (
                <>
                    <p className={`${textBody} leading-relaxed mb-4`}>We collect and process the following personal data:</p>
                    <ul className="space-y-3">
                        {[
                            { label: 'Account data', desc: 'Email address, username upon registration' },
                            { label: 'Usage data', desc: 'Device information, IP address, access timestamps' },
                            { label: 'Vehicle data', desc: 'Vehicle Identification Numbers (VIN), vehicle photos you upload' },
                            { label: 'Payment data', desc: 'Processed through Stripe — we do not store credit card information' },
                            { label: 'Camera access', desc: 'Only during active use of VIN scanning or photo capture features, with your explicit permission' },
                        ].map((item, i) => (
                            <li key={i} className={`flex gap-3 items-start p-3 rounded-xl ${cardBg} border`}>
                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                                <div>
                                    <span className={`font-semibold ${textTitle}`}>{item.label}: </span>
                                    <span className={textBody}>{item.desc}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            ),
        },
        {
            num: '3',
            title: 'Purpose of Data Processing',
            content: (
                <ul className="space-y-2">
                    {[
                        'Providing and improving our service',
                        'Processing vehicle photos using AI (Google Gemini)',
                        'Vehicle Identification Number (VIN) recognition via OCR',
                        'Managing your account and credit balance',
                        'Payment processing via Stripe',
                    ].map((item, i) => (
                        <li key={i} className={`flex gap-3 items-center ${textBody}`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                            {item}
                        </li>
                    ))}
                </ul>
            ),
        },
        {
            num: '4',
            title: 'Third-Party Services',
            content: (
                <div className="space-y-3">
                    {[
                        { name: 'Supabase', desc: 'Authentication and data storage (EU region)' },
                        { name: 'Google Gemini AI', desc: 'Image processing and OCR — images are sent to Google for processing' },
                        { name: 'Stripe', desc: "Payment processing — subject to Stripe's Privacy Policy" },
                    ].map((item, i) => (
                        <div key={i} className={`p-4 rounded-xl border ${cardBg} flex gap-4 items-start`}>
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-500 font-bold text-sm">{item.name.charAt(0)}</span>
                            </div>
                            <div>
                                <p className={`font-semibold ${textTitle}`}>{item.name}</p>
                                <p className={`text-sm ${textBody}`}>{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            num: '5',
            title: 'Data Retention and Deletion',
            content: (
                <div className={`${textBody} leading-relaxed space-y-4`}>
                    <p>Your vehicle data and processed images are stored until you manually delete them. You can remove your vehicles and associated data at any time through the dashboard.</p>
                    <p>Account data is fully removed upon account deletion.</p>
                </div>
            ),
        },
        {
            num: '6',
            title: 'Your Rights (GDPR)',
            content: (
                <>
                    <p className={`${textBody} leading-relaxed mb-4`}>You have the following rights regarding your personal data:</p>
                    <div className="grid sm:grid-cols-2 gap-3 mb-6">
                        {[
                            { right: 'Access', desc: 'Know what data we store about you' },
                            { right: 'Rectification', desc: 'Correct inaccurate data' },
                            { right: 'Erasure', desc: 'Request deletion of your data ("right to be forgotten")' },
                            { right: 'Data portability', desc: 'Export your data in a common format' },
                            { right: 'Objection', desc: 'Object to the processing of your data' },
                        ].map((item, i) => (
                            <div key={i} className={`p-4 rounded-xl border ${cardBg}`}>
                                <p className={`font-semibold ${textTitle} mb-1`}>{item.right}</p>
                                <p className={`text-sm ${textBody}`}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                    <p className={textBody}>
                        Contact us at <a href="mailto:privacy@carveo.app" className={linkColor}>privacy@carveo.app</a> to exercise your rights.
                    </p>
                </>
            ),
        },
        {
            num: '7',
            title: 'Camera and Device Access',
            content: (
                <>
                    <p className={`${textBody} leading-relaxed mb-4`}>The app requests access to your camera exclusively for the following purposes:</p>
                    <ul className="space-y-2 mb-4">
                        {[
                            'Scanning the Vehicle Identification Number (VIN)',
                            'Capturing vehicle photos for AI processing',
                        ].map((item, i) => (
                            <li key={i} className={`flex gap-3 items-center ${textBody}`}>
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                    <p className={`${textBody} leading-relaxed`}>
                        Camera captures are only taken with your explicit permission and are not shared without your consent.
                    </p>
                </>
            ),
        },
        {
            num: '8',
            title: 'Advertising',
            content: (
                <p className={`${textBody} leading-relaxed`}>
                    Our app contains no advertising and no third-party ad SDKs.
                </p>
            ),
        },
        {
            num: '9',
            title: 'Data Security',
            content: (
                <div className={`${textBody} leading-relaxed space-y-4`}>
                    <p>We take the security of your data seriously and implement appropriate technical and organizational measures to protect it, including:</p>
                    <ul className="space-y-2">
                        {[
                            'All data is transmitted over encrypted connections (HTTPS/TLS)',
                            'Authentication is handled securely through Supabase with industry-standard protocols',
                            'Payment information is processed directly by Stripe and never touches our servers',
                            'Access to user data is restricted to authorized personnel only',
                        ].map((item, i) => (
                            <li key={i} className={`flex gap-3 items-center ${textBody}`}>
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            ),
        },
        {
            num: '10',
            title: "Children's Privacy",
            content: (
                <div className={`${textBody} leading-relaxed space-y-4`}>
                    <p>Our service is not directed to children under the age of 16. We do not knowingly collect personal data from children under 16.</p>
                    <p>If we become aware that we have collected personal data from a child under 16 without parental consent, we will take steps to delete that information as quickly as possible.</p>
                    <p>If you believe that a child under 16 has provided us with personal data, please contact us at <a href="mailto:privacy@carveo.app" className={linkColor}>privacy@carveo.app</a>.</p>
                </div>
            ),
        },
        {
            num: '11',
            title: 'Changes to This Policy',
            content: (
                <div className={`${textBody} leading-relaxed space-y-4`}>
                    <p>We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, regulatory, or operational reasons.</p>
                    <p>When we make material changes, we will notify you by updating the "Last updated" date at the top of this page. We encourage you to review this Privacy Policy periodically.</p>
                    <p>Your continued use of the app after any changes constitutes your acceptance of the updated Privacy Policy.</p>
                </div>
            ),
        },
        {
            num: '12',
            title: 'Contact',
            content: (
                <div>
                    <p className={`${textBody} leading-relaxed mb-3`}>For privacy-related questions, contact us at:</p>
                    <a href="mailto:privacy@carveo.app" className={`${linkColor} font-semibold text-lg`}>
                        privacy@carveo.app
                    </a>
                </div>
            ),
        },
    ];

    return (
        <div className={`min-h-screen ${bg} transition-colors duration-300`}>
            {/* Hero */}
            <div className="relative pt-32 pb-16 px-4 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none -z-10" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-500/10 mb-8">
                        <Shield className="w-10 h-10 text-blue-500" />
                    </div>
                    <h1 className={`text-5xl md:text-6xl font-black mb-6 tracking-tighter ${textTitle}`}>
                        Privacy Policy
                    </h1>
                    <p className={`text-xl max-w-2xl mx-auto mb-4 ${textMuted}`}>
                        Your privacy matters to us. Here's how we handle your data.
                    </p>
                    <p className={`text-sm ${textMuted}`}>
                        Last updated: March 6, 2025
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 pb-24">
                <div className="space-y-8">
                    {sections.map((section) => (
                        <div
                            key={section.num}
                            className={`p-8 md:p-10 rounded-[2rem] border ${cardBg} transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5`}
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                    {section.num}
                                </div>
                                <h2 className={`text-2xl md:text-3xl font-bold ${textTitle}`}>{section.title}</h2>
                            </div>
                            <div className={`border-t ${divider} pt-6`}>
                                {section.content}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Back to Home */}
                <div className="mt-16 text-center">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/25 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;

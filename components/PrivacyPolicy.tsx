
import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
    const { theme } = useTheme();
    const { language } = useLanguage();
    const isDark = theme === 'dark';

    const isDE = language === 'de';

    return (
        <div className={`min-h-screen px-4 py-16 md:py-24 ${isDark ? 'bg-black text-white' : 'bg-white text-gray-900'}`}>
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-12">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                            {isDE ? 'Datenschutz\u00ADerkl\u00E4rung' : 'Privacy Policy'}
                        </h1>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {isDE ? 'Zuletzt aktualisiert: 25. Februar 2026' : 'Last updated: February 25, 2026'}
                        </p>
                    </div>
                </div>

                <div className={`prose prose-lg max-w-none ${isDark ? 'prose-invert' : ''}`}>
                    {isDE ? (
                        <>
                            <Section title="1. Verantwortlicher">
                                <p>Verantwortlich für die Datenverarbeitung ist:</p>
                                <p><strong>Carveo</strong><br />E-Mail: datenschutz@carveo.app</p>
                            </Section>

                            <Section title="2. Welche Daten wir erheben">
                                <p>Wir erheben und verarbeiten folgende personenbezogene Daten:</p>
                                <ul>
                                    <li><strong>Kontodaten:</strong> E-Mail-Adresse, Benutzername bei der Registrierung</li>
                                    <li><strong>Nutzungsdaten:</strong> Geräteinformationen, IP-Adresse, Zeitstempel der Zugriffe</li>
                                    <li><strong>Fahrzeugdaten:</strong> Fahrzeug-Identifizierungs&shy;nummern (VIN/FIN), Fahrzeugfotos die Sie hochladen</li>
                                    <li><strong>Zahlungsdaten:</strong> Werden über Stripe verarbeitet — wir speichern keine Kreditkarten&shy;daten</li>
                                    <li><strong>Kamerazugriff:</strong> Nur bei aktiver Nutzung der VIN-Scan- oder Foto-Funktion, mit Ihrer ausdrücklichen Erlaubnis</li>
                                </ul>
                            </Section>

                            <Section title="3. Zweck der Datenverarbeitung">
                                <ul>
                                    <li>Bereitstellung und Verbesserung unseres Dienstes</li>
                                    <li>Verarbeitung von Fahrzeugfotos mittels KI (Google Gemini)</li>
                                    <li>Erkennung der Fahrzeug-Identifizierungs&shy;nummer (VIN) per OCR</li>
                                    <li>Verwaltung Ihres Kontos und Ihrer Credit-Guthaben</li>
                                    <li>Abwicklung von Zahlungen über Stripe</li>
                                </ul>
                            </Section>

                            <Section title="4. Externe Dienste und Drittanbieter">
                                <ul>
                                    <li><strong>Supabase:</strong> Authentifizierung und Datenspeicherung (EU-Region)</li>
                                    <li><strong>Google Gemini AI:</strong> Bildverarbeitung und OCR — Bilder werden zur Verarbeitung an Google gesendet</li>
                                    <li><strong>Stripe:</strong> Zahlungsabwicklung — unterliegt der <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Datenschutz&shy;erklärung von Stripe</a></li>
                                </ul>
                            </Section>

                            <Section title="5. Speicherung und Löschung">
                                <p>Ihre Fahrzeugdaten und verarbeiteten Bilder werden gespeichert, bis Sie diese manuell löschen. Sie können jederzeit über das Dashboard Ihre Fahrzeuge und zugehörige Daten entfernen.</p>
                                <p>Kontodaten werden bei Löschung Ihres Kontos vollständig entfernt.</p>
                            </Section>

                            <Section title="6. Ihre Rechte (DSGVO)">
                                <p>Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:</p>
                                <ul>
                                    <li><strong>Auskunft:</strong> Welche Daten wir über Sie speichern</li>
                                    <li><strong>Berichtigung:</strong> Korrektur unrichtiger Daten</li>
                                    <li><strong>Löschung:</strong> Entfernung Ihrer Daten ("Recht auf Vergessenwerden")</li>
                                    <li><strong>Datenübertragbarkeit:</strong> Export Ihrer Daten in einem gängigen Format</li>
                                    <li><strong>Widerspruch:</strong> Gegen die Verarbeitung Ihrer Daten</li>
                                </ul>
                                <p>Kontaktieren Sie uns unter <strong>datenschutz@carveo.app</strong> zur Ausübung Ihrer Rechte.</p>
                            </Section>

                            <Section title="7. Kamera- und Gerätezugriff">
                                <p>Die App fordert Zugriff auf Ihre Kamera ausschließlich für folgende Zwecke an:</p>
                                <ul>
                                    <li>Scannen der Fahrzeug-Identifizierungs&shy;nummer (VIN/FIN)</li>
                                    <li>Aufnahme von Fahrzeugfotos für die KI-Bearbeitung</li>
                                </ul>
                                <p>Kameraaufnahmen werden nur mit Ihrer ausdrücklichen Genehmigung gemacht und nicht ohne Ihre Zustimmung weitergegeben.</p>
                            </Section>

                            <Section title="8. Werbung">
                                <p>Unsere App enthält <strong>keine Werbung</strong> und keine Anzeigen-SDKs von Drittanbietern.</p>
                            </Section>

                            <Section title="9. Kontakt">
                                <p>Bei Fragen zum Datenschutz kontaktieren Sie uns unter:<br />
                                    <strong>datenschutz@carveo.app</strong></p>
                            </Section>
                        </>
                    ) : (
                        <>
                            <Section title="1. Data Controller">
                                <p>Responsible for data processing:</p>
                                <p><strong>Carveo</strong><br />Email: privacy@carveo.app</p>
                            </Section>

                            <Section title="2. Data We Collect">
                                <p>We collect and process the following personal data:</p>
                                <ul>
                                    <li><strong>Account data:</strong> Email address, username upon registration</li>
                                    <li><strong>Usage data:</strong> Device information, IP address, access timestamps</li>
                                    <li><strong>Vehicle data:</strong> Vehicle Identification Numbers (VIN), vehicle photos you upload</li>
                                    <li><strong>Payment data:</strong> Processed through Stripe — we do not store credit card information</li>
                                    <li><strong>Camera access:</strong> Only during active use of VIN scanning or photo capture features, with your explicit permission</li>
                                </ul>
                            </Section>

                            <Section title="3. Purpose of Data Processing">
                                <ul>
                                    <li>Providing and improving our service</li>
                                    <li>Processing vehicle photos using AI (Google Gemini)</li>
                                    <li>Vehicle Identification Number (VIN) recognition via OCR</li>
                                    <li>Managing your account and credit balance</li>
                                    <li>Payment processing via Stripe</li>
                                </ul>
                            </Section>

                            <Section title="4. Third-Party Services">
                                <ul>
                                    <li><strong>Supabase:</strong> Authentication and data storage (EU region)</li>
                                    <li><strong>Google Gemini AI:</strong> Image processing and OCR — images are sent to Google for processing</li>
                                    <li><strong>Stripe:</strong> Payment processing — subject to <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Stripe's Privacy Policy</a></li>
                                </ul>
                            </Section>

                            <Section title="5. Data Retention and Deletion">
                                <p>Your vehicle data and processed images are stored until you manually delete them. You can remove your vehicles and associated data at any time through the dashboard.</p>
                                <p>Account data is fully removed upon account deletion.</p>
                            </Section>

                            <Section title="6. Your Rights (GDPR)">
                                <p>You have the following rights regarding your personal data:</p>
                                <ul>
                                    <li><strong>Access:</strong> Know what data we store about you</li>
                                    <li><strong>Rectification:</strong> Correct inaccurate data</li>
                                    <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
                                    <li><strong>Data portability:</strong> Export your data in a common format</li>
                                    <li><strong>Objection:</strong> Object to the processing of your data</li>
                                </ul>
                                <p>Contact us at <strong>privacy@carveo.app</strong> to exercise your rights.</p>
                            </Section>

                            <Section title="7. Camera and Device Access">
                                <p>The app requests access to your camera exclusively for the following purposes:</p>
                                <ul>
                                    <li>Scanning the Vehicle Identification Number (VIN)</li>
                                    <li>Capturing vehicle photos for AI processing</li>
                                </ul>
                                <p>Camera captures are only taken with your explicit permission and are not shared without your consent.</p>
                            </Section>

                            <Section title="8. Advertising">
                                <p>Our app contains <strong>no advertising</strong> and no third-party ad SDKs.</p>
                            </Section>

                            <Section title="9. Contact">
                                <p>For privacy-related questions, contact us at:<br />
                                    <strong>privacy@carveo.app</strong></p>
                            </Section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-10">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="space-y-3 leading-relaxed">{children}</div>
    </div>
);

export default PrivacyPolicy;

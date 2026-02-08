
import React from 'react';
import { Mail, MessageSquare, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

const ContactPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
                        Get in Touch
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Have questions about our enterprise solutions or need support? We're here to help.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <div className="space-y-8">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-zinc-900/50 p-8 rounded-3xl border border-white/10"
                        >
                            <h3 className="text-2xl font-bold mb-6">Contact Information</h3>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <Mail className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-white">Email Us</h4>
                                        <p className="text-gray-400 mt-1">[NEEDS UPDATING]</p>
                                        <p className="text-sm text-gray-500 mt-1">Typical response time: 2 hours</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <MessageSquare className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-white">Live Support</h4>
                                        <p className="text-gray-400 mt-1">[NEEDS UPDATING]</p>
                                        <p className="text-sm text-gray-500 mt-1">Available Mon-Fri, 9am - 6pm EST</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <MapPin className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-white">Office</h4>
                                        <p className="text-gray-400 mt-1">[NEEDS UPDATING]</p>
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
                        className="bg-zinc-900 border border-white/10 rounded-3xl p-8"
                    >
                        <form className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Your name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                                <input
                                    type="email"
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="your@email.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Message</label>
                                <textarea
                                    rows={4}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="How can we help?"
                                />
                            </div>
                            <button className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-500/20">
                                Send Message
                            </button>
                        </form>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;

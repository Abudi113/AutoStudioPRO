import React, { useState } from 'react';
import { detectCarAngle } from '../services/geminiService';
import { CameraAngle } from '../types';

const AngleDetectionTest: React.FC = () => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [detectedAngle, setDetectedAngle] = useState<CameraAngle | null>(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            setSelectedImage(base64);
            setError(null);
            setDetectedAngle(null);


            // Detect angle
            setIsDetecting(true);
            try {
                console.log('📤 Sending image to detection API...');
                const angle = await detectCarAngle(base64);
                console.log('📥 Received angle from API:', angle);
                setDetectedAngle(angle);
                console.log('✅ State updated with angle:', angle);
            } catch (err) {
                console.error('❌ Detection error:', err);
                setError(err instanceof Error ? err.message : 'Detection failed');
            } finally {
                setIsDetecting(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const getAngleInfo = (angle: CameraAngle | null) => {
        if (!angle) return null;

        const angleMap: Record<CameraAngle, { label: string; category: string; color: string }> = {
            'front': { label: 'Front View', category: 'Exterior', color: 'bg-blue-500' },
            'rear': { label: 'Rear View', category: 'Exterior', color: 'bg-blue-500' },
            'left': { label: 'Left Side', category: 'Exterior', color: 'bg-blue-500' },
            'right': { label: 'Right Side', category: 'Exterior', color: 'bg-blue-500' },
            'front_left_34': { label: 'Front-Left 3/4', category: 'Exterior', color: 'bg-blue-500' },
            'front_right_34': { label: 'Front-Right 3/4', category: 'Exterior', color: 'bg-blue-500' },
            'rear_left_34': { label: 'Rear-Left 3/4', category: 'Exterior', color: 'bg-blue-500' },
            'rear_right_34': { label: 'Rear-Right 3/4', category: 'Exterior', color: 'bg-blue-500' },
            'interior': { label: 'Interior Cabin', category: 'Interior', color: 'bg-purple-500' },
            'detail': { label: 'Detail Shot', category: 'Special', color: 'bg-orange-500' },
            'door_open': { label: 'Door(s) Open', category: 'Special', color: 'bg-red-500' },
            'trunk_open': { label: 'Trunk Open', category: 'Special', color: 'bg-red-500' },
            'hood_open': { label: 'Hood Open', category: 'Special', color: 'bg-red-500' },
        };

        return angleMap[angle] || { label: angle, category: 'Unknown', color: 'bg-gray-500' };
    };

    const angleInfo = getAngleInfo(detectedAngle);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">🔍 Angle Detection Test</h1>
                    <p className="text-gray-400">Upload any car photo to test the AI angle detection</p>
                </div>

                {/* Upload Area */}
                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-8 mb-6">
                    <label className="block cursor-pointer">
                        <div className="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center hover:border-blue-500 transition-colors">
                            <i className="fas fa-upload text-5xl text-gray-500 mb-4"></i>
                            <p className="text-gray-400 text-lg">Click to upload a car photo</p>
                            <p className="text-gray-600 text-sm mt-2">Supports: Exterior, Interior, Details, Open Doors</p>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                    </label>
                </div>

                {/* Results */}
                {selectedImage && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Image Preview */}
                        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6">
                            <h3 className="text-xl font-semibold text-white mb-4">📸 Uploaded Image</h3>
                            <img
                                src={selectedImage}
                                alt="Test"
                                className="w-full h-auto rounded-lg border border-gray-600"
                            />
                        </div>

                        {/* Detection Results */}
                        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6">
                            <h3 className="text-xl font-semibold text-white mb-4">🤖 Detection Results</h3>

                            {isDetecting && (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                                    <span className="ml-4 text-gray-400">Detecting angle...</span>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
                                    <p className="text-red-400">❌ Error: {error}</p>
                                </div>
                            )}

                            {angleInfo && !isDetecting && (
                                <div className="space-y-4">
                                    <div className={`${angleInfo.color} rounded-lg p-6 text-white`}>
                                        <div className="text-sm opacity-80 mb-1">Detected Angle</div>
                                        <div className="text-3xl font-bold">{angleInfo.label}</div>
                                    </div>

                                    <div className="bg-gray-700/50 rounded-lg p-4">
                                        <div className="text-sm text-gray-400 mb-1">Category</div>
                                        <div className="text-xl text-white font-semibold">{angleInfo.category}</div>
                                    </div>

                                    <div className="bg-gray-700/50 rounded-lg p-4">
                                        <div className="text-sm text-gray-400 mb-1">Angle Code</div>
                                        <div className="text-lg text-white font-mono">{detectedAngle}</div>
                                    </div>

                                    {/* Processing Info */}
                                    <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-4 mt-4">
                                        <h4 className="text-blue-400 font-semibold mb-2">ℹ️ What happens next?</h4>
                                        <p className="text-gray-300 text-sm">
                                            {angleInfo.category === 'Exterior' && 'This will use exterior background replacement with studio compositing.'}
                                            {angleInfo.category === 'Interior' && 'This will use interior enhancement with lighting cleanup and window replacement.'}
                                            {angleInfo.category === 'Special' && detectedAngle?.includes('open') && 'This will use specialized open car processing to preserve door angles.'}
                                            {angleInfo.category === 'Special' && detectedAngle === 'detail' && 'This will use detail shot processing to avoid hallucinating the full car.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Test Guide */}
                <div className="mt-8 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold text-white mb-4">📋 Testing Checklist</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-blue-400 font-semibold mb-2">✅ Exterior Shots to Test:</h4>
                            <ul className="text-gray-300 text-sm space-y-1">
                                <li>• Front view (head-on)</li>
                                <li>• Rear view (from behind)</li>
                                <li>• Left side profile</li>
                                <li>• Right side profile</li>
                                <li>• 3/4 angles (4 variations)</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-purple-400 font-semibold mb-2">✅ Interior Shots to Test:</h4>
                            <ul className="text-gray-300 text-sm space-y-1">
                                <li>• Dashboard view</li>
                                <li>• Driver seat view</li>
                                <li>• Rear seats view</li>
                                <li>• Any cabin interior shot</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-orange-400 font-semibold mb-2">✅ Detail Shots to Test:</h4>
                            <ul className="text-gray-300 text-sm space-y-1">
                                <li>• Close-up of wheel/tire</li>
                                <li>• Headlight only</li>
                                <li>• Badge/emblem detail</li>
                                <li>• Any partial car view</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-red-400 font-semibold mb-2">✅ Special Cases to Test:</h4>
                            <ul className="text-gray-300 text-sm space-y-1">
                                <li>• Car with door(s) open</li>
                                <li>• Car with trunk open</li>
                                <li>• Car with hood open</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AngleDetectionTest;

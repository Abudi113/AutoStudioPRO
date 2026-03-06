import React from 'react';
import { CameraAngle } from '../types';
import { motion } from 'framer-motion';

interface Guide3DOverlayProps {
    angleId: CameraAngle;
    isAligned: boolean;
    isDetected?: boolean;
    isFullyInFrame?: boolean;
}

const GridPattern: React.FC<{ id: string; color: string }> = ({ id, color }) => (
    <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M 8 0 L 0 0 0 8" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4" />
    </pattern>
);

export const Guide3DOverlay: React.FC<Guide3DOverlayProps> = ({
    angleId,
    isAligned,
    isDetected = false,
    isFullyInFrame = true
}) => {

    // Colors
    const strokeColor = isAligned ? '#10B981' : (isFullyInFrame ? '#06b6d4' : '#ef4444');
    const frontColor = isAligned ? '#10B981' : '#10B981';
    const backColor = isAligned ? '#10B981' : '#EF4444';

    // Darker grid when detected
    const gridColor = isDetected
        ? (isAligned ? 'rgba(16, 185, 129, 0.6)' : 'rgba(6, 182, 212, 0.5)')
        : (isAligned ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 182, 212, 0.2)');

    const cornerProps = (color: string) => ({
        stroke: color,
        strokeWidth: "1",
        strokeLinecap: "round" as "round",
        fill: "none",
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { delay: 0.3 }
    });

    const gridProps = (id: string) => ({
        fill: `url(#${id})`,
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { delay: 0.5 }
    });

    const renderShape = () => {
        const viewBox = "0 0 160 100";
        const containerClass = "w-full h-full p-4 md:p-8";

        switch (angleId) {
            case 'front_left_34':
                // Car facing Left: Front (Green) is on the Left, Side/Rear (Red) on Right
                return (
                    <svg viewBox={viewBox} className={containerClass}>
                        <defs><GridPattern id="grid-fl34" color={gridColor} /></defs>
                        <motion.path d="M 20 40 L 60 30 L 60 85 L 20 80 Z" {...gridProps('grid-fl34')} />
                        <motion.path d="M 60 30 L 140 25 L 140 70 L 60 85 Z" {...gridProps('grid-fl34')} />
                        <motion.path d="M 20 80 L 60 85 L 140 70" fill="none" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                        <motion.line x1="20" y1="40" x2="20" y2="80" {...cornerProps(frontColor)} />
                        <motion.line x1="60" y1="30" x2="60" y2="85" {...cornerProps(backColor)} />
                        <motion.line x1="140" y1="25" x2="140" y2="70" {...cornerProps(backColor)} />
                    </svg>
                );

            case 'front_right_34':
                // Car facing Right: Front (Green) is on the Right, Side/Rear (Red) on Left
                return (
                    <svg viewBox={viewBox} className={containerClass}>
                        <defs><GridPattern id="grid-fr34" color={gridColor} /></defs>
                        <motion.path d="M 100 30 L 140 40 L 140 80 L 100 85 Z" {...gridProps('grid-fr34')} />
                        <motion.path d="M 20 25 L 100 30 L 100 85 L 20 70 Z" {...gridProps('grid-fr34')} />
                        <motion.path d="M 140 80 L 100 85 L 20 70" fill="none" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                        <motion.line x1="140" y1="40" x2="140" y2="80" {...cornerProps(frontColor)} />
                        <motion.line x1="100" y1="30" x2="100" y2="85" {...cornerProps(backColor)} />
                        <motion.line x1="20" y1="25" x2="20" y2="70" {...cornerProps(backColor)} />
                    </svg>
                );

            case 'rear_left_34':
                // Car facing Left (front recedes Left): Rear (Red) is on the Right (prominent), Side recedes to Front (Green) on Left
                // Wait, Rear Left 3/4 means you look at the REAR and LEFT side.
                // Car is facing FRONT (Right-ish from a Rear view). 
                // Let's use the FR34 geometry but swap colors:prominent face is Rear (Red) on the Right.
                return (
                    <svg viewBox={viewBox} className={containerClass}>
                        <defs><GridPattern id="grid-rl34" color={gridColor} /></defs>
                        <motion.path d="M 100 30 L 140 40 L 140 80 L 100 85 Z" {...gridProps('grid-rl34')} />
                        <motion.path d="M 20 25 L 100 30 L 100 85 L 20 70 Z" {...gridProps('grid-rl34')} />
                        <motion.path d="M 140 80 L 100 85 L 20 70" fill="none" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                        <motion.line x1="140" y1="40" x2="140" y2="80" {...cornerProps(backColor)} />
                        <motion.line x1="100" y1="30" x2="100" y2="85" {...cornerProps(backColor)} />
                        <motion.line x1="20" y1="25" x2="20" y2="70" {...cornerProps(frontColor)} />
                    </svg>
                );

            case 'rear_right_34':
                // Looking at Rear-Right. Side recedes to Front (Green) on the Right. Rear (Red) is on the Left.
                return (
                    <svg viewBox={viewBox} className={containerClass}>
                        <defs><GridPattern id="grid-rr34" color={gridColor} /></defs>
                        <motion.path d="M 20 40 L 60 30 L 60 85 L 20 80 Z" {...gridProps('grid-rr34')} />
                        <motion.path d="M 60 30 L 140 25 L 140 70 L 60 85 Z" {...gridProps('grid-rr34')} />
                        <motion.path d="M 20 80 L 60 85 L 140 70" fill="none" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                        <motion.line x1="20" y1="40" x2="20" y2="80" {...cornerProps(backColor)} />
                        <motion.line x1="60" y1="30" x2="60" y2="85" {...cornerProps(backColor)} />
                        <motion.line x1="140" y1="25" x2="140" y2="70" {...cornerProps(frontColor)} />
                    </svg>
                );

            case 'left':
            case 'side':
                // Car facing Left: Front (Green) is on Left, Rear (Red) is on Right
                return (
                    <svg viewBox={viewBox} className={containerClass}>
                        <defs><GridPattern id="grid-left" color={gridColor} /></defs>
                        <motion.rect x="20" y="30" width="120" height="50" {...gridProps('grid-left')} />
                        <motion.line x1="20" y1="80" x2="140" y2="80" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                        <motion.line x1="20" y1="30" x2="20" y2="80" {...cornerProps(frontColor)} />
                        <motion.line x1="140" y1="30" x2="140" y2="80" {...cornerProps(backColor)} />
                    </svg>
                );

            case 'right':
                // Car facing Right: Front (Green) is on Right, Rear (Red) is on Left
                return (
                    <svg viewBox={viewBox} className={containerClass}>
                        <defs><GridPattern id="grid-right" color={gridColor} /></defs>
                        <motion.rect x="20" y="30" width="120" height="50" {...gridProps('grid-right')} />
                        <motion.line x1="20" y1="80" x2="140" y2="80" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                        <motion.line x1="20" y1="30" x2="20" y2="80" {...cornerProps(backColor)} />
                        <motion.line x1="140" y1="30" x2="140" y2="80" {...cornerProps(frontColor)} />
                    </svg>
                );

            case 'front':
                return (
                    <svg viewBox={viewBox} className={containerClass}>
                        <defs><GridPattern id="grid-front" color={gridColor} /></defs>
                        <motion.path d="M 30 35 L 130 35 L 130 80 L 30 80 Z" {...gridProps('grid-front')} />
                        <motion.line x1="30" y1="80" x2="130" y2="80" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                        <motion.line x1="30" y1="35" x2="30" y2="80" {...cornerProps(frontColor)} />
                        <motion.line x1="130" y1="35" x2="130" y2="80" {...cornerProps(frontColor)} />
                    </svg>
                );

            case 'rear':
                return (
                    <svg viewBox={viewBox} className={containerClass}>
                        <defs><GridPattern id="grid-rear" color={gridColor} /></defs>
                        <motion.path d="M 30 35 L 130 35 L 130 80 L 30 80 Z" {...gridProps('grid-rear')} />
                        <motion.line x1="30" y1="80" x2="130" y2="80" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                        <motion.line x1="30" y1="35" x2="30" y2="80" {...cornerProps(backColor)} />
                        <motion.line x1="130" y1="35" x2="130" y2="80" {...cornerProps(backColor)} />
                    </svg>
                );

            case 'interior':
            case 'interior_driver':
            case 'interior_passenger':
            case 'interior_rear':
                return (
                    <svg viewBox={viewBox} className="w-full h-full p-8">
                        <motion.circle cx="80" cy="50" r="20" stroke={frontColor} strokeWidth="2" fill="none" strokeDasharray="4 4" />
                        <motion.path d="M 60 50 L 100 50" stroke={frontColor} strokeWidth="2" />
                        <motion.path d="M 80 30 L 80 70" stroke={frontColor} strokeWidth="2" />
                    </svg>
                );

            default:
                return null;
        }
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
            <div className="w-[95%] h-[85%] relative">
                {renderShape()}
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-30">
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full ${isAligned ? 'bg-emerald-500' : 'bg-white'}`} />
                <div className={`absolute top-1/2 left-0 -translate-y-1/2 w-full h-[1px] ${isAligned ? 'bg-emerald-500' : 'bg-white'}`} />
            </div>
        </div>
    );
};

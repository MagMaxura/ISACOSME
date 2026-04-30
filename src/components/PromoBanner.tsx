import React from 'react';

const PromoBanner: React.FC = () => {
    return (
        <div className="bg-black text-white py-2 px-4 text-center z-[10000] relative overflow-hidden">
            <div className="flex items-center justify-center gap-4 animate-fade-in whitespace-nowrap overflow-x-auto no-scrollbar">
                <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.2em]">
                    ✨ 10% OFF con Mercado Pago (1 cuota) 
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.2em]">
                    15% OFF con Transferencia por WhatsApp ✨
                </span>
            </div>
            {/* Subtle glow effect */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer pointer-events-none"></div>
            <style>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
                .animate-shimmer {
                    animation: shimmer 3s infinite;
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
};

export default PromoBanner;

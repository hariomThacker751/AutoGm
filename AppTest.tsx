import React from 'react';
import { Zap, Sparkles } from 'lucide-react';
import { Toaster } from 'sonner';

// Mock login function
const login = () => {
    alert("Login clicked (Mock)");
};

const App: React.FC = () => {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Background - Manual Copy from App.tsx */}
            <div className="absolute inset-0 bg-[#0a0f1a]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(139,92,246,0.1),transparent)]" />
            </div>

            {/* Login Card */}
            <div className="glass-card-elevated p-10 max-w-md w-full text-center relative z-10">
                {/* Logo */}
                <div className="relative mx-auto w-20 h-20 mb-8">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl rotate-6 opacity-50" />
                    <div className="relative bg-gradient-to-br from-indigo-500 to-purple-500 p-5 rounded-2xl shadow-glow">
                        <Zap className="w-10 h-10 text-white" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold mb-2 tracking-tight text-white">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">AutoPersuade</span>
                    <span className="text-white/80 ml-2">AI</span>
                </h1>
                <p className="text-gray-400 mb-8 leading-relaxed">
                    Enterprise sales automation.
                    <br />
                    <span className="text-indigo-400 font-medium">Turn cold leads into closed deals.</span>
                </p>

                <button
                    onClick={() => login()}
                    className="w-full py-4 text-base group bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 transition-all"
                >
                    <span>Continue with Google</span>
                    <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <p className="mt-6 text-xs text-gray-500 font-medium uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Secure • Fast • Automated
                </p>
            </div>

            <Toaster theme="dark" position="top-center" />
        </div>
    );
};

export default App;

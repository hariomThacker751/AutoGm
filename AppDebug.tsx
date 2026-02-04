import React from 'react';

export default function App() {
    return (
        <div className="min-h-screen bg-blue-900 text-white flex items-center justify-center">
            <div className="p-10 border-4 border-red-500 rounded-xl bg-black">
                <h1 className="text-4xl font-bold text-red-500 mb-4">DEBUG MODE ACTIVE</h1>
                <p className="text-xl">If you can see this, React is mounting correctly.</p>
                <p className="mt-4 text-gray-400">Next step: Isolate the crashing component.</p>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { Campaign, PendingFollowUp, ImportedLead } from '../types';
import { Folder, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import CampaignList from './CampaignList';
import CampaignDetails from './CampaignDetails';

interface CampaignManagerProps {
    onBack: () => void;
    userInfo: any;
    onSendEmails: (
        leads: ImportedLead[],
        campaignId: string,
        onProgress?: (current: number, success: number, failed: number) => void
    ) => Promise<void>;
    onSendFollowUps: (pending: PendingFollowUp[]) => Promise<{ success: number; failed: number }>;
    onTestEmail: (lead: ImportedLead) => Promise<{ success: boolean; error?: string }>;
}

const CampaignManager: React.FC<CampaignManagerProps> = ({
    onBack,
    userInfo,
    onSendEmails,
    onSendFollowUps,
    onTestEmail
}) => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create campaign form
    const [newCampaignName, setNewCampaignName] = useState('');
    const [followUpDays, setFollowUpDays] = useState([2, 5, 10]);
    const [senderName, setSenderName] = useState('');
    const [senderCompany, setSenderCompany] = useState('');

    const fetchCampaigns = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/campaigns`);
            const data = await res.json();
            setCampaigns(data);

            // Re-select current campaign with fresh data
            if (selectedCampaign) {
                const updated = data.find((c: Campaign) => c.id === selectedCampaign.id);
                if (updated) setSelectedCampaign(updated);
            }
        } catch (err) {
            console.error('Failed to fetch campaigns:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const createCampaign = async () => {
        if (!newCampaignName.trim() || !senderName.trim() || !senderCompany.trim()) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/campaigns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newCampaignName,
                    followUpIntervals: followUpDays,
                    senderName,
                    senderCompany
                })
            });
            const newCampaign = await res.json();
            setCampaigns([...campaigns, newCampaign]);
            setSelectedCampaign(newCampaign);
            setShowCreateModal(false);
            setNewCampaignName('');
            toast.success('Campaign created!', { description: newCampaign.name });
        } catch (err) {
            console.error('Failed to create campaign:', err);
            toast.error('Failed to create campaign');
        }
    };

    const updateFollowUpDay = (index: number, value: number) => {
        const updated = [...followUpDays];
        updated[index] = value;
        setFollowUpDays(updated);
    };

    const addFollowUpDay = () => {
        setFollowUpDays([...followUpDays, followUpDays[followUpDays.length - 1] + 3]);
    };

    const removeFollowUpDay = (index: number) => {
        if (followUpDays.length > 1) {
            setFollowUpDays(followUpDays.filter((_, i) => i !== index));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-purple-500/20">
                            <Folder className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">Campaign Manager</h1>
                            <p className="text-xs text-slate-500">Create, manage, and track your email campaigns</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            New Campaign
                        </button>
                        <button
                            onClick={onBack}
                            className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                            ← Back
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Campaign List Sidebar */}
                    <div className="lg:col-span-4 xl:col-span-3">
                        <CampaignList
                            campaigns={campaigns}
                            selectedCampaignId={selectedCampaign?.id || null}
                            onSelectCampaign={setSelectedCampaign}
                            onCreateCampaign={() => setShowCreateModal(true)}
                        />
                    </div>

                    {/* Campaign Details */}
                    <div className="lg:col-span-8 xl:col-span-9">
                        {selectedCampaign ? (
                            <CampaignDetails
                                campaign={selectedCampaign}
                                userInfo={userInfo}
                                onSendEmails={onSendEmails}
                                onSendFollowUps={onSendFollowUps}
                                onTestEmail={onTestEmail}
                                onRefresh={fetchCampaigns}
                            />
                        ) : (
                            <div className="bg-white rounded-2xl p-16 text-center border border-slate-100 shadow-sm">
                                <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <Folder className="w-10 h-10 text-indigo-300" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-700 mb-2">Select a Campaign</h2>
                                <p className="text-slate-400 max-w-sm mx-auto">
                                    Choose a campaign from the list to view details, upload leads, and track performance.
                                </p>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create First Campaign
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Create Campaign Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-800">Create Campaign</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* Campaign Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Campaign Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newCampaignName}
                                    onChange={(e) => setNewCampaignName(e.target.value)}
                                    placeholder="e.g., Q1 Outreach"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                />
                            </div>

                            {/* Sender Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Your Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={senderName}
                                        onChange={(e) => setSenderName(e.target.value)}
                                        placeholder="John Smith"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Company <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={senderCompany}
                                        onChange={(e) => setSenderCompany(e.target.value)}
                                        placeholder="Acme Inc"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Follow-up Schedule */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Follow-up Schedule
                                </label>
                                <p className="text-xs text-slate-400 mb-3">Days after initial email to send follow-ups</p>
                                <div className="space-y-2">
                                    {followUpDays.map((day, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <span className="text-sm text-slate-500 w-24">Follow-up {idx + 1}</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={day}
                                                onChange={(e) => updateFollowUpDay(idx, parseInt(e.target.value) || 1)}
                                                className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-slate-400">days</span>
                                            {followUpDays.length > 1 && (
                                                <button
                                                    onClick={() => removeFollowUpDay(idx)}
                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={addFollowUpDay}
                                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    + Add follow-up
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createCampaign}
                                disabled={!newCampaignName.trim() || !senderName.trim() || !senderCompany.trim()}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                Create Campaign
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CampaignManager;

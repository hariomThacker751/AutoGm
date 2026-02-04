import React, { useState, useEffect } from 'react';
import { Campaign, PendingFollowUp, ImportedLead } from '../types';
import { Folder, Plus, X, Zap, ArrowLeft, Sparkles, LayoutDashboard } from 'lucide-react';
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
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(() => {
        return localStorage.getItem('selectedCampaignId');
    });
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

            // Ensure data is an array before setting
            const campaignsArray = Array.isArray(data) ? data : [];
            setCampaigns(campaignsArray);

            // Re-select current campaign with fresh data
            if (selectedCampaign) {
                const updated = campaignsArray.find((c: Campaign) => c.id === selectedCampaign.id);
                if (updated) setSelectedCampaign(updated);
            }
        } catch (err) {
            console.error('Failed to fetch campaigns:', err);
            setCampaigns([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    // Persist selected campaign ID to localStorage
    useEffect(() => {
        if (selectedCampaign) {
            localStorage.setItem('selectedCampaignId', selectedCampaign.id);
        }
    }, [selectedCampaign]);

    // When campaigns load, restore the previously selected campaign
    useEffect(() => {
        if (campaigns.length > 0 && selectedCampaignId && !selectedCampaign) {
            const found = campaigns.find(c => c.id === selectedCampaignId);
            if (found) {
                setSelectedCampaign(found);
            }
        }
    }, [campaigns, selectedCampaignId, selectedCampaign]);

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
            <div className="min-h-screen flex items-center justify-center relative">
                <div className="absolute inset-0 bg-deep">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
                </div>
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full relative z-10" />
            </div>
        );
    }

    return (
        <div className="min-h-screen relative">
            {/* Background */}
            <div className="absolute inset-0 bg-deep">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(139,92,246,0.08),transparent)]" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-20 border-b border-white/5 bg-surface/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-neon-purple to-primary-500 p-2.5 rounded-xl shadow-glow">
                            <Folder className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Campaign Manager</h1>
                            <p className="text-xs text-gray-500">Create, manage, and track your email campaigns</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn btn-primary"
                        >
                            <Plus className="w-4 h-4" />
                            New Campaign
                        </button>
                        <button
                            onClick={onBack}
                            className="btn btn-ghost text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                            <div className="glass-card p-16 text-center animate-fade-up">
                                <div className="w-20 h-20 bg-gradient-to-br from-primary-500/20 to-neon-purple/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <Folder className="w-10 h-10 text-primary-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Select a Campaign</h2>
                                <p className="text-gray-400 max-w-sm mx-auto">
                                    Choose a campaign from the list to view details, upload leads, and track performance.
                                </p>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="btn btn-primary mt-6"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Create First Campaign
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Create Campaign Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card-elevated p-6 w-full max-w-md animate-fade-up">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Create Campaign</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="btn btn-icon btn-ghost"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* Campaign Name */}
                            <div>
                                <label className="input-label">
                                    Campaign Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newCampaignName}
                                    onChange={(e) => setNewCampaignName(e.target.value)}
                                    placeholder="e.g., Q1 Outreach"
                                    className="input-field"
                                />
                            </div>

                            {/* Sender Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">
                                        Your Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={senderName}
                                        onChange={(e) => setSenderName(e.target.value)}
                                        placeholder="John Smith"
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="input-label">
                                        Company <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={senderCompany}
                                        onChange={(e) => setSenderCompany(e.target.value)}
                                        placeholder="Acme Inc"
                                        className="input-field"
                                    />
                                </div>
                            </div>

                            {/* Follow-up Schedule */}
                            <div>
                                <label className="input-label mb-2">
                                    Follow-up Schedule
                                </label>
                                <p className="text-xs text-gray-500 mb-3">Days after initial email to send follow-ups</p>
                                <div className="space-y-2">
                                    {followUpDays.map((day, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <span className="text-sm text-gray-400 w-24">Follow-up {idx + 1}</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={day}
                                                onChange={(e) => updateFollowUpDay(idx, parseInt(e.target.value) || 1)}
                                                className="input-field w-20 text-center py-2"
                                            />
                                            <span className="text-sm text-gray-500">days</span>
                                            {followUpDays.length > 1 && (
                                                <button
                                                    onClick={() => removeFollowUpDay(idx)}
                                                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={addFollowUpDay}
                                    className="mt-3 text-sm text-primary-400 hover:text-primary-300 font-medium"
                                >
                                    + Add follow-up
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="btn btn-ghost flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createCampaign}
                                disabled={!newCampaignName.trim() || !senderName.trim() || !senderCompany.trim()}
                                className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Zap className="w-4 h-4" />
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

import React from 'react';
import { Campaign } from '../types';
import { Folder, Plus, Mail, Eye, TrendingUp, ChevronRight, Calendar, Zap } from 'lucide-react';

interface CampaignListProps {
    campaigns: Campaign[];
    selectedCampaignId: string | null;
    onSelectCampaign: (campaign: Campaign) => void;
    onCreateCampaign: () => void;
}

const CampaignList: React.FC<CampaignListProps> = ({
    campaigns = [],
    selectedCampaignId,
    onSelectCampaign,
    onCreateCampaign
}) => {
    const getOpenRate = (campaign: Campaign) => {
        if (campaign.totalLeads === 0) return 0;
        return Math.round((campaign.openedCount / campaign.totalLeads) * 100);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    Campaigns
                </h2>
                <button
                    onClick={onCreateCampaign}
                    className="p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-glow"
                    title="Create new campaign"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Campaign List */}
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
                {campaigns.length === 0 ? (
                    <div className="glass-card p-8 text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary-500/20 to-neon-purple/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Folder className="w-8 h-8 text-primary-400" />
                        </div>
                        <h3 className="font-semibold text-white mb-1">No campaigns yet</h3>
                        <p className="text-gray-500 text-sm mb-4">
                            Create your first campaign to start sending personalized emails.
                        </p>
                        <button
                            onClick={onCreateCampaign}
                            className="btn btn-primary text-sm"
                        >
                            <Zap className="w-4 h-4" />
                            Create Campaign
                        </button>
                    </div>
                ) : (
                    campaigns.map(campaign => {
                        const isSelected = selectedCampaignId === campaign.id;
                        const openRate = getOpenRate(campaign);

                        return (
                            <button
                                key={campaign.id}
                                onClick={() => onSelectCampaign(campaign)}
                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${isSelected
                                    ? 'bg-primary-500/10 border-primary-500/30 ring-2 ring-primary-500/20'
                                    : 'bg-surface/50 border-white/5 hover:border-primary-500/30 hover:bg-surface'
                                    }`}
                            >
                                {/* Campaign Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-semibold truncate ${isSelected ? 'text-primary-300' : 'text-white'
                                            }`}>
                                            {campaign.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(campaign.createdAt)}
                                        </p>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${isSelected ? 'text-primary-400 translate-x-0.5' : 'text-gray-600 group-hover:text-gray-400'
                                        }`} />
                                </div>

                                {/* Stats Row */}
                                <div className="flex items-center gap-4">
                                    {/* Leads */}
                                    <div className="flex items-center gap-1.5">
                                        <div className={`p-1 rounded ${isSelected ? 'bg-primary-500/20' : 'bg-white/5'}`}>
                                            <Mail className={`w-3 h-3 ${isSelected ? 'text-primary-400' : 'text-gray-500'}`} />
                                        </div>
                                        <span className={`text-xs font-medium ${isSelected ? 'text-primary-300' : 'text-gray-400'}`}>
                                            {campaign.totalLeads}
                                        </span>
                                    </div>

                                    {/* Opened */}
                                    <div className="flex items-center gap-1.5">
                                        <div className={`p-1 rounded ${isSelected ? 'bg-neon-green/20' : 'bg-white/5'}`}>
                                            <Eye className={`w-3 h-3 ${isSelected ? 'text-neon-green' : 'text-gray-500'}`} />
                                        </div>
                                        <span className={`text-xs font-medium ${isSelected ? 'text-green-400' : 'text-gray-400'}`}>
                                            {campaign.openedCount}
                                        </span>
                                    </div>

                                    {/* Open Rate Badge */}
                                    {campaign.totalLeads > 0 && (
                                        <div className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${openRate >= 50
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : openRate >= 25
                                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                : 'bg-white/5 text-gray-500 border border-white/10'
                                            }`}>
                                            {openRate}%
                                        </div>
                                    )}
                                </div>

                                {/* Follow-up Schedule */}
                                <div className="mt-3 pt-3 border-t border-white/5">
                                    <p className="text-xs text-gray-500">
                                        <span className="font-medium">Follow-ups:</span> Day {campaign.followUpIntervals?.join(', ') || 'None'}
                                    </p>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CampaignList;

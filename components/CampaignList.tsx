import React from 'react';
import { Campaign } from '../types';
import { Folder, Plus, Mail, Eye, TrendingUp, ChevronRight, MoreVertical, Calendar } from 'lucide-react';

interface CampaignListProps {
    campaigns: Campaign[];
    selectedCampaignId: string | null;
    onSelectCampaign: (campaign: Campaign) => void;
    onCreateCampaign: () => void;
}

const CampaignList: React.FC<CampaignListProps> = ({
    campaigns,
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
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                    Campaigns
                </h2>
                <button
                    onClick={onCreateCampaign}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    title="Create new campaign"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Campaign List */}
            <div className="flex-1 space-y-3 overflow-y-auto">
                {campaigns.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Folder className="w-8 h-8 text-indigo-300" />
                        </div>
                        <h3 className="font-semibold text-slate-700 mb-1">No campaigns yet</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Create your first campaign to start sending personalized emails.
                        </p>
                        <button
                            onClick={onCreateCampaign}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
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
                                    ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20 shadow-sm'
                                    : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'
                                    }`}
                            >
                                {/* Campaign Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-semibold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'
                                            }`}>
                                            {campaign.name}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(campaign.createdAt)}
                                        </p>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${isSelected ? 'text-indigo-500 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-400'
                                        }`} />
                                </div>

                                {/* Stats Row */}
                                <div className="flex items-center gap-4">
                                    {/* Leads */}
                                    <div className="flex items-center gap-1.5">
                                        <div className={`p-1 rounded ${isSelected ? 'bg-indigo-100' : 'bg-slate-50'}`}>
                                            <Mail className={`w-3 h-3 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        </div>
                                        <span className={`text-xs font-medium ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                                            {campaign.totalLeads}
                                        </span>
                                    </div>

                                    {/* Opened */}
                                    <div className="flex items-center gap-1.5">
                                        <div className={`p-1 rounded ${isSelected ? 'bg-emerald-100' : 'bg-slate-50'}`}>
                                            <Eye className={`w-3 h-3 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                                        </div>
                                        <span className={`text-xs font-medium ${isSelected ? 'text-emerald-700' : 'text-slate-600'}`}>
                                            {campaign.openedCount}
                                        </span>
                                    </div>

                                    {/* Open Rate Badge */}
                                    {campaign.totalLeads > 0 && (
                                        <div className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${openRate >= 50
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : openRate >= 25
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {openRate}%
                                        </div>
                                    )}
                                </div>

                                {/* Follow-up Schedule */}
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                    <p className="text-xs text-slate-400">
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

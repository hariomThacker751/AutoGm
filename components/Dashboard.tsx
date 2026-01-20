import React, { useState, useEffect } from 'react';
import { DashboardStats, TrackingData } from '../types';
import { BarChart3, Mail, Eye, TrendingUp, RefreshCw, Users, Clock, ExternalLink, DollarSign, LayoutDashboard } from 'lucide-react';

interface DashboardProps {
    onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onBack }) => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/analytics`);
            const data = await res.json();
            setStats(data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (lead: TrackingData) => {
        if (lead.openCount > 0) {
            return (
                <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                    <Eye className="w-3 h-3" />
                    Opened ({lead.openCount}x)
                </span>
            );
        }
        if (lead.sentAt) {
            return (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                    <Mail className="w-3 h-3" />
                    Sent
                </span>
            );
        }
        return (
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                Unknown
            </span>
        );
    };

    if (loading && !stats) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex items-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                    <span className="text-lg font-medium text-slate-600">Loading analytics...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                            <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Command Center</h1>
                            <p className="text-xs text-slate-500 font-medium">Sales Pipeline Overview</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {lastUpdated && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Updated {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={fetchStats}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onBack}
                            className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                            ← Back to Campaign
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats Cards */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {/* Pipeline Value */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                        <div className="flex items-center justify-between mb-4 relative">
                            <div className="p-3 bg-violet-50 rounded-xl group-hover:bg-violet-100 transition-colors">
                                <DollarSign className="w-6 h-6 text-violet-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pipeline</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800 relative">
                            ${((stats?.leads?.length || 0) * 2500).toLocaleString()}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Est. Value ($2.5k avg)</p>
                    </div>

                    {/* Total Sent */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-indigo-50 rounded-xl">
                                <Mail className="w-6 h-6 text-indigo-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outreach</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800">{stats?.totalSent || 0}</div>
                        <p className="text-sm text-slate-500 mt-1">Emails delivered</p>
                    </div>

                    {/* Engagement (Opens) */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Engaged</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800">{stats?.totalOpened || 0}</div>
                        <p className="text-sm text-slate-500 mt-1">Unique leads interested</p>
                    </div>

                    {/* Conversion Rate */}
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 shadow-lg shadow-emerald-500/20 text-white relative overflow-hidden group">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700" />
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Interest</span>
                        </div>
                        <div className="text-3xl font-bold text-white relative z-10">{stats?.openRate || 0}%</div>
                        <p className="text-sm text-emerald-100 mt-1 relative z-10">Open rate performance</p>
                    </div>
                </div>

                {/* Leads Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Users className="w-5 h-5 text-slate-400" />
                            Email Details
                        </h2>
                        <span className="text-sm text-slate-400">{stats?.leads?.length || 0} emails tracked</span>
                    </div>

                    {!stats?.leads?.length ? (
                        <div className="p-12 text-center">
                            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500">No emails tracked yet. Send your first campaign!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Recipient</th>
                                        <th className="px-6 py-4 text-left">Company</th>
                                        <th className="px-6 py-4 text-left">Subject</th>
                                        <th className="px-6 py-4 text-left">Status</th>
                                        <th className="px-6 py-4 text-left">Sent</th>
                                        <th className="px-6 py-4 text-left">Last Opened</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {stats?.leads?.map((lead) => (
                                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-800">{lead.recipientName}</div>
                                                <div className="text-xs text-slate-400">{lead.recipientEmail}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{lead.companyName}</td>
                                            <td className="px-6 py-4">
                                                <div className="max-w-[200px] truncate text-slate-600" title={lead.subjectLine}>
                                                    {lead.subjectLine}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{getStatusBadge(lead)}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{formatDate(lead.sentAt)}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{formatDate(lead.lastOpenedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;

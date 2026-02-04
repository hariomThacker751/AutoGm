import React, { useState, useEffect } from 'react';
import { DashboardStats, TrackingData } from '../types';
import { BarChart3, Mail, Eye, TrendingUp, RefreshCw, Users, Clock, ExternalLink, DollarSign, LayoutDashboard, ArrowLeft, Zap, Activity } from 'lucide-react';

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
                <span className="badge badge-info">
                    <Eye className="w-3 h-3" />
                    Opened ({lead.openCount}x)
                </span>
            );
        }
        if (lead.sentAt) {
            return (
                <span className="badge badge-success">
                    <Mail className="w-3 h-3" />
                    Sent
                </span>
            );
        }
        return (
            <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
                Unknown
            </span>
        );
    };

    if (loading && !stats) {
        return (
            <div className="min-h-screen flex items-center justify-center relative">
                <div className="absolute inset-0 bg-deep">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
                </div>
                <div className="flex items-center gap-3 relative z-10">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary-400" />
                    <span className="text-lg font-medium text-gray-300">Loading analytics...</span>
                </div>
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
                        <div className="bg-gradient-to-br from-primary-500 to-neon-purple p-2.5 rounded-xl shadow-glow">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Command Center</h1>
                            <p className="text-xs text-gray-500 font-medium">Real-time Pipeline Analytics</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {lastUpdated && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Updated {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={fetchStats}
                            className="btn btn-icon btn-ghost"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
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

            {/* Stats Cards */}
            <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 stagger-children">
                    {/* Pipeline Value */}
                    <div className="metric-card animate-fade-up group">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="p-3 bg-neon-purple/20 rounded-xl group-hover:bg-neon-purple/30 transition-colors">
                                <DollarSign className="w-6 h-6 text-neon-purple" />
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pipeline</span>
                        </div>
                        <div className="metric-value relative z-10">
                            ${((stats?.leads?.length || 0) * 2500).toLocaleString()}
                        </div>
                        <p className="metric-label">Est. Value ($2.5k avg)</p>
                    </div>

                    {/* Total Sent */}
                    <div className="metric-card animate-fade-up" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-primary-500/20 rounded-xl">
                                <Mail className="w-6 h-6 text-primary-400" />
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Outreach</span>
                        </div>
                        <div className="text-3xl font-bold text-white">{stats?.totalSent || 0}</div>
                        <p className="metric-label">Emails delivered</p>
                    </div>

                    {/* Engagement (Opens) */}
                    <div className="metric-card animate-fade-up" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-neon-blue/20 rounded-xl">
                                <Users className="w-6 h-6 text-neon-blue" />
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Engaged</span>
                        </div>
                        <div className="text-3xl font-bold text-white">{stats?.totalOpened || 0}</div>
                        <p className="metric-label">Unique leads interested</p>
                    </div>

                    {/* Conversion Rate - Hero Card */}
                    <div className="relative overflow-hidden rounded-xl p-6 animate-fade-up" style={{
                        animationDelay: '0.3s',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    }}>
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
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
                <div className="glass-card overflow-hidden animate-fade-up" style={{ animationDelay: '0.4s' }}>
                    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-gray-500" />
                            Email Details
                        </h2>
                        <span className="text-sm text-gray-500">{stats?.leads?.length || 0} emails tracked</span>
                    </div>

                    {!stats?.leads?.length ? (
                        <div className="p-12 text-center">
                            <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">No emails tracked yet. Send your first campaign!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Recipient</th>
                                        <th>Company</th>
                                        <th>Subject</th>
                                        <th>Status</th>
                                        <th>Sent</th>
                                        <th>Last Opened</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats?.leads?.map((lead) => (
                                        <tr key={lead.id}>
                                            <td>
                                                <div className="font-medium text-white">{lead.recipientName}</div>
                                                <div className="text-xs text-gray-500">{lead.recipientEmail}</div>
                                            </td>
                                            <td className="text-gray-300">{lead.companyName}</td>
                                            <td>
                                                <div className="max-w-[200px] truncate text-gray-300" title={lead.subjectLine}>
                                                    {lead.subjectLine}
                                                </div>
                                            </td>
                                            <td>{getStatusBadge(lead)}</td>
                                            <td className="text-sm text-gray-500">{formatDate(lead.sentAt)}</td>
                                            <td className="text-sm text-gray-500">{formatDate(lead.lastOpenedAt)}</td>
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

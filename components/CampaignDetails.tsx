import React, { useState, useEffect, useRef } from 'react';
import { Campaign, PendingFollowUp, ImportedLead, TrackingData } from '../types';
import {
    Mail, Eye, TrendingUp, Users, RefreshCw, Upload, FileSpreadsheet,
    CheckCircle2, Zap, Clock, Send, Loader2, X, BarChart3, ChevronDown, ChevronUp, FastForward, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { generateSalesEmail, generateFollowUpEmail } from '../services/gemini';

interface CampaignDetailsProps {
    campaign: Campaign;
    userInfo: any;
    onSendEmails: (
        leads: ImportedLead[],
        campaignId: string,
        onProgress?: (current: number, success: number, failed: number) => void
    ) => Promise<void>;
    onSendFollowUps: (pending: PendingFollowUp[]) => Promise<{ success: number; failed: number }>;
    onTestEmail: (lead: ImportedLead) => Promise<{ success: boolean; error?: string }>;
    onRefresh: () => void;
}

interface CampaignAnalytics {
    totalSent: number;
    totalOpened: number;
    totalOpens: number;
    openRate: number;
    followUpsSent: number;
    leads: TrackingData[];
}

const CampaignDetails: React.FC<CampaignDetailsProps> = ({
    campaign,
    userInfo,
    onSendEmails,
    onSendFollowUps,
    onTestEmail,
    onRefresh
}) => {
    const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
    const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUp[]>([]);
    const [loading, setLoading] = useState(true);

    // Upload state
    const [leads, setLeads] = useState<ImportedLead[]>([]);
    const [senderName, setSenderName] = useState('');
    const [senderCompany, setSenderCompany] = useState('');
    const [sendingCampaign, setSendingCampaign] = useState(false);
    const [campaignProgress, setCampaignProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
    const [sendingFollowUps, setSendingFollowUps] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const [showUploadSection, setShowUploadSection] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<{ initial: any, followUps: any[] } | null>(null);
    const [generatingPreview, setGeneratingPreview] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchAnalytics = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/campaigns/${campaign.id}/analytics`);
            const data = await res.json();
            // Ensure leads is always an array
            setAnalytics({
                ...data,
                leads: Array.isArray(data?.leads) ? data.leads : []
            });
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        }
    };

    const fetchPendingFollowUps = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/campaigns/${campaign.id}/pending`);
            const data = await res.json();
            setPendingFollowUps(data.pendingFollowUps || []);
        } catch (err) {
            console.error('Failed to fetch pending follow-ups:', err);
        }
    };

    const refreshAll = async () => {
        setLoading(true);
        await Promise.all([fetchAnalytics(), fetchPendingFollowUps()]);
        setLoading(false);
    };

    useEffect(() => {
        refreshAll();
    }, [campaign.id]);

    // CSV Parsing
    const mapRowToLead = (row: any, index: number): ImportedLead => {
        const isEmail = (val: any) => String(val).includes('@') && String(val).includes('.');
        const keys = Object.keys(row);
        const values = Object.values(row);

        const emailKey = keys.find(k => [/email/i, /e-mail/i, /mail/i].some(p => p.test(k)));
        let recipientEmail = emailKey ? row[emailKey] : '';
        if (!isEmail(recipientEmail)) {
            const foundEmail = values.find(v => isEmail(v));
            if (foundEmail) recipientEmail = foundEmail;
        }

        const findKey = (patterns: RegExp[]) => keys.find(k => patterns.some(p => p.test(k)));
        const recipientName = row[findKey([/name/i, /recipient/i, /contact/i, /person/i]) || ''] || '';
        const companyName = row[findKey([/company/i, /business/i, /firm/i, /org/i]) || ''] || '';
        const industry = row[findKey([/industry/i, /market/i, /vertical/i, /niche/i]) || ''] || '';
        const keyPainPoint = row[findKey([/pain/i, /problem/i, /note/i, /issue/i]) || ''] || '';

        return {
            id: `lead_${index}_${Date.now()}`,
            status: 'idle',
            recipientName: String(recipientName || '').trim(),
            recipientEmail: String(recipientEmail || '').trim(),
            companyName: String(companyName || '').trim(),
            industry: String(industry || '').trim(),
            keyPainPoint: String(keyPainPoint || '').trim(),
            senderName: senderName || 'Your Name',
            senderCompany: senderCompany || 'Your Company',
            raw: row
        };
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            const parsedLeads = data.map((row, i) => mapRowToLead(row, i)).filter(l => l.recipientName || l.companyName);
            setLeads(parsedLeads);
            toast.success(`Loaded ${parsedLeads.length} leads`);
        };
        reader.readAsBinaryString(file);
    };

    const launchCampaign = async () => {
        if (leads.length === 0) {
            toast.error('Please upload a CSV file with leads first');
            return;
        }
        if (!userInfo) {
            toast.error('Please sign in with Google first to send emails');
            return;
        }
        if (!senderName.trim() || !senderCompany.trim()) {
            toast.error('Please fill in your name and company');
            return;
        }

        setSendingCampaign(true);
        setCampaignProgress({ current: 0, total: leads.length, success: 0, failed: 0 });

        const updatedLeads = leads.map(l => ({
            ...l,
            senderName: senderName.trim(),
            senderCompany: senderCompany.trim()
        }));

        let finalSuccess = 0;
        let finalFailed = 0;

        try {
            await onSendEmails(updatedLeads, campaign.id, (current, success, failed) => {
                setCampaignProgress({ current, total: leads.length, success, failed });
                finalSuccess = success;
                finalFailed = failed;
            });

            if (finalSuccess > 0) {
                toast.success(`Campaign launched!`, { description: `${finalSuccess} emails sent, ${finalFailed} failed` });
            } else {
                toast.error('Campaign failed', { description: 'No emails were sent successfully' });
            }
        } catch (error) {
            console.error('Campaign error:', error);
            toast.error('An error occurred while sending emails');
        }

        setSendingCampaign(false);
        setLeads([]);
        setShowUploadSection(false);
        refreshAll();
        onRefresh();
    };

    const handleSendFollowUps = async () => {
        if (pendingFollowUps.length === 0) return;
        setSendingFollowUps(true);

        try {
            const { success, failed } = await onSendFollowUps(pendingFollowUps);
            if (failed === 0) {
                toast.success(`Sent ${success} follow-ups!`);
            } else {
                toast.warning('Finished with errors', { description: `Sent: ${success}, Failed: ${failed}` });
            }
        } catch (error) {
            console.error('Follow-up error:', error);
            toast.error('Failed to send follow-ups');
        }

        setSendingFollowUps(false);
        await fetchPendingFollowUps();
    };

    const handleTestEmail = async () => {
        if (leads.length === 0) {
            toast.error('Please upload a CSV first');
            return;
        }
        if (!senderName.trim() || !senderCompany.trim()) {
            toast.error('Please fill in your name and company');
            return;
        }

        const testLead = { ...leads[0], senderName: senderName.trim(), senderCompany: senderCompany.trim() };
        setTestingEmail(true);

        try {
            const result = await onTestEmail(testLead);
            if (result.success) {
                toast.success('Test email sent!', { description: `Sent to ${testLead.recipientEmail}` });
            } else {
                toast.error('Test email failed', { description: result.error });
            }
        } catch (error: any) {
            toast.error('Test email failed', { description: error?.message || 'Unknown error' });
        }

        setTestingEmail(false);
    };

    const handlePreviewEmails = async () => {
        if (leads.length === 0) {
            toast.error('Please upload a CSV first');
            return;
        }
        if (!senderName.trim() || !senderCompany.trim()) {
            toast.error('Please fill in your name and company');
            return;
        }

        setGeneratingPreview(true);
        const testLead = { ...leads[0], senderName: senderName.trim(), senderCompany: senderCompany.trim() };

        try {
            // Generate initial email
            const initial = await generateSalesEmail(testLead);

            // Generate all follow-ups
            const followUps = [];
            const intervals = campaign.followUpIntervals || [];
            for (let i = 1; i <= intervals.length; i++) {
                const followUp = await generateFollowUpEmail(testLead, i, initial.subjectLine);
                followUps.push({ ...followUp, day: intervals[i - 1] });
            }

            setPreviewData({ initial, followUps });
            setShowPreview(true);
            toast.success('Preview generated!');
        } catch (error: any) {
            toast.error('Preview generation failed', { description: error?.message || 'Unknown error' });
        }

        setGeneratingPreview(false);
    };

    const handleExpedite = async () => {
        if (!confirm("⚡ Send Next Follow-up?\n\nThis will immediately send the next follow-up email in the sequence to all leads.")) return;

        try {
            // Call new endpoint to get leads ready for next follow-up
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/campaigns/${campaign.id}/send-next-followup`, { method: 'POST' });
            const data = await res.json();

            if (data.count === 0) {
                toast.info('No more follow-ups', { description: 'All leads have received all follow-ups in the sequence.' });
                return;
            }

            // Automatically send the follow-ups
            toast.info('Sending follow-ups...', { description: `Sending to ${data.count} leads` });
            const { success, failed } = await onSendFollowUps(data.pendingFollowUps);

            if (failed === 0) {
                toast.success(`✅ Sent Follow-up #${data.pendingFollowUps[0]?.followUpNumber + 1}`, {
                    description: `Sent to ${success} leads`
                });
            } else {
                toast.warning('Finished with errors', {
                    description: `Sent: ${success}, Failed: ${failed}`
                });
            }

            // Refresh data
            onRefresh();
        } catch (error) {
            console.error('Expedite error:', error);
            toast.error('Failed to send follow-ups');
        }
    };

    const getLeadStatusBadge = (lead: TrackingData) => {
        if (lead.openCount > 0) {
            return (
                <span className="badge badge-info">
                    <Eye className="w-3 h-3" />
                    Opened ({lead.openCount}x)
                </span>
            );
        }

        // Check follow-up status
        const followUps = (lead as any).followUpSequence || [];
        const sentCount = followUps.filter((f: any) => f.status === 'sent').length;
        const pendingCount = followUps.filter((f: any) => f.status === 'pending').length;

        if (pendingCount > 0) {
            return (
                <span className="badge badge-warning">
                    <Clock className="w-3 h-3" />
                    Waiting ({pendingCount} pending)
                </span>
            );
        }

        if (sentCount > 0) {
            return (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Mail className="w-3 h-3" />
                    Sent ({sentCount})
                </span>
            );
        }

        return (
            <span className="badge badge-success">
                <Mail className="w-3 h-3" />
                Initial Sent
            </span>
        );
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading && !analytics) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 animate-spin text-primary-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Campaign Header */}
            <div className="glass-card p-6 animate-fade-up">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
                        <p className="text-gray-500 mt-1">
                            Follow-ups on day: <span className="font-medium text-gray-300">{campaign.followUpIntervals?.join(', ') || 'None'}</span>
                        </p>
                    </div>
                    <button
                        onClick={refreshAll}
                        disabled={loading}
                        className="btn btn-icon btn-ghost"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
                    <div className="metric-card animate-fade-up">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-primary-500/20 rounded-lg">
                                <Mail className="w-5 h-5 text-primary-400" />
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sent</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{analytics.totalSent}</p>
                    </div>

                    <div className="metric-card animate-fade-up" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-neon-blue/20 rounded-lg">
                                <Eye className="w-5 h-5 text-neon-blue" />
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Opened</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{analytics.totalOpened}</p>
                    </div>

                    <div className="metric-card animate-fade-up" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-neon-purple/20 rounded-lg">
                                <Send className="w-5 h-5 text-neon-purple" />
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Follow-ups</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{analytics.followUpsSent}</p>
                    </div>

                    <div className="relative overflow-hidden rounded-xl p-5 animate-fade-up" style={{
                        animationDelay: '0.3s',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    }}>
                        <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12" />
                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Open Rate</span>
                        </div>
                        <p className="text-3xl font-bold text-white relative z-10">{analytics.openRate}%</p>
                    </div>
                </div>
            )}

            {/* Upload & Launch Section */}
            <div className="glass-card overflow-hidden animate-fade-up" style={{ animationDelay: '0.4s' }}>
                <button
                    onClick={() => setShowUploadSection(!showUploadSection)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-500/20 rounded-lg">
                            <Upload className="w-5 h-5 text-primary-400" />
                        </div>
                        <h3 className="font-bold text-white">Add Leads & Launch</h3>
                    </div>
                    {showUploadSection ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                </button>

                {showUploadSection && (
                    <div className="px-6 pb-6 space-y-4 border-t border-white/5 pt-4">
                        {/* Sender Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="input-label">Your Name</label>
                                <input
                                    type="text"
                                    value={senderName}
                                    onChange={(e) => setSenderName(e.target.value)}
                                    placeholder="John Smith"
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="input-label">Your Company</label>
                                <input
                                    type="text"
                                    value={senderCompany}
                                    onChange={(e) => setSenderCompany(e.target.value)}
                                    placeholder="Acme Inc"
                                    className="input-field"
                                />
                            </div>
                        </div>

                        {/* File Upload */}
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />

                        {leads.length === 0 ? (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="drop-zone w-full"
                            >
                                <FileSpreadsheet className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400 font-medium">Click to upload Excel/CSV file</p>
                                <p className="text-gray-600 text-xs mt-1">Supports .xlsx, .xls, .csv</p>
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                                        <span className="text-green-400 font-semibold">{leads.length} leads ready</span>
                                    </div>
                                    <button
                                        onClick={() => { setLeads([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                        className="text-green-400 hover:text-green-300 text-sm font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>

                                {/* Preview */}
                                <div className="text-xs space-y-1 text-gray-500 bg-white/5 p-3 rounded-lg">
                                    {leads.slice(0, 3).map((l, i) => (
                                        <p key={i}>• {l.recipientName} ({l.recipientEmail}) - {l.companyName}</p>
                                    ))}
                                    {leads.length > 3 && <p className="text-gray-600">...and {leads.length - 3} more</p>}
                                </div>

                                {/* Progress */}
                                {sendingCampaign && (
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="font-medium text-white">Sending: {campaignProgress.current}/{campaignProgress.total}</span>
                                            <div className="flex gap-3">
                                                <span className="text-green-400">✓ {campaignProgress.success}</span>
                                                {campaignProgress.failed > 0 && <span className="text-red-400">✗ {campaignProgress.failed}</span>}
                                            </div>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-2">
                                            <div
                                                className="bg-gradient-to-r from-primary-500 to-neon-purple h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${(campaignProgress.current / campaignProgress.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handlePreviewEmails}
                                        disabled={sendingCampaign || testingEmail || generatingPreview}
                                        className="btn btn-ghost flex-1 disabled:opacity-50"
                                    >
                                        {generatingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                                        Preview
                                    </button>
                                    <button
                                        onClick={handleTestEmail}
                                        disabled={sendingCampaign || testingEmail}
                                        className="btn btn-ghost flex-1 disabled:opacity-50"
                                    >
                                        {testingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                        Test
                                    </button>
                                    <button
                                        onClick={launchCampaign}
                                        disabled={sendingCampaign || testingEmail}
                                        className="btn btn-primary flex-[2] disabled:opacity-50"
                                    >
                                        {sendingCampaign ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-5 h-5" />
                                                Launch ({leads.length})
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Pending Follow-ups */}
            <div className="glass-card overflow-hidden animate-fade-up" style={{ animationDelay: '0.5s' }}>
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <Clock className="w-5 h-5 text-amber-400" />
                        </div>
                        <h3 className="font-bold text-white">Pending Follow-ups</h3>
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full border border-amber-500/30">
                            {pendingFollowUps.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExpedite}
                            className="text-xs font-semibold text-gray-400 hover:text-primary-400 flex items-center gap-1 transition-colors"
                        >
                            <FastForward className="w-3.5 h-3.5" />
                            Expedite
                        </button>
                        <button
                            onClick={handleSendFollowUps}
                            disabled={pendingFollowUps.length === 0 || sendingFollowUps}
                            className="btn btn-success text-sm disabled:opacity-50"
                        >
                            {sendingFollowUps ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Send All
                        </button>
                    </div>
                </div>

                {pendingFollowUps.length === 0 ? (
                    <div className="p-10 text-center">
                        <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">No follow-ups due</p>
                        <p className="text-gray-600 text-sm mt-1">Use "Expedite" to speed up the schedule</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5 max-h-64 overflow-y-auto custom-scrollbar">
                        {pendingFollowUps.map((item, idx) => (
                            <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                <div>
                                    <p className="font-medium text-white">{item.lead.recipientName}</p>
                                    <p className="text-xs text-gray-500">{item.lead.recipientEmail}</p>
                                </div>
                                <span className="badge badge-warning">
                                    Follow-up #{item.followUpNumber + 1}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Leads Table */}
            {analytics && analytics.leads && analytics.leads.length > 0 && (
                <div className="glass-card overflow-hidden animate-fade-up" style={{ animationDelay: '0.6s' }}>
                    <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-gray-400" />
                        </div>
                        <h3 className="font-bold text-white">All Leads</h3>
                        <span className="px-2 py-0.5 bg-white/5 text-gray-400 text-xs font-bold rounded-full border border-white/10">
                            {analytics.leads.length}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Recipient</th>
                                    <th>Company</th>
                                    <th>Status</th>
                                    <th>Sent</th>
                                    <th>Last Opened</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.leads.map((lead) => (
                                    <tr key={lead.id}>
                                        <td>
                                            <div>
                                                <p className="font-medium text-white">{lead.recipientName}</p>
                                                <p className="text-xs text-gray-500">{lead.recipientEmail}</p>
                                            </div>
                                        </td>
                                        <td className="text-gray-300">{lead.companyName}</td>
                                        <td>{getLeadStatusBadge(lead)}</td>
                                        <td className="text-sm text-gray-500">{formatDate(lead.sentAt)}</td>
                                        <td className="text-sm text-gray-500">{formatDate(lead.lastOpenedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreview && previewData && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card-elevated w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-surface border-b border-white/5 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Email Preview</h2>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="btn btn-icon btn-ghost"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Initial Email */}
                            <div className="border border-white/10 rounded-xl overflow-hidden">
                                <div className="bg-primary-500/10 px-4 py-3 border-b border-primary-500/20">
                                    <h3 className="font-bold text-primary-300 flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        Initial Email to {leads[0]?.recipientName}
                                    </h3>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <span className="text-xs font-bold text-gray-500 uppercase">Subject:</span>
                                        <p className="font-semibold text-white">{previewData.initial.subjectLine}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-gray-500 uppercase">Body:</span>
                                        <div
                                            className="mt-2 prose prose-sm max-w-none text-gray-300"
                                            dangerouslySetInnerHTML={{ __html: previewData.initial.emailBody }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Follow-ups */}
                            {previewData.followUps.map((followUp: any, index: number) => (
                                <div key={index} className="border border-white/10 rounded-xl overflow-hidden">
                                    <div className="bg-amber-500/10 px-4 py-3 border-b border-amber-500/20">
                                        <h3 className="font-bold text-amber-300 flex items-center gap-2">
                                            <Send className="w-4 h-4" />
                                            Follow-up #{index + 1} (Day {followUp.day})
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div>
                                            <span className="text-xs font-bold text-gray-500 uppercase">Subject:</span>
                                            <p className="font-semibold text-white">{followUp.subjectLine}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-gray-500 uppercase">Body:</span>
                                            <div
                                                className="mt-2 prose prose-sm max-w-none text-gray-300"
                                                dangerouslySetInnerHTML={{ __html: followUp.emailBody }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="sticky bottom-0 bg-surface border-t border-white/5 px-6 py-4">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="btn btn-primary w-full"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CampaignDetails;

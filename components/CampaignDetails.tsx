import React, { useState, useEffect, useRef } from 'react';
import { Campaign, PendingFollowUp, ImportedLead, TrackingData } from '../types';
import {
    Mail, Eye, TrendingUp, Users, RefreshCw, Upload, FileSpreadsheet,
    CheckCircle2, Zap, Clock, Send, Loader2, X, BarChart3, ChevronDown, ChevronUp, FastForward
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
            setAnalytics(data);
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
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100">
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
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-100">
                    <Clock className="w-3 h-3" />
                    Waiting ({pendingCount} pending)
                </span>
            );
        }

        if (sentCount > 0) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200">
                    <Mail className="w-3 h-3" />
                    Sent ({sentCount})
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full border border-indigo-100">
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
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Campaign Header */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{campaign.name}</h1>
                        <p className="text-slate-500 mt-1">
                            Follow-ups on day: <span className="font-medium text-slate-700">{campaign.followUpIntervals?.join(', ') || 'None'}</span>
                        </p>
                    </div>
                    <button
                        onClick={refreshAll}
                        disabled={loading}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-indigo-50 rounded-lg">
                                <Mail className="w-5 h-5 text-indigo-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sent</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{analytics.totalSent}</p>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Eye className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Opened</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{analytics.totalOpened}</p>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <Send className="w-5 h-5 text-purple-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Follow-ups</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{analytics.followUpsSent}</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white shadow-lg shadow-emerald-500/20">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Open Rate</span>
                        </div>
                        <p className="text-3xl font-bold">{analytics.openRate}%</p>
                    </div>
                </div>
            )}

            {/* Upload & Launch Section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                    onClick={() => setShowUploadSection(!showUploadSection)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Upload className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-slate-800">Add Leads & Launch</h3>
                    </div>
                    {showUploadSection ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {showUploadSection && (
                    <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4">
                        {/* Sender Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Your Name</label>
                                <input
                                    type="text"
                                    value={senderName}
                                    onChange={(e) => setSenderName(e.target.value)}
                                    placeholder="John Smith"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Your Company</label>
                                <input
                                    type="text"
                                    value={senderCompany}
                                    onChange={(e) => setSenderCompany(e.target.value)}
                                    placeholder="Acme Inc"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* File Upload */}
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />

                        {leads.length === 0 ? (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-10 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
                            >
                                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">Click to upload Excel/CSV file</p>
                                <p className="text-slate-400 text-xs mt-1">Supports .xlsx, .xls, .csv</p>
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                        <span className="text-emerald-700 font-semibold">{leads.length} leads ready</span>
                                    </div>
                                    <button
                                        onClick={() => { setLeads([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                        className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>

                                {/* Preview */}
                                <div className="text-xs space-y-1 text-slate-500 bg-slate-50 p-3 rounded-lg">
                                    {leads.slice(0, 3).map((l, i) => (
                                        <p key={i}>• {l.recipientName} ({l.recipientEmail}) - {l.companyName}</p>
                                    ))}
                                    {leads.length > 3 && <p className="text-slate-400">...and {leads.length - 3} more</p>}
                                </div>

                                {/* Progress */}
                                {sendingCampaign && (
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="font-medium">Sending: {campaignProgress.current}/{campaignProgress.total}</span>
                                            <div className="flex gap-3">
                                                <span className="text-emerald-600">✓ {campaignProgress.success}</span>
                                                {campaignProgress.failed > 0 && <span className="text-red-500">✗ {campaignProgress.failed}</span>}
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                            <div
                                                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
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
                                        className="flex-1 py-3 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors border border-blue-200"
                                    >
                                        {generatingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                                        Preview
                                    </button>
                                    <button
                                        onClick={handleTestEmail}
                                        disabled={sendingCampaign || testingEmail}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-200"
                                    >
                                        {testingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                        Test
                                    </button>
                                    <button
                                        onClick={launchCampaign}
                                        disabled={sendingCampaign || testingEmail}
                                        className="flex-[2] py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
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
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg">
                            <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                        <h3 className="font-bold text-slate-800">Pending Follow-ups</h3>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                            {pendingFollowUps.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExpedite}
                            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                        >
                            <FastForward className="w-3.5 h-3.5" />
                            Expedite
                        </button>
                        <button
                            onClick={handleSendFollowUps}
                            disabled={pendingFollowUps.length === 0 || sendingFollowUps}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            {sendingFollowUps ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Send All
                        </button>
                    </div>
                </div>

                {pendingFollowUps.length === 0 ? (
                    <div className="p-10 text-center">
                        <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No follow-ups due</p>
                        <p className="text-slate-400 text-sm mt-1">Use "Expedite" to speed up the schedule</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                        {pendingFollowUps.map((item, idx) => (
                            <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div>
                                    <p className="font-medium text-slate-800">{item.lead.recipientName}</p>
                                    <p className="text-xs text-slate-400">{item.lead.recipientEmail}</p>
                                </div>
                                <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-100">
                                    Follow-up #{item.followUpNumber + 1}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Leads Table */}
            {analytics && analytics.leads.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-slate-600" />
                        </div>
                        <h3 className="font-bold text-slate-800">All Leads</h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                            {analytics.leads.length}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 text-left">Recipient</th>
                                    <th className="px-6 py-4 text-left">Company</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                    <th className="px-6 py-4 text-left">Sent</th>
                                    <th className="px-6 py-4 text-left">Last Opened</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {analytics.leads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-slate-800">{lead.recipientName}</p>
                                                <p className="text-xs text-slate-400">{lead.recipientEmail}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{lead.companyName}</td>
                                        <td className="px-6 py-4">{getLeadStatusBadge(lead)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{formatDate(lead.sentAt)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{formatDate(lead.lastOpenedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreview && previewData && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">Email Preview</h2>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Initial Email */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
                                    <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        Initial Email to {leads[0]?.recipientName}
                                    </h3>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase">Subject:</span>
                                        <p className="font-semibold text-slate-800">{previewData.initial.subjectLine}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase">Body:</span>
                                        <div
                                            className="mt-2 prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: previewData.initial.emailBody }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Follow-ups */}
                            {previewData.followUps.map((followUp: any, index: number) => (
                                <div key={index} className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-amber-50 px-4 py-3 border-b border-amber-100">
                                        <h3 className="font-bold text-amber-900 flex items-center gap-2">
                                            <Send className="w-4 h-4" />
                                            Follow-up #{index + 1} (Day {followUp.day})
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase">Subject:</span>
                                            <p className="font-semibold text-slate-800">{followUp.subjectLine}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase">Body:</span>
                                            <div
                                                className="mt-2 prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{ __html: followUp.emailBody }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors"
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

import React, { useState, useEffect } from 'react';
import InputForm from './components/InputForm';
import EmailDisplay from './components/EmailDisplay';
import Dashboard from './components/Dashboard';
import CampaignManager from './components/CampaignManager';
import { FormData, EmailResponse, ImportedLead, PendingFollowUp } from './types';
import { generateSalesEmail, generateFollowUpEmail } from './services/gemini';

import { sendGmail, createEmailBody } from './services/gmail';
import { Toaster, toast } from 'sonner';
import { Bot, LogOut, LayoutDashboard, Play, Pause, Loader2, BarChart3, Folder } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

const App: React.FC = () => {
  const [userInfo, setUserInfo] = useState<any>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [emailData, setEmailData] = useState<EmailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastFormData, setLastFormData] = useState<FormData | null>(null);
  const [activeView, setActiveView] = useState<'campaign' | 'dashboard' | 'campaigns'>('campaign');

  // Bulk Campaign State
  const [leads, setLeads] = useState<ImportedLead[]>([]);
  const [isCampaignActive, setIsCampaignActive] = useState(false);
  const isCampaignActiveRef = React.useRef(false);
  const [campaignProgress, setCampaignProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  // --- Open Tracking Polling ---
  useEffect(() => {
    const interval = setInterval(async () => {
      if (leads.length === 0) return;

      try {
        const res = await fetch(`${API_URL}/status`);
        const openData = await res.json();

        setLeads(prevLeads =>
          prevLeads.map(lead => {
            if ((lead.status === 'sent' || lead.status === 'opened') && openData[lead.id] && lead.status !== 'opened') {
              return { ...lead, status: 'opened' };
            }
            return lead;
          })
        );
      } catch (err) {
        // Silent fail for polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [leads]);


  // NOTE: We no longer auto-load from localStorage as tokens expire after ~1 hour
  // User must sign in each session for fresh token
  useEffect(() => {
    // Clear any stale tokens on app load
    localStorage.removeItem('gmail_token');
  }, []);

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      console.log('✅ Google login successful, token received');
      setUserInfo(codeResponse);
      // Don't persist to localStorage - tokens expire quickly
    },
    scope: 'https://www.googleapis.com/auth/gmail.send',
    onError: (error) => {
      console.error('❌ Login Failed:', error);
      toast.error('Google login failed. Please try again.');
    }
  });

  const logout = () => {
    setUserInfo(null);
    localStorage.removeItem('gmail_token');
    console.log('Logged out');
  };

  const handleGenerate = async (formData: FormData) => {
    setLoading(true);
    setLastFormData(formData);
    try {
      const response = await generateSalesEmail(formData);
      setEmailData(response);
    } catch (error) {
      console.error("Failed to generate email", error);
      toast.error("Generation failed. Check API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (lastFormData) handleGenerate(lastFormData);
  };

  // Log sent email to tracking server
  const logSentEmail = async (lead: ImportedLead, subjectLine: string) => {
    try {
      await fetch(`${API_URL}/log-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          recipientEmail: lead.recipientEmail,
          recipientName: lead.recipientName,
          companyName: lead.companyName,
          subjectLine,
          senderName: lead.senderName,
          senderCompany: lead.senderCompany
        })
      });
    } catch (err) {
      console.error('Failed to log email:', err);
    }
  };

  // --- Bulk Campaign Logic ---
  const startCampaign = async () => {
    if (!userInfo || leads.length === 0) return;
    setIsCampaignActive(true);
    isCampaignActiveRef.current = true;
    setCampaignProgress({ current: 0, total: leads.length, success: 0, failed: 0 });

    for (let i = 0; i < leads.length; i++) {
      if (!isCampaignActiveRef.current && i > 0) break;

      const lead = leads[i];
      if (lead.status === 'sent') continue;

      updateLeadStatus(i, 'generating');
      setCampaignProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        const generated = await generateSalesEmail(lead);

        updateLeadStatus(i, 'sending');

        const pixelHtml = `<img src="${API_URL}/track/${lead.id}" width="1" height="1" style="display:none;" />`;
        const finalBody = generated.emailBody + pixelHtml;

        const rawBody = createEmailBody(lead.recipientEmail, generated.subjectLine, finalBody);
        await sendGmail(userInfo.access_token, rawBody);

        // Log to tracking server
        await logSentEmail(lead, generated.subjectLine);

        updateLeadStatus(i, 'sent');
        setCampaignProgress(prev => ({ ...prev, success: prev.success + 1 }));

      } catch (error) {
        console.error(`Failed for ${lead.recipientEmail}`, error);
        updateLeadStatus(i, 'error');
        setCampaignProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
      }

      if (i < leads.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    setIsCampaignActive(false);
    isCampaignActiveRef.current = false;
  };

  const stopCampaign = () => {
    isCampaignActiveRef.current = false;
    setIsCampaignActive(false);
  };

  const updateLeadStatus = (index: number, status: ImportedLead['status']) => {
    setLeads(prev => {
      const newLeads = [...prev];
      newLeads[index] = { ...newLeads[index], status };
      return newLeads;
    });
  };

  // --- Login Gate ---
  if (!userInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-100 via-slate-50 to-slate-50">
        <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl shadow-indigo-500/10 rounded-3xl p-12 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-8 transform -rotate-3">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">AutoPersuade AI</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Sign in to access the <strong>Grand Slam</strong> automated sales agent.
            <br />Turn cold leads into closed deals on autopilot.
          </p>

          <button
            onClick={() => login()}
            className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xl transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 3.09v4.2c9.02-3.09 9.87-14.88 2.08-16.14l-2.08 2.58c3.15.54 5.37 2.4 5.37 5.7z" /><path fill="currentColor" d="M7 21v-4.2c-4.32-3.13-1.63-9.52 3.63-8.08v-2.83c-6.85-2.06-13.43 4.61-9.98 12.06z" /><path fill="currentColor" d="M24 12c0-6.63-5.37-12-12-12-3.5 0-6.64 1.5-8.86 3.92l2.86 2.86C8.24 4.54 10.03 3.55 12 3.55c3.27 0 6.16 2.15 7.16 5.16h-3.32z" /><path fill="currentColor" d="M12 24c4.32 0 7.97-2.39 9.83-6l-4.14-3.13c-1.16 1.12-2.97 1.63-5.69.45v4.32z" /></svg>
            Continue with Google
          </button>
          <p className="mt-6 text-xs text-slate-400 font-medium uppercase tracking-widest">Secure • Fast • Automated</p>
        </div>
      </div>
    );
  }

  // Handle sending follow-ups
  const handleSendFollowUps = async (pending: PendingFollowUp[]): Promise<{ success: number; failed: number }> => {
    if (!userInfo) {
      alert('Please sign in first!');
      return { success: 0, failed: pending.length };
    }

    let success = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        // Safe access to sender info now that TrackingData has it
        const leadForAI: FormData = {
          recipientName: item.lead.recipientName,
          recipientEmail: item.lead.recipientEmail,
          companyName: item.lead.companyName,
          industry: 'your industry', // Fallback as initial industry might be lost, or fetch from campaign
          keyPainPoint: 'your goals', // Fallback
          senderName: item.lead.senderName || 'Your Name',
          senderCompany: item.lead.senderCompany || 'Your Company'
        };

        const generated = await generateFollowUpEmail(
          leadForAI,
          item.followUpNumber,
          item.lead.subjectLine
        );

        const pixelHtml = `<img src="${API_URL}/track/${item.leadId}" width="1" height="1" style="display:none;" />`;
        const finalBody = generated.emailBody + pixelHtml;
        const rawBody = createEmailBody(item.lead.recipientEmail, generated.subjectLine, finalBody);

        await sendGmail(userInfo.access_token, rawBody);

        // Mark as sent
        await fetch(`${API_URL}/follow-up-sent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: item.leadId,
            followUpIndex: item.followUpIndex,
            subjectLine: generated.subjectLine
          })
        });

        console.log(`Sent follow-up #${item.followUpNumber} to ${item.lead.recipientEmail}`);
        success++;
      } catch (error) {
        console.error(`Failed follow-up for ${item.lead.recipientEmail}`, error);
        failed++;
      }

      // Delay between emails
      await new Promise(r => setTimeout(r, 2000));
    }

    return { success, failed };
  };

  // Handle sending campaign emails from CampaignManager
  const handleSendCampaign = async (
    campaignLeads: ImportedLead[],
    campaignId: string,
    onProgress?: (current: number, success: number, failed: number) => void
  ) => {
    if (!userInfo) {
      alert('No user info - please sign in with Google first');
      return;
    }

    let success = 0;
    let failed = 0;
    let lastError = '';

    for (let i = 0; i < campaignLeads.length; i++) {
      const lead = campaignLeads[i];

      try {
        console.log(`[${i + 1}/${campaignLeads.length}] Generating email for ${lead.recipientEmail}...`);

        // Generate email
        const generated = await generateSalesEmail(lead);
        console.log(`Generated subject: ${generated.subjectLine}`);

        // Inject tracking pixel
        const pixelHtml = `<img src="${API_URL}/track/${lead.id}" width="1" height="1" style="display:none;" />`;
        const finalBody = generated.emailBody + pixelHtml;

        // Send via Gmail
        console.log(`Sending to ${lead.recipientEmail}...`);
        const rawBody = createEmailBody(lead.recipientEmail, generated.subjectLine, finalBody);
        await sendGmail(userInfo.access_token, rawBody);
        console.log(`✓ Sent successfully to ${lead.recipientEmail}`);

        // Log to tracking server with campaign ID
        await fetch(`${API_URL}/log-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: lead.id,
            recipientEmail: lead.recipientEmail,
            recipientName: lead.recipientName,
            companyName: lead.companyName,
            subjectLine: generated.subjectLine,
            campaignId,
            senderName: lead.senderName,
            senderCompany: lead.senderCompany
          })
        });

        success++;
      } catch (error: any) {
        failed++;
        lastError = error?.message || error?.toString() || 'Unknown error';
        console.error(`✗ Failed for ${lead.recipientEmail}:`, error);
      }

      // Update progress
      if (onProgress) {
        onProgress(i + 1, success, failed);
      }

      // Delay between emails
      if (i < campaignLeads.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Show detailed result
    if (failed > 0 && success === 0) {
      alert(`All ${failed} emails failed.\n\nLast error: ${lastError}\n\nCheck browser console (F12) for details.`);
    }
  };

  // Test single email before launching campaign
  const handleTestEmail = async (lead: ImportedLead): Promise<{ success: boolean; error?: string }> => {
    if (!userInfo) {
      return { success: false, error: 'Please sign in with Google first' };
    }

    try {
      console.log('🧪 Testing email generation for:', lead.recipientEmail);

      // Step 1: Generate email with Gemini
      const generated = await generateSalesEmail(lead);
      console.log('✓ Generated subject:', generated.subjectLine);

      // Step 2: Inject tracking pixel
      const pixelHtml = `<img src="${API_URL}/track/test_${Date.now()}" width="1" height="1" style="display:none;" />`;
      const finalBody = generated.emailBody + pixelHtml;

      // Step 3: Send via Gmail
      console.log('📧 Sending test email to:', lead.recipientEmail);
      const rawBody = createEmailBody(lead.recipientEmail, generated.subjectLine, finalBody);
      await sendGmail(userInfo.access_token, rawBody);

      console.log('✅ Test email sent successfully!');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Test email failed:', error);
      return {
        success: false,
        error: error?.message || error?.toString() || 'Unknown error'
      };
    }
  };

  // --- Dashboard View ---
  if (activeView === 'dashboard') {
    return <Dashboard onBack={() => setActiveView('campaign')} />;
  }

  // --- Campaigns View ---
  if (activeView === 'campaigns') {
    return (
      <CampaignManager
        onBack={() => setActiveView('campaign')}
        userInfo={userInfo}
        onSendEmails={handleSendCampaign}
        onSendFollowUps={handleSendFollowUps}
        onTestEmail={handleTestEmail}
      />
    );
  }

  // --- Main Campaign View ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-100 selection:text-primary-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-50 via-slate-50 to-slate-50">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary-600 to-primary-700 p-2 rounded-xl text-white shadow-lg shadow-primary-500/20 ring-1 ring-white/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
                AutoPersuade <span className="text-slate-400 font-medium text-sm ml-2 hidden sm:inline-block">/ Campaign</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isCampaignActive && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-600">
                    Sending {campaignProgress.current}/{campaignProgress.total}
                  </span>
                </div>
                <button
                  onClick={stopCampaign}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-full border border-red-200 transition-colors"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  Stop
                </button>
              </div>
            )}

            {/* Dashboard Button */}
            <button
              onClick={() => setActiveView('dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-semibold rounded-xl border border-indigo-100 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Command Center
            </button>

            {/* Campaigns Button */}
            <button
              onClick={() => setActiveView('campaigns')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 text-sm font-semibold rounded-xl border border-purple-100 transition-colors"
            >
              <Folder className="w-4 h-4" />
              Campaigns
            </button>

            <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-start">

          {/* Left: Input & Lead Manager */}
          <div className="lg:col-span-5 h-full relative z-10">
            <InputForm
              onSubmit={handleGenerate}
              isLoading={loading}
              leads={leads}
              setLeads={setLeads}
              onStartCampaign={startCampaign}
              isCampaignActive={isCampaignActive}
            />
          </div>

          {/* Right: Email Preview / Log */}
          <div className="lg:col-span-7 h-full relative z-10">
            <EmailDisplay
              data={emailData}
              onRegenerate={handleRegenerate}
              isRegenerating={loading && !!emailData}
              recipientEmail={lastFormData?.recipientEmail}
            />
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
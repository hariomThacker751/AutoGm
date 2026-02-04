import React, { useState, useEffect } from 'react';
import InputForm from './components/InputForm';
import EmailDisplay from './components/EmailDisplay';
import Dashboard from './components/Dashboard';
import CampaignManager from './components/CampaignManager';
import { FormData, EmailResponse, ImportedLead, PendingFollowUp } from './types';
import { generateSalesEmail, generateFollowUpEmail } from './services/gemini';

import { sendGmail, createEmailBody } from './services/gmail';
import { Toaster, toast } from 'sonner';
import { Bot, LogOut, LayoutDashboard, Play, Pause, Loader2, BarChart3, Folder, Zap, Sparkles } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

const App: React.FC = () => {
  // --- DEBUG OVERRIDE ---
  // --- DEBUG OVERRIDE REMOVED ---
  // ----------------------
  const [userInfo, setUserInfo] = useState<any>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [emailData, setEmailData] = useState<EmailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastFormData, setLastFormData] = useState<FormData | null>(null);
  const [activeView, setActiveView] = useState<'campaign' | 'dashboard' | 'campaigns'>(() => {
    const saved = localStorage.getItem('activeView');
    return (saved === 'dashboard' || saved === 'campaigns') ? saved : 'campaigns';
  });

  // Persist activeView to localStorage
  useEffect(() => {
    localStorage.setItem('activeView', activeView);
  }, [activeView]);

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

  const [autoSendEnabled, setAutoSendEnabled] = useState(false);

  // NOTE: We no longer auto-load from localStorage as tokens expire after ~1 hour
  // User must sign in each session for fresh token
  useEffect(() => {
    // Clear any stale tokens on app load
    localStorage.removeItem('gmail_token');
  }, []);

  const login = useGoogleLogin({
    flow: 'implicit',  // Simplified flow - directly gets access token
    onSuccess: async (tokenResponse) => {
      console.log('✅ Google access token received:', tokenResponse);
      const toastId = toast.loading('Getting user info...');

      try {
        // Get user info directly using the access token
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
        });
        const userInfo = await userInfoResponse.json();
        console.log('📡 User info:', userInfo);

        setUserInfo({
          access_token: tokenResponse.access_token,
          email: userInfo.email,
          name: userInfo.name
        });
        setAutoSendEnabled(false); // No refresh token with implicit flow
        toast.dismiss(toastId);
        toast.success('Signed in successfully!', {
          description: `Welcome, ${userInfo.name}!`,
          duration: 3000
        });
      } catch (error: any) {
        toast.dismiss(toastId);
        console.error('❌ Failed to get user info:', error);
        toast.error('Sign-in failed', {
          description: error.message || 'Check console for details',
          duration: 5000
        });
      }
    },
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    onError: (error) => {
      console.error('❌ Login Failed:', error);
      toast.error('Google login failed. Please try again.');
    }
  });

  const logout = () => {
    setUserInfo(null);
    setAutoSendEnabled(false);
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

  // --- Login Gate (Premium Dark Design) ---
  if (!userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-deep">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(139,92,246,0.1),transparent)]" />
        </div>

        {/* Login Card */}
        <div className="glass-card-elevated p-10 max-w-md w-full text-center relative z-10">
          {/* Logo */}
          <div className="relative mx-auto w-20 h-20 mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-neon-purple rounded-2xl rotate-6 opacity-50" />
            <div className="relative bg-gradient-to-br from-primary-500 to-neon-purple p-5 rounded-2xl shadow-glow">
              <Zap className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-2 tracking-tight">
            <span className="text-gradient">AutoPersuade</span>
            <span className="text-white/80 ml-2">AI</span>
          </h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Enterprise sales automation.
            <br />
            <span className="text-primary-400 font-medium">Turn cold leads into closed deals.</span>
          </p>

          <button
            onClick={() => login()}
            className="btn btn-primary w-full py-4 text-base group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continue with Google</span>
            <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <p className="mt-6 text-xs text-gray-500 font-medium uppercase tracking-widest flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Secure • Fast • Automated
          </p>
        </div>

        {/* Toast Container for Dark Theme */}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: '#1f2937',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f9fafb',
            }
          }}
        />
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
    return (
      <>
        <Dashboard onBack={() => setActiveView('campaigns')} />
        <Toaster theme="dark" position="top-center" />
      </>
    );
  }

  // --- Campaigns View (Primary Landing) ---
  if (activeView === 'campaigns') {
    return (
      <>
        <CampaignManager
          onBack={() => setActiveView('campaign')}
          userInfo={userInfo}
          onSendEmails={handleSendCampaign}
          onSendFollowUps={handleSendFollowUps}
          onTestEmail={handleTestEmail}
        />
        <Toaster theme="dark" position="top-center" />
      </>
    );
  }

  // --- Main Campaign View (Legacy Single Email) ---
  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="absolute inset-0 bg-deep">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-surface/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary-500 to-neon-purple p-2 rounded-xl shadow-glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                AutoPersuade <span className="text-gray-400 font-medium text-sm ml-1">/ Quick Send</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isCampaignActive && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 bg-surface px-4 py-1.5 rounded-full border border-white/10">
                  <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
                  <span className="text-xs font-semibold text-gray-300">
                    Sending {campaignProgress.current}/{campaignProgress.total}
                  </span>
                </div>
                <button
                  onClick={stopCampaign}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30 transition-colors"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  Stop
                </button>
              </div>
            )}

            {/* Auto-send Status */}
            {autoSendEnabled && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full border border-green-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Auto-Send On
              </div>
            )}

            {/* Dashboard Button */}
            <button
              onClick={() => setActiveView('dashboard')}
              className="btn btn-ghost text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>

            {/* Campaigns Button */}
            <button
              onClick={() => setActiveView('campaigns')}
              className="btn btn-primary text-sm"
            >
              <Folder className="w-4 h-4" />
              Campaigns
            </button>

            <button onClick={logout} className="text-sm font-medium text-gray-400 hover:text-red-400 transition-colors flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
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

      <Toaster theme="dark" position="top-center" />
    </div>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { createEmailBody, sendGmail } from '../services/gmail';
import { EmailResponse } from '../types';
import { Copy, Check, RefreshCw, Mail, ShieldCheck, Trophy, ExternalLink, Send, Sparkles, MonitorSmartphone } from 'lucide-react';

interface EmailDisplayProps {
  data: EmailResponse | null;
  onRegenerate: () => void;
  isRegenerating: boolean;
  recipientEmail?: string;
}

const EmailDisplay: React.FC<EmailDisplayProps> = ({ data, onRegenerate, isRegenerating, recipientEmail }) => {
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [sending, setSending] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState(recipientEmail || '');

  useEffect(() => {
    setTargetEmail(recipientEmail || '');
  }, [recipientEmail]);

  useEffect(() => {
    const storedToken = localStorage.getItem('gmail_token');
    if (storedToken) {
      setUserInfo(JSON.parse(storedToken));
    }
  }, []);

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      setUserInfo(codeResponse);
      localStorage.setItem('gmail_token', JSON.stringify(codeResponse));
    },
    scope: 'https://www.googleapis.com/auth/gmail.send',
    onError: (error) => console.log('Login Failed:', error)
  });

  const handleSendGmail = async () => {
    if (!data || !userInfo || !targetEmail) {
      setStatusMsg("Missing recipient or not logged in.");
      return;
    }

    setSending(true);
    setStatusMsg("");

    try {
      const raw = createEmailBody(targetEmail, data.subjectLine, data.emailBody);
      await sendGmail(userInfo.access_token, raw);
      setStatusMsg("Email Sent Successfully! 🚀");
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleCopySubject = () => {
    if (data) {
      navigator.clipboard.writeText(data.subjectLine);
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    }
  };

  const handleCopyBody = () => {
    if (data) {
      // Create a temporary element to copy HTML content effectively if needed, 
      // but for raw HTML copy, text is fine. Usually users want the Rendered text or the Source.
      // Let's copy the raw text for pasting into Gmail manually if needed.
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.emailBody;
      navigator.clipboard.writeText(tempDiv.innerText); // Copy plain text version for safety
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
  };

  const handleLaunchGmail = () => {
    if (!data) return;
    const subject = encodeURIComponent(data.subjectLine);
    // Best effort text conversion
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = data.emailBody;
    const body = encodeURIComponent(tempDiv.innerText);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${targetEmail}&su=${subject}&body=${body}`, '_blank');
  };

  if (!data && !isRegenerating) {
    return (
      <div className="h-full bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl shadow-indigo-500/5 rounded-3xl flex flex-col items-center justify-center p-12 text-center transition-all hover:shadow-2xl hover:shadow-indigo-500/10 duration-500">
        <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <MonitorSmartphone className="w-10 h-10 text-indigo-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Ready to Persuade?</h3>
        <p className="text-slate-500 max-w-sm">
          Enter your prospect's details on the left, and I'll craft a "Grand Slam Offer" they can't ignore.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">

      {/* Generated Content Card */}
      <div className="bg-white/90 backdrop-blur shadow-2xl shadow-indigo-500/10 rounded-2xl border border-white/50 overflow-hidden flex flex-col h-[calc(100vh-140px)] sticky top-24">

        {/* Window Header */}
        <div className="bg-slate-50/80 backdrop-blur-md px-6 py-4 border-b border-slate-200/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-400 shadow-sm"></div>
            <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm"></div>
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            AI Draft Preview
          </div>
          <div className="w-12"></div> {/* Spacer for balance */}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white relative scroll-smooth">

          {isRegenerating && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center transition-all duration-300">
              <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-xl shadow-2xl shadow-indigo-500/20 border border-indigo-50">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                <span className="text-sm font-semibold text-slate-600">Polishing Draft...</span>
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">

            {/* Subject Line */}
            <div className="group relative transition-all duration-200 hover:bg-slate-50 p-4 -mx-4 rounded-xl">
              <div className="absolute left-4 -top-0 text-[10px] font-bold text-slate-300 uppercase tracking-wider bg-white px-1">Subject</div>
              <div className="text-xl font-medium text-slate-800 flex items-start justify-between gap-4 mt-2">
                <span className="leading-relaxed">{data?.subjectLine}</span>
                <button
                  onClick={handleCopySubject}
                  className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-slate-100"
                  title="Copy Subject"
                >
                  {copiedSubject ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Email Body */}
            <div className="group relative min-h-[300px] transition-all duration-200 hover:bg-slate-50/50 p-4 -mx-4 rounded-xl">
              <div className="absolute left-4 -top-0 text-[10px] font-bold text-slate-300 uppercase tracking-wider bg-white px-1">Message Body</div>

              <div
                className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-sans mt-4"
                dangerouslySetInnerHTML={{ __html: data?.emailBody || '' }}
              />

              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={handleCopyBody}
                  className="p-2 bg-white hover:bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors shadow-sm border border-slate-100"
                  title="Copy Body"
                >
                  {copiedBody ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Strategy Insight */}
            <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-6 border border-indigo-100/50 shadow-sm my-8">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Strategy Insight</h4>
              </div>
              <p className="text-sm text-indigo-900/70 leading-relaxed font-medium">
                {data?.strategyExplanation}
              </p>
            </div>

          </div>
        </div>

        {/* Footer Toolbar */}
        <div className="bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 z-20">

          {/* Recipient Input */}
          <div className="max-w-3xl mx-auto mb-4 flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all hover:border-slate-300">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-3">To:</span>
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="bg-transparent border-none outline-none text-sm text-slate-700 w-full placeholder:text-slate-300 font-medium h-9"
            />
          </div>

          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3">
            <button
              onClick={onRegenerate}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>

            <div className="flex-1"></div>

            <button
              onClick={handleLaunchGmail}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98]"
            >
              <ExternalLink className="w-4 h-4" />
              Open Draft
            </button>

            {userInfo ? (
              <button
                onClick={handleSendGmail}
                disabled={sending}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : 'Send Now'}
              </button>
            ) : (
              <button
                onClick={() => login()}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Mail className="w-4 h-4" />
                Connect Gmail
              </button>
            )}
          </div>

          {statusMsg && (
            <div className="text-center mt-3 text-sm font-medium animate-fadeIn">
              {statusMsg.includes('Success') ? (
                <span className="text-emerald-600 flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" /> {statusMsg}
                </span>
              ) : (
                <span className="text-rose-500">{statusMsg}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailDisplay;
import React, { useState, useRef } from 'react';
import { FormData, ImportedLead } from '../types';
import { Send, Sparkles, User, Briefcase, Building2, MessageSquareWarning, Upload, FileSpreadsheet, Mail, CheckCircle2, Play, Loader2, AlertCircle, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';

interface InputFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
  leads: ImportedLead[];
  setLeads: React.Dispatch<React.SetStateAction<ImportedLead[]>>;
  onStartCampaign: () => void;
  isCampaignActive: boolean;
}

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, leads, setLeads, onStartCampaign, isCampaignActive }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('import');
  const [selectedLeadIndex, setSelectedLeadIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState<FormData>({
    recipientName: '',
    recipientEmail: '',
    companyName: '',
    industry: '',
    keyPainPoint: '',
    senderName: 'Hariom',
    senderCompany: 'Autonerve'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const mapRowToLead = (row: any, index: number): ImportedLead => {
    // Helper to check if a value looks like an email
    const isEmail = (val: any) => String(val).includes('@') && String(val).includes('.');

    // 1. Get all keys and values
    const keys = Object.keys(row);
    const values = Object.values(row);

    // 2. Try to find the email column
    const emailKey = keys.find(k => [/email/i, /e-mail/i, /mail/i].some(p => p.test(k)));
    let recipientEmail = emailKey ? row[emailKey] : '';

    if (!isEmail(recipientEmail)) {
      const foundEmail = values.find(v => isEmail(v));
      if (foundEmail) recipientEmail = foundEmail;
    }

    // 3. Find other columns
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
      senderName: formData.senderName, // Inherit sender info
      senderCompany: formData.senderCompany,
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
    };
    reader.readAsBinaryString(file);
  };

  const handleGenerateSample = (lead: ImportedLead, index: number) => {
    setSelectedLeadIndex(index);
    // Ensure sender info is up to date
    const sampleData = { ...lead, senderName: formData.senderName, senderCompany: formData.senderCompany };
    onSubmit(sampleData);
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const getStatusBadge = (status: ImportedLead['status']) => {
    switch (status) {
      case 'sending': return <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><Loader2 className="w-3 h-3 animate-spin" /> Sending</span>;
      case 'generating': return <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100"><Sparkles className="w-3 h-3 animate-pulse" /> Writing</span>;
      case 'sent': return <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> Sent</span>;
      case 'opened': return <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100"><Eye className="w-3 h-3" /> Opened</span>;
      case 'error': return <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100"><AlertCircle className="w-3 h-3" /> Error</span>;
      default: return <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">Waiting</span>;
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl shadow-indigo-500/5 rounded-3xl h-full flex flex-col overflow-hidden transition-all hover:shadow-2xl hover:shadow-indigo-500/10 duration-500">
      <div className="p-6 md:p-8 pb-0">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            Campaign Setup
          </h2>

          <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/50 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === 'manual'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
            >
              Manual
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${activeTab === 'import'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel Import
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8 custom-scrollbar">

        {/* Persistent Sender Info */}
        <div className="mb-8 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <User className="w-12 h-12 text-indigo-200/50 -rotate-12" />
          </div>
          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Your Profile (Sender)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Your Name</label>
              <input
                type="text"
                name="senderName"
                placeholder="e.g. Hariom"
                value={formData.senderName}
                onChange={handleChange}
                className="w-full rounded-xl border-transparent bg-white shadow-sm ring-1 ring-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Your Company</label>
              <input
                type="text"
                name="senderCompany"
                placeholder="e.g. Autonerve"
                value={formData.senderCompany}
                onChange={handleChange}
                className="w-full rounded-xl border-transparent bg-white shadow-sm ring-1 ring-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
              />
            </div>
          </div>
        </div>

        {activeTab === 'import' ? (
          <div className="space-y-6">
            <div
              className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-all duration-300 cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-white transition-all shadow-sm">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-primary-500 transition-colors" />
              </div>
              <p className="text-base font-semibold text-slate-700">Click to upload Excel or CSV</p>
              <p className="text-sm text-slate-400 mt-1">Supported formats: .xlsx, .csv</p>
            </div>

            {leads.length > 0 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    Ready to Send: {leads.length} Leads
                  </h3>
                  <button
                    onClick={() => setLeads([])}
                    className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-colors"
                  >
                    Clear List
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50/90 backdrop-blur text-slate-500 font-semibold sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3.5 w-1/4">Name</th>
                          <th className="px-5 py-3.5 w-1/4">Company</th>
                          <th className="px-5 py-3.5 w-1/4">Status</th>
                          <th className="px-5 py-3.5 text-right w-1/4">Sample</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leads.map((lead, idx) => (
                          <tr
                            key={lead.id || idx}
                            className={`group transition-colors ${selectedLeadIndex === idx ? 'bg-primary-50/50' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-5 py-3.5 font-medium text-slate-700">
                              {lead.recipientName || <span className="text-slate-300 italic">Unknown</span>}
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{lead.recipientEmail}</div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">{lead.companyName || <span className="text-slate-300 italic">-</span>}</td>
                            <td className="px-5 py-3.5">
                              {getStatusBadge(lead.status)}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => handleGenerateSample(lead, idx)}
                                disabled={isCampaignActive}
                                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all border shadow-sm ${selectedLeadIndex === idx
                                  ? 'bg-primary-600 text-white border-primary-600'
                                  : 'bg-white border-slate-200 text-slate-500 hover:border-primary-400 hover:text-primary-600'
                                  }`}
                              >
                                Preview
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                  Target Prospect
                </h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Recipient Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="recipientName"
                    required
                    placeholder="e.g. John Doe"
                    value={formData.recipientName}
                    onChange={handleChange}
                    className="pl-10 w-full rounded-xl border-transparent bg-slate-50 p-3 text-sm focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all duration-300 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Recipient Email <span className="text-slate-400 font-normal opacity-70">(For Sending)</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    name="recipientEmail"
                    placeholder="e.g. john@acme.com"
                    value={formData.recipientEmail}
                    onChange={handleChange}
                    className="pl-10 w-full rounded-xl border-transparent bg-slate-50 p-3 text-sm focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all duration-300 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Company Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Building2 className="h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      name="companyName"
                      required
                      placeholder="Acme Corp"
                      value={formData.companyName}
                      onChange={handleChange}
                      className="pl-10 w-full rounded-xl border-transparent bg-slate-50 p-3 text-sm focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all duration-300 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Industry / Niche</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Briefcase className="h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      name="industry"
                      required
                      placeholder="SaaS..."
                      value={formData.industry}
                      onChange={handleChange}
                      className="pl-10 w-full rounded-xl border-transparent bg-slate-50 p-3 text-sm focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all duration-300 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">
                  Specific Pain Point <span className="text-slate-400 font-normal opacity-70">(Optional)</span>
                </label>
                <div className="relative group">
                  <textarea
                    name="keyPainPoint"
                    placeholder="e.g. Slow response times, losing leads on weekends"
                    value={formData.keyPainPoint}
                    onChange={handleChange}
                    rows={3}
                    className="w-full rounded-xl border-transparent bg-slate-50 p-3 text-sm focus:bg-white focus:ring-4 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all duration-300 placeholder:text-slate-400 resize-none"
                  />
                  <div className="absolute top-3 right-3 pointer-events-none">
                    <MessageSquareWarning className="h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 md:p-8 pt-4 border-t border-slate-100/50 bg-white/50 backdrop-blur-sm">
        {activeTab === 'import' ? (
          <button
            onClick={onStartCampaign}
            disabled={isCampaignActive || leads.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-[length:200%_auto] hover:bg-right"
          >
            {isCampaignActive ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Campaign Running...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Start Bulk Campaign ({leads.length})</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleSubmitManual}
            disabled={isLoading || (!formData.recipientName && !formData.senderName)}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-[length:200%_auto] hover:bg-right"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                <span>Crafting Email...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Generate High-Converting Email</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default InputForm;
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  follow_up_intervals INTEGER[] DEFAULT '{2,5,10}',
  sender_name TEXT,
  sender_company TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  company_name TEXT,
  industry TEXT,
  key_pain_point TEXT,
  subject_line TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  stopped BOOLEAN DEFAULT FALSE,
  open_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMP WITH TIME ZONE,
  sender_name TEXT,
  sender_company TEXT
);

-- Create follow_ups table
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);

-- Enable Row Level Security (RLS)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can view their own campaigns"
  ON campaigns FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own campaigns"
  ON campaigns FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own campaigns"
  ON campaigns FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own leads"
  ON leads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own leads"
  ON leads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own leads"
  ON leads FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own leads"
  ON leads FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view follow-ups for their leads"
  ON follow_ups FOR SELECT
  USING (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert follow-ups for their leads"
  ON follow_ups FOR INSERT
  WITH CHECK (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()));

CREATE POLICY "Users can update follow-ups for their leads"
  ON follow_ups FOR UPDATE
  USING (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete follow-ups for their leads"
  ON follow_ups FOR DELETE
  USING (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()));

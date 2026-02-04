import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { supabase } from './db.js';
import { startScheduler } from './scheduler.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// ============== AUTH ENDPOINTS ==============

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Autopersuade Backend Running' });
});

// Exchange authorization code for tokens
app.post('/auth/token', async (req, res) => {
    try {
        const { code, userEmail, redirectUri } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri || 'postmessage'
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.json();
            console.error('[AUTH] Token exchange failed:', error);
            return res.status(400).json({ error: error.error_description || 'Token exchange failed' });
        }

        const tokens = await tokenResponse.json();
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

        // Get user info
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const userInfo = await userInfoResponse.json();

        // Upsert user with tokens
        const { data: user, error: upsertError } = await supabase
            .from('users')
            .upsert({
                email: userInfo.email,
                name: userInfo.name,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_expires_at: expiresAt.toISOString()
            }, {
                onConflict: 'email'
            })
            .select()
            .single();

        if (upsertError) throw upsertError;

        console.log(`[AUTH] ✓ Tokens stored for user: ${userInfo.email}`);
        res.json({
            success: true,
            user: {
                email: userInfo.email,
                name: userInfo.name
            },
            access_token: tokens.access_token,
            autoSendEnabled: !!tokens.refresh_token
        });
    } catch (error) {
        console.error('[AUTH] Error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Check auto-send status
app.get('/auth/status', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.json({ autoSendEnabled: false });
        }

        const { data: user } = await supabase
            .from('users')
            .select('refresh_token')
            .eq('email', email)
            .single();

        res.json({ autoSendEnabled: !!user?.refresh_token });
    } catch (error) {
        res.json({ autoSendEnabled: false });
    }
});

// ============== CAMPAIGN ENDPOINTS ==============

// Create a new campaign
app.post('/campaigns', async (req, res) => {
    try {
        const { name, followUpIntervals, senderName, senderCompany, userEmail } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Campaign name is required' });
        }

        // For now, we'll use a default user if not provided
        // In production, you'd get this from auth headers
        const defaultUserEmail = userEmail || 'default@user.com';

        // Get or create user (simplified - no auth for now)
        let { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', defaultUserEmail)
            .single();

        if (!user) {
            const { data: newUser } = await supabase
                .from('users')
                .insert([{ email: defaultUserEmail, name: senderName }])
                .select()
                .single();
            user = newUser;
        }

        const id = `campaign_${Date.now()}`;
        const { data: campaign, error } = await supabase
            .from('campaigns')
            .insert([{
                id,
                user_id: user.id,
                name,
                follow_up_intervals: followUpIntervals || [2, 5, 10],
                sender_name: senderName || 'Unknown',
                sender_company: senderCompany || 'Unknown'
            }])
            .select()
            .single();

        if (error) throw error;

        console.log(`[CAMPAIGN] Created: ${name} (${id})`);
        res.json({
            ...campaign,
            followUpIntervals: campaign.follow_up_intervals,
            senderName: campaign.sender_name,
            senderCompany: campaign.sender_company,
            createdAt: campaign.created_at,
            totalLeads: 0,
            sentCount: 0,
            openedCount: 0
        });
    } catch (error) {
        console.error('[CAMPAIGN] Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// Get all campaigns
app.get('/campaigns', async (req, res) => {
    try {
        const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get lead counts for each campaign
        const campaignsWithStats = await Promise.all(campaigns.map(async (campaign) => {
            const { data: leads } = await supabase
                .from('leads')
                .select('id, open_count, sent_at')
                .eq('campaign_id', campaign.id);

            return {
                id: campaign.id,
                name: campaign.name,
                followUpIntervals: campaign.follow_up_intervals,
                senderName: campaign.sender_name,
                senderCompany: campaign.sender_company,
                createdAt: campaign.created_at,
                totalLeads: leads?.length || 0,
                sentCount: leads?.filter(l => l.sent_at).length || 0,
                openedCount: leads?.filter(l => l.open_count > 0).length || 0
            };
        }));

        res.json(campaignsWithStats);
    } catch (error) {
        console.error('[CAMPAIGN] Error fetching campaigns:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

// Get pending follow-ups for a campaign
app.get('/campaigns/:id/pending', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Get all leads for this campaign with their follow-ups
        const { data: leads } = await supabase
            .from('leads')
            .select('*, follow_ups(*)')
            .eq('campaign_id', id)
            .eq('stopped', false)
            .not('sent_at', 'is', null);

        const now = new Date();
        const pendingFollowUps = [];

        leads?.forEach(lead => {
            const followUps = lead.follow_ups || [];
            followUps.forEach((followUp, index) => {
                if (followUp.status !== 'pending') return;

                const sentDate = new Date(lead.sent_at);
                const dueDate = new Date(sentDate);
                dueDate.setDate(dueDate.getDate() + followUp.day);

                if (now >= dueDate) {
                    pendingFollowUps.push({
                        leadId: lead.id,
                        lead: {
                            recipientEmail: lead.recipient_email,
                            recipientName: lead.recipient_name,
                            companyName: lead.company_name,
                            subjectLine: lead.subject_line,
                            senderName: lead.sender_name,
                            senderCompany: lead.sender_company
                        },
                        followUpIndex: index,
                        followUpNumber: index,
                        dueDate: dueDate.toISOString()
                    });
                }
            });
        });

        res.json({
            campaign: {
                id: campaign.id,
                name: campaign.name,
                followUpIntervals: campaign.follow_up_intervals
            },
            pendingFollowUps,
            count: pendingFollowUps.length
        });
    } catch (error) {
        console.error('[CAMPAIGN] Error fetching pending follow-ups:', error);
        res.status(500).json({ error: 'Failed to fetch pending follow-ups' });
    }
});

// Get analytics for a specific campaign
app.get('/campaigns/:id/analytics', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const { data: leads } = await supabase
            .from('leads')
            .select('*, follow_ups(*)')
            .eq('campaign_id', id)
            .order('sent_at', { ascending: false });

        const totalSent = leads?.filter(l => l.sent_at).length || 0;
        const totalOpened = leads?.filter(l => l.open_count > 0).length || 0;
        const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
        const totalOpens = leads?.reduce((sum, l) => sum + (l.open_count || 0), 0) || 0;

        let followUpsSent = 0;
        leads?.forEach(l => {
            l.follow_ups?.forEach((f, i) => {
                if (i > 0 && f.status === 'sent') followUpsSent++;
            });
        });

        // Transform leads to match expected format
        const transformedLeads = leads?.map(l => ({
            id: l.id,
            recipientEmail: l.recipient_email,
            recipientName: l.recipient_name,
            companyName: l.company_name,
            industry: l.industry,
            subjectLine: l.subject_line,
            sentAt: l.sent_at,
            openCount: l.open_count,
            lastOpenedAt: l.last_opened_at,
            stopped: l.stopped,
            followUpSequence: l.follow_ups?.map(f => ({
                day: f.day,
                status: f.status,
                sentAt: f.sent_at
            })) || []
        })) || [];

        res.json({
            campaign: {
                id: campaign.id,
                name: campaign.name,
                followUpIntervals: campaign.follow_up_intervals
            },
            totalSent,
            totalOpened,
            totalOpens,
            openRate,
            followUpsSent,
            leads: transformedLeads
        });
    } catch (error) {
        console.error('[CAMPAIGN] Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Send Next Follow-up
app.post('/campaigns/:id/send-next-followup', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: leads } = await supabase
            .from('leads')
            .select('*, follow_ups(*)')
            .eq('campaign_id', id)
            .eq('stopped', false)
            .not('sent_at', 'is', null);

        const leadsForNextFollowUp = [];

        leads?.forEach(lead => {
            const followUps = lead.follow_ups || [];
            const nextFollowUpIndex = followUps.findIndex(f => f.status === 'pending');

            if (nextFollowUpIndex !== -1) {
                leadsForNextFollowUp.push({
                    leadId: lead.id,
                    lead: {
                        recipientEmail: lead.recipient_email,
                        recipientName: lead.recipient_name,
                        companyName: lead.company_name,
                        subjectLine: lead.subject_line,
                        senderName: lead.sender_name,
                        senderCompany: lead.sender_company
                    },
                    followUpIndex: nextFollowUpIndex,
                    followUpNumber: nextFollowUpIndex,
                    dueDate: new Date().toISOString()
                });
            }
        });

        console.log(`[SEND-NEXT] Campaign ${id} has ${leadsForNextFollowUp.length} leads ready for next follow-up`);
        res.json({
            success: true,
            pendingFollowUps: leadsForNextFollowUp,
            count: leadsForNextFollowUp.length
        });
    } catch (error) {
        console.error('[CAMPAIGN] Error in send-next-followup:', error);
        res.status(500).json({ error: 'Failed to get next follow-ups' });
    }
});

// ============== LEAD/TRACKING ENDPOINTS ==============

// Log sent email
app.post('/log-send', async (req, res) => {
    try {
        const { id, recipientEmail, recipientName, companyName, subjectLine, campaignId, senderName, senderCompany, industry, keyPainPoint } = req.body;

        if (!id || !recipientEmail) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get campaign and user info
        let userId = null;
        let followUpIntervals = [];

        if (campaignId) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('user_id, follow_up_intervals')
                .eq('id', campaignId)
                .single();

            if (campaign) {
                userId = campaign.user_id;
                followUpIntervals = campaign.follow_up_intervals || [];
            }
        }

        // If no campaign or user, get/create default user
        if (!userId) {
            let { data: user } = await supabase
                .from('users')
                .select('*')
                .eq('email', 'default@user.com')
                .single();

            if (!user) {
                const { data: newUser } = await supabase
                    .from('users')
                    .insert([{ email: 'default@user.com', name: 'Default User' }])
                    .select()
                    .single();
                user = newUser;
            }
            userId = user.id;
        }

        // Insert lead
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .insert([{
                id,
                campaign_id: campaignId || null,
                user_id: userId,
                recipient_email: recipientEmail,
                recipient_name: recipientName || 'Unknown',
                company_name: companyName || 'Unknown',
                industry: industry || null,
                key_pain_point: keyPainPoint || null,
                subject_line: subjectLine || 'No Subject',
                sender_name: senderName || 'Unknown',
                sender_company: senderCompany || 'Unknown',
                sent_at: new Date().toISOString(),
                open_count: 0,
                stopped: false
            }])
            .select()
            .single();

        if (leadError) throw leadError;

        // Create follow-up schedule
        if (followUpIntervals.length > 0) {
            const followUps = followUpIntervals.map(day => ({
                lead_id: id,
                day,
                status: 'pending'
            }));

            await supabase.from('follow_ups').insert(followUps);
        }

        console.log(`[LOGGED] Email sent to: ${recipientEmail} (Campaign: ${campaignId || 'none'})`);
        res.json({ success: true, id });
    } catch (error) {
        console.error('[LOG-SEND] Error:', error);
        res.status(500).json({ error: 'Failed to log email' });
    }
});

// Mark follow-up as sent
app.post('/follow-up-sent', async (req, res) => {
    try {
        const { leadId, followUpIndex, subjectLine } = req.body;

        const { data: followUps } = await supabase
            .from('follow_ups')
            .select('*')
            .eq('lead_id', leadId)
            .order('day', { ascending: true });

        if (followUps && followUps[followUpIndex]) {
            await supabase
                .from('follow_ups')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString()
                })
                .eq('id', followUps[followUpIndex].id);

            console.log(`[FOLLOW-UP] Sent #${followUpIndex + 1} to lead: ${leadId}`);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[FOLLOW-UP-SENT] Error:', error);
        res.status(500).json({ error: 'Failed to mark follow-up as sent' });
    }
});

// Tracking  pixel
app.get('/track/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const now = new Date().toISOString();

        if (id) {
            const { data: lead } = await supabase
                .from('leads')
                .select('*')
                .eq('id', id)
                .single();

            if (lead) {
                await supabase
                    .from('leads')
                    .update({
                        open_count: (lead.open_count || 0) + 1,
                        last_opened_at: now,
                        stopped: true
                    })
                    .eq('id', id);

                console.log(`[TRACK] Email Opened: ${lead.recipient_email} - Sequence STOPPED`);
            }
        }

        const img = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': img.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(img);
    } catch (error) {
        console.error('[TRACK] Error:', error);
        const img = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': img.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(img);
    }
});

// Analytics endpoint (global)
app.get('/analytics', async (req, res) => {
    try {
        const { data: leads } = await supabase
            .from('leads')
            .select('*, follow_ups(*)')
            .order('sent_at', { ascending: false });

        const totalSent = leads?.filter(l => l.sent_at).length || 0;
        const totalOpened = leads?.filter(l => l.open_count > 0).length || 0;
        const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
        const totalOpens = leads?.reduce((sum, l) => sum + (l.open_count || 0), 0) || 0;

        let followUpsSent = 0;
        leads?.forEach(l => {
            l.follow_ups?.forEach((f, i) => {
                if (i > 0 && f.status === 'sent') followUpsSent++;
            });
        });

        const transformedLeads = leads?.map(l => ({
            id: l.id,
            recipientEmail: l.recipient_email,
            recipientName: l.recipient_name,
            companyName: l.company_name,
            subjectLine: l.subject_line,
            sentAt: l.sent_at,
            openCount: l.open_count,
            lastOpenedAt: l.last_opened_at
        })) || [];

        res.json({
            totalSent,
            totalOpened,
            totalOpens,
            openRate,
            followUpsSent,
            leads: transformedLeads
        });
    } catch (error) {
        console.error('[ANALYTICS] Error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Status endpoint (backwards compatible)
app.get('/status', async (req, res) => {
    try {
        const { data: leads } = await supabase
            .from('leads')
            .select('id, recipient_email, open_count, last_opened_at')
            .gt('open_count', 0);

        const statusObj = {};
        leads?.forEach(lead => {
            if (lead.open_count > 0) {
                statusObj[lead.id] = lead.last_opened_at;
            }
        });

        res.json(statusObj);
    } catch (error) {
        console.error('[STATUS] Error:', error);
        res.json({});
    }
});

// Clear all data (for testing)
app.post('/clear', async (req, res) => {
    try {
        await supabase.from('follow_ups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('leads').delete().neq('id', 'dummy');
        await supabase.from('campaigns').delete().neq('id', 'dummy');

        console.log('[CLEAR] All data cleared');
        res.json({ message: 'Cleared' });
    } catch (error) {
        console.error('[CLEAR] Error:', error);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});

// Get single lead
app.get('/lead/:id', async (req, res) => {
    try {
        const { data: lead } = await supabase
            .from('leads')
            .select('*, follow_ups(*)')
            .eq('id', req.params.id)
            .single();

        if (lead) {
            const transformed = {
                id: lead.id,
                recipientEmail: lead.recipient_email,
                recipientName: lead.recipient_name,
                companyName: lead.company_name,
                subjectLine: lead.subject_line,
                sentAt: lead.sent_at,
                openCount: lead.open_count,
                lastOpenedAt: lead.last_opened_at,
                senderName: lead.sender_name,
                senderCompany: lead.sender_company,
                followUpSequence: lead.follow_ups?.map(f => ({
                    day: f.day,
                    status: f.status,
                    sentAt: f.sent_at
                })) || []
            };
            res.json(transformed);
        } else {
            res.status(404).json({ error: 'Lead not found' });
        }
    } catch (error) {
        console.error('[LEAD] Error:', error);
        res.status(500).json({ error: 'Failed to fetch lead' });
    }
});

console.log('🔄 Server starting up...');
console.log(`🔑 Loaded Configuration:`);
console.log(`   - PORT: ${PORT}`);
console.log(`   - Client ID: ${process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 15) + '...' : 'MISSING'}`);
console.log(`   - Client Secret: ${process.env.GOOGLE_CLIENT_SECRET ? 'Present (Starts with ' + process.env.GOOGLE_CLIENT_SECRET.substring(0, 5) + '...)' : 'MISSING'}`);


app.listen(PORT, () => {
    console.log(`📡 Tracking Server running on http://localhost:${PORT}`);
    console.log('   Campaign Endpoints:');
    console.log('   POST /campaigns         - Create campaign');
    console.log('   GET  /campaigns         - List campaigns');
    console.log('   GET  /campaigns/:id/pending - Get pending follow-ups');
    console.log('   POST /follow-up-sent    - Mark follow-up sent');
    console.log('   💾 Using Supabase for persistent storage');

    // Start the automatic follow-up scheduler
    if (process.env.GOOGLE_CLIENT_SECRET && process.env.GEMINI_API_KEY) {
        startScheduler();
    } else {
        console.log('   ⚠️  Auto-scheduler disabled: Missing GOOGLE_CLIENT_SECRET or GEMINI_API_KEY');
    }
});

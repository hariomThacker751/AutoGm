import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 3001;

// Storage
const trackingData = new Map();  // leadId -> tracking info
const campaigns = new Map();      // campaignId -> campaign config

app.use(cors()); // Allow all origins for simplicity in this demo, or configure for production
app.use(bodyParser.json());

// ============== CAMPAIGN ENDPOINTS ==============

// Create a new campaign
app.post('/campaigns', (req, res) => {
    const { name, followUpIntervals, senderName, senderCompany } = req.body;
    // followUpIntervals: [2, 5, 10] means follow-up on day 2, 5, 10

    if (!name) {
        return res.status(400).json({ error: 'Campaign name is required' });
    }

    const id = `campaign_${Date.now()}`;
    const campaign = {
        id,
        name,
        followUpIntervals: followUpIntervals || [2, 5, 10], // Default: Day 2, 5, 10
        senderName: senderName || 'Unknown',
        senderCompany: senderCompany || 'Unknown',
        createdAt: new Date().toISOString(),
        totalLeads: 0,
        sentCount: 0,
        openedCount: 0
    };

    campaigns.set(id, campaign);
    console.log(`[CAMPAIGN] Created: ${name} (${id})`);
    res.json(campaign);
});

// Get all campaigns
app.get('/campaigns', (req, res) => {
    const allCampaigns = Array.from(campaigns.values()).map(c => {
        // Calculate stats
        const leads = Array.from(trackingData.values()).filter(l => l.campaignId === c.id);
        return {
            ...c,
            totalLeads: leads.length,
            sentCount: leads.filter(l => l.followUpSequence?.some(f => f.status === 'sent')).length,
            openedCount: leads.filter(l => l.openCount > 0).length
        };
    });
    res.json(allCampaigns);
});

// Get pending follow-ups for a campaign
app.get('/campaigns/:id/pending', (req, res) => {
    const { id } = req.params;
    const campaign = campaigns.get(id);

    if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    const now = new Date();
    const pendingFollowUps = [];

    trackingData.forEach((lead, leadId) => {
        if (lead.campaignId !== id || lead.stopped) return;

        lead.followUpSequence?.forEach((followUp, index) => {
            if (followUp.status !== 'pending') return;

            // Check if it's time for this follow-up
            const sentDate = new Date(lead.sentAt);
            const dueDate = new Date(sentDate);
            dueDate.setDate(dueDate.getDate() + followUp.day);

            if (now >= dueDate) {
                pendingFollowUps.push({
                    leadId,
                    lead,
                    followUpIndex: index,
                    followUpNumber: index, // Fix: Use index (1 = 1st follow-up) so Gemini uses correct tone
                    dueDate: dueDate.toISOString()
                });
            }
        });
    });

    res.json({
        campaign,
        pendingFollowUps,
        count: pendingFollowUps.length
    });
});

// Get analytics for a specific campaign
app.get('/campaigns/:id/analytics', (req, res) => {
    const { id } = req.params;
    const campaign = campaigns.get(id);

    if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
    }

    // Filter leads for this campaign
    const campaignLeads = Array.from(trackingData.values()).filter(l => l.campaignId === id);

    const totalSent = campaignLeads.filter(l => l.sentAt !== null).length;
    const totalOpened = campaignLeads.filter(l => l.openCount > 0).length;
    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const totalOpens = campaignLeads.reduce((sum, l) => sum + l.openCount, 0);

    // Count follow-ups
    let followUpsSent = 0;
    campaignLeads.forEach(l => {
        l.followUpSequence?.forEach((f, i) => {
            if (i > 0 && f.status === 'sent') followUpsSent++;
        });
    });

    res.json({
        campaign,
        totalSent,
        totalOpened,
        totalOpens,
        openRate,
        followUpsSent,
        leads: campaignLeads.sort((a, b) => {
            if (!a.sentAt) return 1;
            if (!b.sentAt) return -1;
            return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
        })
    });
});

// DEBUG TOOL: Fast forward time for a campaign (make next follow-ups due now)
app.post('/campaigns/:id/fast-forward', (req, res) => {
    const { id } = req.params;
    const campaignLeads = Array.from(trackingData.values()).filter(l => l.campaignId === id);
    let updatedCount = 0;

    campaignLeads.forEach(lead => {
        if (lead.stopped) return;

        // Check if there are any pending follow-ups
        const hasPending = lead.followUpSequence?.some(f => f.status === 'pending');

        if (hasPending && lead.sentAt) {
            // Shift the original SEND time back by 30 days
            // The 'pending' logic calculates due dates based on (lead.sentAt + interval)
            // So moving lead.sentAt back ensures (sentAt + interval) < Now
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 30);

            lead.sentAt = oldDate.toISOString();
            trackingData.set(lead.id, lead);
            updatedCount++;
        }
    });

    console.log(`[DEBUG] Expedited ${updatedCount} leads in campaign ${id} (Shifted start date -30 days)`);
    res.json({ success: true, updatedCount });
});

// ============== LEAD/TRACKING ENDPOINTS ==============

// Log Send - Register a sent email with campaign and follow-up sequence
// Log Send - Register a sent email with campaign and follow-up sequence
app.post('/log-send', (req, res) => {
    const { id, recipientEmail, recipientName, companyName, subjectLine, campaignId, senderName, senderCompany } = req.body;

    if (!id || !recipientEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get campaign to build follow-up sequence
    const campaign = campaignId ? campaigns.get(campaignId) : null;
    const followUpSequence = campaign
        ? [
            { day: 0, status: 'sent', sentAt: new Date().toISOString() },
            ...campaign.followUpIntervals.map(day => ({ day, status: 'pending', sentAt: null }))
        ]
        : [{ day: 0, status: 'sent', sentAt: new Date().toISOString() }];

    // Use provided sender info or fallback to campaign defaults if available
    const finalSenderName = senderName || (campaign ? campaign.senderName : 'Unknown');
    const finalSenderCompany = senderCompany || (campaign ? campaign.senderCompany : 'Unknown');

    trackingData.set(id, {
        id,
        recipientEmail,
        recipientName: recipientName || 'Unknown',
        companyName: companyName || 'Unknown',
        subjectLine: subjectLine || 'No Subject',
        campaignId: campaignId || null,
        senderName: finalSenderName,
        senderCompany: finalSenderCompany,
        sentAt: new Date().toISOString(),
        firstOpenedAt: null,
        lastOpenedAt: null,
        openCount: 0,
        history: [],
        followUpSequence,
        stopped: false
    });

    console.log(`[LOGGED] Email sent to: ${recipientEmail} (Campaign: ${campaignId || 'none'})`);
    res.json({ success: true, id });
});

// Mark follow-up as sent
app.post('/follow-up-sent', (req, res) => {
    const { leadId, followUpIndex, subjectLine } = req.body;

    const lead = trackingData.get(leadId);
    if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.followUpSequence && lead.followUpSequence[followUpIndex]) {
        lead.followUpSequence[followUpIndex].status = 'sent';
        lead.followUpSequence[followUpIndex].sentAt = new Date().toISOString();
        lead.followUpSequence[followUpIndex].subjectLine = subjectLine;
        trackingData.set(leadId, lead);
        console.log(`[FOLLOW-UP] Sent #${followUpIndex + 1} to: ${lead.recipientEmail}`);
    }

    res.json({ success: true });
});

// Tracking Pixel Endpoint
app.get('/track/:id', (req, res) => {
    const { id } = req.params;
    const now = new Date().toISOString();

    if (id) {
        const existing = trackingData.get(id);

        if (existing) {
            existing.openCount += 1;
            existing.lastOpenedAt = now;
            if (!existing.firstOpenedAt) {
                existing.firstOpenedAt = now;
            }
            existing.history.push(now);
            // Stop follow-up sequence when opened
            existing.stopped = true;
            trackingData.set(id, existing);
            console.log(`[TRACK] Email Opened: ${existing.recipientEmail} - Sequence STOPPED`);
        } else {
            trackingData.set(id, {
                id,
                recipientEmail: 'Unknown',
                recipientName: 'Unknown',
                companyName: 'Unknown',
                subjectLine: 'Unknown',
                campaignId: null,
                sentAt: null,
                firstOpenedAt: now,
                lastOpenedAt: now,
                openCount: 1,
                history: [now],
                followUpSequence: [],
                stopped: true
            });
        }
    }

    const img = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': img.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(img);
});

// Analytics Endpoint
app.get('/analytics', (req, res) => {
    const leads = Array.from(trackingData.values());

    const totalSent = leads.filter(l => l.sentAt !== null).length;
    const totalOpened = leads.filter(l => l.openCount > 0).length;
    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const totalOpens = leads.reduce((sum, l) => sum + l.openCount, 0);

    // Count follow-ups
    let followUpsSent = 0;
    leads.forEach(l => {
        l.followUpSequence?.forEach((f, i) => {
            if (i > 0 && f.status === 'sent') followUpsSent++;
        });
    });

    res.json({
        totalSent,
        totalOpened,
        totalOpens,
        openRate,
        followUpsSent,
        leads: leads.sort((a, b) => {
            if (!a.sentAt) return 1;
            if (!b.sentAt) return -1;
            return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
        })
    });
});

// Status Endpoint (backwards compatible)
app.get('/status', (req, res) => {
    const statusObj = {};
    trackingData.forEach((value, key) => {
        if (value.openCount > 0) {
            statusObj[key] = value.firstOpenedAt;
        }
    });
    res.json(statusObj);
});

// Clear all data
app.post('/clear', (req, res) => {
    trackingData.clear();
    campaigns.clear();
    console.log('[CLEAR] All data cleared');
    res.json({ message: 'Cleared' });
});

// Get single lead
app.get('/lead/:id', (req, res) => {
    const lead = trackingData.get(req.params.id);
    if (lead) {
        res.json(lead);
    } else {
        res.status(404).json({ error: 'Lead not found' });
    }
});

app.listen(PORT, () => {
    console.log(`📡 Tracking Server running on http://localhost:${PORT}`);
    console.log('   Campaign Endpoints:');
    console.log('   POST /campaigns         - Create campaign');
    console.log('   GET  /campaigns         - List campaigns');
    console.log('   GET  /campaigns/:id/pending - Get pending follow-ups');
    console.log('   POST /follow-up-sent    - Mark follow-up sent');
});

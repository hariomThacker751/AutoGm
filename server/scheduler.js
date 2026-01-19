import cron from 'node-cron';
import { supabase } from './db.js';

const API_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';

// Refresh an access token using refresh token
export const refreshAccessToken = async (userId, refreshToken) => {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[SCHEDULER] Token refresh failed:', error);
            return null;
        }

        const data = await response.json();
        const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

        // Update tokens in database
        await supabase
            .from('users')
            .update({
                access_token: data.access_token,
                token_expires_at: expiresAt.toISOString()
            })
            .eq('id', userId);

        console.log(`[SCHEDULER] Refreshed token for user: ${userId}`);
        return data.access_token;
    } catch (error) {
        console.error('[SCHEDULER] Error refreshing token:', error);
        return null;
    }
};

// Generate follow-up email using Gemini
const generateFollowUpEmail = async (lead, followUpNumber, originalSubject) => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const followUpStyles = {
        1: "Gentle bump. 1-2 sentences. Example: 'Hey, just wanted to bump this. Still interested? No worries if not.'",
        2: "Share something helpful. Example: 'Quick thought - just helped a similar company with X. Made me think of you.'",
        3: "Break-up email. Last shot. Example: 'Looks like this isn't a priority. Totally get it. Here if things change!'"
    };

    const style = followUpStyles[followUpNumber] || followUpStyles[1];

    const prompt = `
Write a SUPER SHORT follow-up email (follow-up #${followUpNumber}).

**WHO:**
- From: ${lead.sender_name} (${lead.sender_company})
- To: ${lead.recipient_name} at ${lead.company_name}
- Original subject: "${originalSubject || 'previous email'}"

**STYLE FOR #${followUpNumber}:** ${style}

**RULES:**
- MAX 2-3 sentences. No fluff.
- Sound like you're texting a friend.
- Use <br><br> for breaks.
- Signature: ${lead.sender_name}<br>${lead.sender_company}

**SUBJECT:** Use "Re: ${originalSubject}" OR something super short like "bump" or "quick follow up"

**OUTPUT (JSON only, no markdown):**
{"subjectLine": "short subject", "emailBody": "ultra-short follow-up with <br><br> breaks"}
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No JSON found in response');
    } catch (error) {
        console.error('[SCHEDULER] Error generating email:', error);
        // Return a fallback email
        return {
            subjectLine: `Re: ${originalSubject}`,
            emailBody: `Hey ${lead.recipient_name},<br><br>Just bumping this. Still interested?<br><br>${lead.sender_name}<br>${lead.sender_company}`
        };
    }
};

// Create email body for Gmail API
const createEmailBody = (to, subject, htmlBody) => {
    const email = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        htmlBody
    ].join('\r\n');

    return Buffer.from(email).toString('base64url');
};

// Send email via Gmail API
const sendGmail = async (accessToken, rawMessage) => {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: rawMessage })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error?.message || 'Failed to send email');
    }

    return response.json();
};

// Process due follow-ups
const processDueFollowUps = async () => {
    console.log('[SCHEDULER] Checking for due follow-ups...');

    try {
        // Get all leads with pending follow-ups
        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('*, follow_ups(*), campaigns(user_id, users(*))')
            .eq('stopped', false)
            .not('sent_at', 'is', null);

        if (leadsError) {
            console.error('[SCHEDULER] Error fetching leads:', leadsError);
            return;
        }

        const now = new Date();
        let processed = 0;
        let sent = 0;
        let failed = 0;

        for (const lead of leads || []) {
            const followUps = lead.follow_ups || [];
            const user = lead.campaigns?.users;

            if (!user?.refresh_token) {
                continue; // Skip if no refresh token
            }

            for (const followUp of followUps) {
                if (followUp.status !== 'pending') continue;

                // Calculate due date
                const sentDate = new Date(lead.sent_at);
                const dueDate = new Date(sentDate);
                dueDate.setDate(dueDate.getDate() + followUp.day);

                if (now < dueDate) continue; // Not due yet

                processed++;
                console.log(`[SCHEDULER] Processing follow-up for ${lead.recipient_email} (day ${followUp.day})`);

                try {
                    // Check if token needs refresh
                    let accessToken = user.access_token;
                    const tokenExpires = new Date(user.token_expires_at);

                    if (!accessToken || now >= tokenExpires) {
                        console.log(`[SCHEDULER] Refreshing token for user ${user.id}`);
                        accessToken = await refreshAccessToken(user.id, user.refresh_token);

                        if (!accessToken) {
                            console.error(`[SCHEDULER] Failed to refresh token for user ${user.id}`);
                            failed++;
                            continue;
                        }
                    }

                    // Find follow-up number (index in sequence)
                    const followUpNumber = followUps.filter(f => f.day <= followUp.day).length;

                    // Generate email
                    const generated = await generateFollowUpEmail(lead, followUpNumber, lead.subject_line);

                    // Add tracking pixel
                    const pixelHtml = `<img src="${API_URL}/track/${lead.id}" width="1" height="1" style="display:none;" />`;
                    const finalBody = generated.emailBody + pixelHtml;

                    // Send email
                    const rawBody = createEmailBody(lead.recipient_email, generated.subjectLine, finalBody);
                    await sendGmail(accessToken, rawBody);

                    // Mark as sent
                    await supabase
                        .from('follow_ups')
                        .update({
                            status: 'sent',
                            sent_at: new Date().toISOString()
                        })
                        .eq('id', followUp.id);

                    console.log(`[SCHEDULER] ✓ Sent follow-up #${followUpNumber} to ${lead.recipient_email}`);
                    sent++;

                    // Add delay between emails to avoid rate limiting
                    await new Promise(r => setTimeout(r, 2000));

                } catch (error) {
                    console.error(`[SCHEDULER] ✗ Failed to send to ${lead.recipient_email}:`, error.message);
                    failed++;
                }

                // Only process one follow-up per lead at a time
                break;
            }
        }

        if (processed > 0) {
            console.log(`[SCHEDULER] Processed ${processed} follow-ups: ${sent} sent, ${failed} failed`);
        } else {
            console.log('[SCHEDULER] No follow-ups due at this time');
        }

    } catch (error) {
        console.error('[SCHEDULER] Error processing follow-ups:', error);
    }
};

// Start the scheduler
export const startScheduler = () => {
    console.log('[SCHEDULER] Starting automatic follow-up scheduler...');

    // Run every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        console.log('[SCHEDULER] Running scheduled check...');
        processDueFollowUps();
    });

    // Also run immediately on startup
    setTimeout(processDueFollowUps, 5000);

    console.log('[SCHEDULER] ✓ Scheduler started - checking every 5 minutes');
};

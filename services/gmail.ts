
// Helper to encode string to Base64Url (required by Gmail API)
export const createEmailBody = (to: string, subject: string, htmlBody: string): string => {
    const cleanTo = to.trim();
    if (!cleanTo) {
        throw new Error("Recipient email is missing.");
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanTo)) {
        throw new Error(`Invalid email format: "${cleanTo}" (check for spaces or typos)`);
    }

    const emailLines = [
        `To: ${cleanTo}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject.trim()}`,
        '',
        htmlBody
    ];

    // MIME standard requires CRLF
    const email = emailLines.join('\r\n').trim();

    // Base64Url encoding
    return btoa(unescape(encodeURIComponent(email)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

export const sendGmail = async (accessToken: string, rawMessage: string) => {
    if (!accessToken) {
        throw new Error('No access token provided. Please sign in with Google.');
    }

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            raw: rawMessage
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const errorMessage = errorData?.error?.message || 'Failed to send email';

        // Check for common errors with actionable messages
        if (response.status === 401) {
            throw new Error('Session expired. Please sign out and sign back in.');
        }
        if (response.status === 403) {
            throw new Error('Gmail permission denied. Please sign out, then sign back in and ALLOW all permissions (including "Send email on your behalf").');
        }
        if (response.status === 400 && errorMessage.includes('invalid')) {
            throw new Error('Invalid email format. Check recipient email address.');
        }

        throw new Error(`Gmail API Error: ${errorMessage}`);
    }

    return response.json();
};

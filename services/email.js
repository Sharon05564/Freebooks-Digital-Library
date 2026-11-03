require('dotenv').config();

// Render's free web services block outbound SMTP ports, so mail goes out over
// Resend's HTTPS API instead.
const sendEmail = async ({ name, email, subject, message }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_TO_EMAIL;
    if (!apiKey || !to) {
        console.error('RESEND_API_KEY and CONTACT_TO_EMAIL must be set to send contact messages.');
        return false;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: process.env.CONTACT_FROM_EMAIL || 'FreeBooks <onboarding@resend.dev>',
                to: [to],
                reply_to: email,
                subject: subject || 'No Subject',
                text: `From: ${name} <${email}>\n\n${message}`,
            }),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            console.error('Resend rejected the message:', response.status, await response.text());
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = sendEmail;

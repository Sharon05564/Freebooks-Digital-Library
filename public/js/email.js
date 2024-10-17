
const nodemailer = require('nodemailer');
require('dotenv').config(); // Load environment variables

const sendEmail = async (formData) => {
    // Create a transporter object using SMTP transport
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 546,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // Set up email data
    const mailOptions = {
        from: formData.email, // Sender address
        to: 'sharonowusu05564@gmail.com', // Receiver
        subject: formData.subject || 'No Subject', // Subject line
        text: `From: ${formData.name} <${formData.email}>\n\n${formData.message}`, // Plain text body
    };

    // Send the email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error); // Log any error
        return false;
    }
};

module.exports = sendEmail;

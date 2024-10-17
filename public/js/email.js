// email.js
const nodemailer = require('nodemailer');
require('dotenv').config(); // Load environment variables

const sendEmail = async (formData) => {
    // Create a transporter object using SMTP transport
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 546,
        secure: false, // True for port 465, false for port 587
        auth: {
            user: process.env.EMAIL_USER, // Your email address
            pass: process.env.EMAIL_PASS, // App password or email password
        },
    });

    // Set up email data
    const mailOptions = {
        from: formData.email, // Sender address
        to: 'sharonowusu05564@gmail.com', // Receiver (your email)
        subject: formData.subject || 'No Subject', // Subject line
        text: `From: ${formData.name} <${formData.email}>\n\n${formData.message}`, // Plain text body
    };

    // Send the email
    try {
        const info = await transporter.sendMail(mailOptions); // Fix: Save the response
        console.log('Message sent: %s', info.messageId); // Display message ID
        return true;
    } catch (error) {
        console.error('Error sending email:', error); // Log any error
        return false;
    }
};

module.exports = sendEmail;

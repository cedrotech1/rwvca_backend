require('dotenv').config();
const axios = require('axios');

const PINDO_API_URL = 'https://api.pindo.io/v1/sms/';
const PINDO_API_KEY = process.env.PINDO_API_KEY; // Ensure this is set in your .env file

if (!PINDO_API_KEY) {
    console.error('Missing PINDO_API_KEY. Please check your .env file.');
    process.exit(1);
}

/**
 * Formats phone number to ensure it starts with +250.
 * @param {string} number - The recipient's phone number.
 * @returns {string} - Formatted phone number.
 */
const formatPhoneNumber = (number) => {
    if (!number.startsWith('+')) {
        if (number.startsWith('0')) {
            return `+250${number.slice(1)}`;
        } else {
            throw new Error('Invalid phone number format');
        }
    }
    return number;
};

/**
 * Sends an SMS using Pindo API
 * @param {string} to - Recipient phone number
 * @param {string} text - Message text
 * @returns {Promise<object>} - Response from Pindo API
 */
const sendSMS = async (to, text) => {
    if (!to || !text) {
        throw new Error('Recipient number and message text are required');
    }

    try {
        const formattedTo = formatPhoneNumber(to);
        console.log(`Sending SMS to: ${formattedTo}, Message: ${text}`);

        const response = await axios.post(
            PINDO_API_URL,
            { to: formattedTo, text, sender: "PindoTest" },
            { headers: { Authorization: `Bearer ${PINDO_API_KEY}` } }
        );
        return response.data;
    } catch (error) {
        console.error('Error sending SMS:', error.response?.data || error.message);
        throw new Error(error.response?.data || 'SMS sending failed');
    }
};

module.exports = sendSMS;

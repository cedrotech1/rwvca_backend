require("dotenv").config();
const axios = require("axios");

function normalizeRwandaPhone(phone) {
  if (!phone) return null;
  let value = String(phone).trim().replace(/\s+/g, "");
  if (!value) return null;

  if (value.startsWith("+")) {
    const digits = value.slice(1).replace(/\D/g, "");
    if (!digits) return null;
    if (digits.startsWith("250")) return `+${digits}`;
    if (/^0?7\d{8}$/.test(digits) || /^7\d{8}$/.test(digits)) {
      return `+250${digits.replace(/^0/, "")}`;
    }
    return `+${digits}`;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("250")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+250${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `+250${digits}`;
  return `+250${digits.replace(/^0+/, "")}`;
}

async function sendWhatsApp() {
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN;
  const apiUrl = process.env.WHATSAPP_API_URL || "https://wasenderapi.com/api/send-message";
  const phone = normalizeRwandaPhone(process.env.TEST_PHONE);

  if (!token) {
    console.error("Missing WHATSAPP_TOKEN in .env");
    process.exit(1);
  }
  if (!phone) {
    console.error("Missing or invalid TEST_PHONE in .env");
    process.exit(1);
  }

  try {
    const response = await axios.post(
      apiUrl,
      {
        to: phone,
        text: "Hello! This is a test message from RWVCA MIS.",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Message sent successfully!");
    console.log(response.data);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

sendWhatsApp();

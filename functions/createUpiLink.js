const crypto = require("crypto");

const MERCHANT_VPA = "9995323102@ybl";
const MERCHANT_NAME = "FATHIMATH SHAIBANA";

exports.handler = async function(event, context) {
  const { amount } = event.queryStringParameters || {};

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return { statusCode: 400, body: "Invalid amount" };
  }

  const am = Number(amount);

  // Generate UPI link (without 'sig')
  const upiLink = `upi://pay?pa=${encodeURIComponent(MERCHANT_VPA)}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${am}`;

  return {
    statusCode: 200,
    body: JSON.stringify({ upiLink, amount: am }),
    headers: { "Content-Type": "application/json" },
  };
};

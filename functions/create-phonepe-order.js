import fetch from "node-fetch";

// 🔑 PhonePe Production/Sandbox credentials
const CLIENT_ID = "SU2511091420349324774512";
const CLIENT_SECRET = "80767872-d46f-4b34-a720-769d0bf73698";
const CLIENT_VERSION = "1";

// Utility to get OAuth token
async function getAccessToken() {
  const resp = await fetch("https://api.phonepe.com/apis/identity-manager/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      client_version: CLIENT_VERSION,
      grant_type: "client_credentials"
    }),
  });

  const data = await resp.json();
  if (!data.access_token) throw new Error("Failed to get PhonePe access token");
  return data.access_token;
}

export async function handler(event) {
  try {
    const { amount, merchantOrderId } = JSON.parse(event.body);
    if (!amount || !merchantOrderId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing amount or merchantOrderId" }) };
    }

    // 1️⃣ Get access token
    const token = await getAccessToken();

    // 2️⃣ Create order
    const orderResp = await fetch("https://api.phonepe.com/apis/pg/checkout/v2/pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `O-Bearer ${token}`,
      },
      body: JSON.stringify({
        merchantOrderId,
        amount, // in paise
        paymentFlow: {
          type: "PG_CHECKOUT",
          message: "Order payment via Foyer Studio checkout",
          merchantUrls: {
            redirectUrl: "",
            callbackUrl: ""
          }
        }
      }),
    });

    const orderData = await orderResp.json();

    // 3️⃣ Return both redirectUrl and access token
    return {
      statusCode: 200,
      body: JSON.stringify({
        redirectUrl: orderData.redirectUrl,  // for iframe
        accessToken: token,                  // for polling order status
        orderId: orderData.orderId || merchantOrderId
      }),
    };

  } catch (err) {
    console.error("Error creating PhonePe order:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

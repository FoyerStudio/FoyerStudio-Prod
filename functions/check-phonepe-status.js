import fetch from "node-fetch";

// same constants as before
const CLIENT_ID = "SU2511091420349324774512";
const CLIENT_SECRET = "80767872-d46f-4b34-a720-769d0bf73698";
const CLIENT_VERSION = "1";

// Helper to get fresh access token (same as your other file)
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
    const { merchantOrderId } = JSON.parse(event.body);
    if (!merchantOrderId)
      return { statusCode: 400, body: JSON.stringify({ error: "Missing merchantOrderId" }) };

    // 1️⃣ Get fresh token
    const token = await getAccessToken();

    // 2️⃣ Check status from PhonePe
    const statusResp = await fetch(
      ` https://api.phonepe.com/apis/pg/checkout/v2/order/${merchantOrderId}/status?details=false`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `O-Bearer ${token}`,
        },
      }
    );

    const statusData = await statusResp.json();

    return {
      statusCode: 200,
      body: JSON.stringify(statusData),
    };
  } catch (err) {
    console.error("Error checking PhonePe order:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

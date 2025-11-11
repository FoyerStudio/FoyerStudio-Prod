async function startPhonePePayment(amount, merchantOrderId) {
  let amountPaid = ""; // Total amount
  let paymentMode = "";
  let transactionId
  const overlay = document.getElementById("overlay");
  const phonepeFrame = document.getElementById("phonepeFrame");

  let status = "";          // final payment status
  let pollInterval = null;  // interval reference

  // Helper to close overlay + cleanup
  const closeOverlay = () => {
    overlay.style.display = "none";
    phonepeFrame.src = "";
    if (pollInterval) clearInterval(pollInterval);
  };

  try {
    // console.log("🚀 Starting PhonePe payment", { amount, merchantOrderId });

    // 1️⃣ Create order via backend
    const resp = await fetch("https://foyerstudio.in/.netlify/functions/create-phonepe-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, merchantOrderId }),
    });
    const data = await resp.json();

    const iframeUrl = data.redirectUrl;
    const accessToken = data.accessToken;
    if (!iframeUrl || !accessToken) return "FAILED";

    overlay.style.display = "flex";

    // 2️⃣ Ensure PhonePe SDK is loaded
    if (!window.PhonePeCheckout) {
      // console.error("PhonePeCheckout SDK not loaded");
      closeOverlay();
      return "FAILED";
    }

    const pollInterval = 3000; // 3 seconds
      const maxAttempts = 60; // 10 * 3s = 30 seconds
      let attempts = 0;

      const pollStatus = setInterval(async () => {
        attempts++;
        try {
          const statusResp = await fetch(
            `https://api.phonepe.com/apis/pg/checkout/v2/order/${merchantOrderId}/status?details=false`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `O-Bearer ${accessToken}`,
              },
            }
          );

          const statusData = await statusResp.json();
          // console.log(`📦 Polling attempt ${attempts}:`, statusData);

          const state = statusData.state; // COMPLETED, FAILED, PENDING
          if (state === "COMPLETED") {
            clearInterval(pollStatus);
            overlay.style.display = "none";
            // console.log("Payment SUCCESS:", status);
          } else if (state === "FAILED") {
            clearInterval(pollStatus);
            overlay.style.display = "none";
            // console.log("Payment FAILED:", status);
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollStatus);
            status = "PENDING";
            overlay.style.display = "none";
            window.PhonePeCheckout.closePage(); // close iframe
            // console.log("Payment still pending after 30s:", status);
          }
        } catch (err) {
          // console.error("Polling error:", err);
        }
      }, pollInterval);

    // 3️⃣ Start PhonePe iframe
    window.PhonePeCheckout.transact({
      tokenUrl: iframeUrl,
      type: "IFRAME",
      callback: async (response) => {
        // console.log("📦 PhonePe checkout callback:", response);

        // If user cancelled
        if (response === "USER_CANCEL") {
          status = "CANCELLED";
          closeOverlay();
          // console.log("Payment cancelled by user");
          return;
        }

 // If transaction concluded, check actual payment status
        if (response === "CONCLUDED") {
          // console.log("Payment concluded by phonepe");
          try {
            const statusResp = await fetch(
          `https://api.phonepe.com/apis/pg/checkout/v2/order/order/${merchantOrderId}/status?details=false`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `O-Bearer ${accessToken}`, // token from backend
            },
          }
        );
            const statusData = await statusResp.json();
            // console.log("📦 Payment status fetched:", statusData);

            if (statusData.state === "COMPLETED") {
              status = "COMPLETED";
       amountPaid = statusData.amount; // Total amount
       paymentMode = "";
       transactionId = "";

      // Extract first payment detail if available
      if (statusData.paymentDetails && statusData.paymentDetails.length > 0) {
        paymentMode = statusData.paymentDetails[0].paymentMode;
        transactionId = statusData.paymentDetails[0].transactionId;
      }
              // console.log("Payment Completed");
            } else {
              status = "FAILED";
              // console.log("Payment failed");
            }

          } catch (err) {
            // console.error("Error fetching payment status:", err);
            status = "FAILED";
          } finally {
            closeOverlay();
          }
        }
      },
    });

    // 4️⃣ Allow manual overlay close
    const onCloseClick = () => {
      window.PhonePeCheckout.closePage(); // close iframe
      status = "FAILED";
      closeOverlay();
      // console.log("Payment manually cancelled by user");
    };
    document.getElementById("closeIframeBtn").addEventListener("click", onCloseClick);

    // 5️⃣ Reset everything if user re-proceeds (just re-call this function)

    // 6️⃣ Return status after transaction completes
    return new Promise((resolve) => {
  const checkStatus = setInterval(() => {
    if (status) {
      clearInterval(checkStatus);
      document.getElementById("closeIframeBtn").removeEventListener("click", onCloseClick);
      resolve({
  status,
  amountPaid: amountPaid / 100,  // divide by 100
  paymentMode,
  transactionId
});

    }
  }, 500);
});

  } catch (err) {
    // console.error("Unexpected error:", err);
    closeOverlay();
    return "FAILED";
  }
}



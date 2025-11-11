async function startPhonePePayment(amount, merchantOrderId) {
  let amountPaid = ""; // Total amount
  let paymentMode = "";
  let transactionId;
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
    // 1️⃣ Create order via backend
    const resp = await fetch("https://foyerstudio.in/.netlify/functions/create-phonepe-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, merchantOrderId }),
    });
    const data = await resp.json();

    const iframeUrl = data.redirectUrl;
    if (!iframeUrl) return "FAILED";

    overlay.style.display = "flex";

    // 2️⃣ Ensure PhonePe SDK is loaded
    if (!window.PhonePeCheckout) {
      closeOverlay();
      return "FAILED";
    }

    const pollIntervalTime = 3000; // 3 seconds
    const maxAttempts = 60; // 3s * 60 = 180s = 3 minutes
    let attempts = 0;

    const pollStatus = setInterval(async () => {
      attempts++;
      try {
        // ✅ Call Netlify function instead of direct PhonePe API
        const statusResp = await fetch("https://foyerstudio.in/.netlify/functions/check-phonepe-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchantOrderId}),
        });

        const statusData = await statusResp.json();
        const state = statusData.state; // COMPLETED, FAILED, PENDING

        if (state === "COMPLETED") {
          clearInterval(pollStatus);
          overlay.style.display = "none";
        } else if (state === "FAILED") {
          clearInterval(pollStatus);
          overlay.style.display = "none";
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollStatus);
          status = "PENDING";
          overlay.style.display = "none";
          window.PhonePeCheckout.closePage();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, pollIntervalTime);

    // 3️⃣ Start PhonePe iframe
    window.PhonePeCheckout.transact({
      tokenUrl: iframeUrl,
      type: "IFRAME",
      callback: async (response) => {
        // If user cancelled
        if (response === "USER_CANCEL") {
          status = "CANCELLED";
          closeOverlay();
          return;
        }

        // If transaction concluded, verify payment status via Netlify
        if (response === "CONCLUDED") {
          try {
            const statusResp = await fetch("https://foyerstudio.in/.netlify/functions/check-phonepe-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ merchantOrderId}),
            });

            const statusData = await statusResp.json();

            if (statusData.state === "COMPLETED") {
              status = "COMPLETED";
              amountPaid = statusData.amount;
              paymentMode = "";
              transactionId = "";

              if (statusData.paymentDetails && statusData.paymentDetails.length > 0) {
                paymentMode = statusData.paymentDetails[0].paymentMode;
                transactionId = statusData.paymentDetails[0].transactionId;
              }
            } else {
              status = "FAILED";
            }
          } catch (err) {
            console.error("Error verifying payment:", err);
            status = "FAILED";
          } finally {
            closeOverlay();
          }
        }
      },
    });

    // 4️⃣ Allow manual overlay close
    const onCloseClick = () => {
      window.PhonePeCheckout.closePage();
      status = "FAILED";
      closeOverlay();
    };
    document.getElementById("closeIframeBtn").addEventListener("click", onCloseClick);

    // 6️⃣ Return status after transaction completes
    return new Promise((resolve) => {
      const checkStatus = setInterval(() => {
        if (status) {
          clearInterval(checkStatus);
          document
            .getElementById("closeIframeBtn")
            .removeEventListener("click", onCloseClick);
          resolve({
            status,
            amountPaid: amountPaid / 100,
            paymentMode,
            transactionId,
          });
        }
      }, 500);
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    closeOverlay();
    return "FAILED";
  }
}

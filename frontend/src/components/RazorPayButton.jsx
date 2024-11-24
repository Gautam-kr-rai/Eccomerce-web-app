import { useEffect, useState } from "react";
import { useCartStore } from "../stores/useCartStore";
import axios from "../lib/axios";

const RazorpayButton = () => {
  const { cart, coupon } = useCartStore();
  const [loading, setLoading] = useState(false); // Loading state for button

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (document.querySelector("#razorpay-script")) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleRazorpayPayment = async () => {
    const isScriptLoaded = await loadRazorpayScript();

    if (!isScriptLoaded) {
      alert("Failed to load Razorpay SDK. Please check your internet connection.");
      return;
    }

    setLoading(true); // Show loading state

    try {
      // Create order on the backend
      const res = await axios.post("/payments/create-checkout-session", {
        products: cart,
        couponCode: coupon ? coupon.code : null,
      });

      const { amount, currency, orderID, key, error } = res.data;

      if (error) {
        alert(error);
        setLoading(false);
        return;
      }

      // Razorpay configuration
      const options = {
        key, // Razorpay Key ID from backend
        amount,
        currency,
        name: "Your Company Name",
        description: "Order Payment",
        order_id: orderID, // Order ID from backend
        handler: async (response) => {
          try {
            const verifyRes = await axios.post("/payments/checkout-success", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data.success) {
              alert("Payment successful!");
            } else {
              alert("Payment verification failed!");
            }
          } catch (err) {
            console.error("Payment verification error:", err);
            alert("An error occurred during payment verification.");
          } finally {
            setLoading(false); // Reset loading state
          }
        },
        theme: { color: "#5f63b8" },
        prefill: {
          name: "Customer Name", // Prefill with customer data if available
          email: "customer@example.com",
          contact: "9999999999",
        },
        notes: {
          address: "Customer Address",
        },
      };

      // Open Razorpay modal
      const rzp1 = new window.Razorpay(options);
      rzp1.on("payment.failed", (error) => {
        console.error("Payment failed:", error);
        alert("Payment failed. Please try again.");
        setLoading(false); // Reset loading state
      });
      rzp1.open();
    } catch (error) {
      console.error("Error creating Razorpay order:", error);
      alert("An error occurred while initiating the payment.");
      setLoading(false); // Reset loading state
    }
  };

  return (
    <button
      onClick={handleRazorpayPayment}
      className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
      disabled={loading} // Disable button when loading
    >
      {loading ? "Processing..." : "Pay with Razorpay"}
    </button>
  );
};

export default RazorpayButton;

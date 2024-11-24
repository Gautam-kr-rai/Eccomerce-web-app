
import Coupon from "../models/coupon.model.js";
import Order from "../models/order.model.js";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import crypto from "crypto";
import Payment from "../models/payment.model.js"; // Ensure correct import

dotenv.config();

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_API_SECRET,
});

// Create Razorpay payment order
export const createCheckoutSession = async (req, res) => {
  try {
    const { products, couponCode } = req.body;

    // Validate the products array
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Invalid or empty products array" });
    }

    let totalAmount = 0;
    const items = products.map((product) => {
      const amount = parseFloat(product.price);
      if (isNaN(amount)) {
        return res.status(400).json({ error: "Invalid product price" });
      }
      totalAmount += amount * product.quantity;

      return {
        name: product.name,
        description: product.description || "Product Description",
        quantity: product.quantity || 1,
        currency: "INR", // Razorpay uses INR
        amount: amount * 100, // Amount in paise
      };
    });

    let coupon = null;
    if (couponCode) {
      // Ensure that the coupon is valid and applicable
      coupon = await Coupon.findOne({
        code: couponCode,
        isActive: true,
      });

      if (!coupon) {
        return res.status(400).json({ error: "Invalid or expired coupon" });
      }

      const discount = (totalAmount * coupon.discountPercentage) / 100;
      totalAmount -= discount;
    }

    // Razorpay order creation options
    const options = {
      amount: totalAmount * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `order_rcptid_${new Date().getTime()}`,
      notes: {
        couponCode: couponCode || "No coupon applied",
      },
    };

    // Create the Razorpay order
    razorpayInstance.orders.create(options, function (err, order) {
      if (err) {
        console.error("Error creating Razorpay payment:", err.error.description);
        return res.status(500).json({ error: err.error.description || "Payment creation failed" });
      }

      res.status(200).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_API_KEY,
      });
    });
  } catch (error) {
    console.error("Error processing Razorpay checkout:", error);
    res.status(500).json({ message: "Error processing Razorpay checkout", error: error.message });
  }
};

// Razorpay payment success handler
export const checkoutSuccess = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    // Validate the payment signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_API_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // Save payment details to the database
      const payment = new Payment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });

      await payment.save();

      // Optionally, you could update the order status to 'paid'
      // const order = await Order.findOneAndUpdate(
      //   { razorpay_order_id },
      //   { status: 'paid' },
      //   { new: true }
      // );

      res.json({
        message: "Payment successfully verified",
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
    } else {
      return res.status(400).json({ message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Error processing successful Razorpay checkout:", error);
    res.status(500).json({ message: "Error processing successful checkout", error: error.message });
  }
};

// Razorpay payment cancel handler
export const cancelPayment = async (req, res) => {
  res.json({ message: "Payment canceled" });
};

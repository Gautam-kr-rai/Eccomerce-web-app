
import express from "express"
import { checkoutSuccess, createCheckoutSession} from "../controllers/payment.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();



// Create Payment
router.post('/create-checkout-session',protectRoute,createCheckoutSession);
//
router.post("/checkout-success", protectRoute, checkoutSuccess);

export default router;
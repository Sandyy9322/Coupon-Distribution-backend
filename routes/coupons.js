const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../db");
const { ObjectId } = require("mongodb");

const COOLDOWN_PERIOD = 60 * 60 * 1000; 

// Function to get the correct client IP address
const getClientIp = (req) => {
  let ip = req.headers["x-forwarded-for"]?.split(",")[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress;
  return ip === "::1" ? "127.0.0.1" : ip; 
};

router.get("/", async (req, res) => {
  try {
    const { db } = await connectToDatabase();

    const coupons = await db
      .collection("coupons")
      .find({ active: true })
      .project({ code: 1, discount: 1, claimCount: 1, _id: 0 })
      .toArray();

    return res.json({ coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch coupons" });
  }
});

// Route: Claim a coupon
router.post("/claim", async (req, res) => {
  try {
    // Get or create a unique client ID from cookies
    const clientId = req.cookies.clientId;
    const newClientId = clientId || new ObjectId().toString();

    if (!clientId) {
      res.cookie("clientId", newClientId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30 * 1000, // 30 days
        path: "/",
      });
    }

    //Get client IP address
    const clientIp = getClientIp(req);
    console.log("User IP:", clientIp);

    const { db } = await connectToDatabase();

    // Check if the user has already claimed a coupon recently
    const userClaim = await db.collection("claims").findOne({
      $or: [{ clientId: newClientId }, { ipAddress: clientIp }],
    });

    const now = new Date();

    if (userClaim) {
      const lastClaimTime = new Date(userClaim.claimedAt);
      const timeSinceClaim = now.getTime() - lastClaimTime.getTime();

      if (timeSinceClaim < COOLDOWN_PERIOD) {
        const timeRemaining = COOLDOWN_PERIOD - timeSinceClaim;
        return res.json({
          success: false,
          message: "You have already claimed a coupon recently.",
          timeRemaining,
        });
      }
    }

    // Get the next available coupon using round-robin
    const couponsCollection = db.collection("coupons");
    const couponsCursor = await couponsCollection.find({ active: true }).sort({ claimCount: 1 }).limit(1);
    const coupons = await couponsCursor.toArray();

    if (coupons.length === 0) {
      return res.json({
        success: false,
        message: "No coupons available at this time. Please try again later.",
      });
    }

    const coupon = coupons[0];

    // Update or insert claim record
    await db.collection("claims").updateOne(
      {
        $or: [{ clientId: newClientId }, { ipAddress: clientIp }],
      },
      {
        $set: {
          clientId: newClientId,
          ipAddress: clientIp,
          couponId: coupon._id,
          couponCode: coupon.code,
          claimedAt: now,
        },
      },
      { upsert: true }
    );

    // Update coupon claim count
    await couponsCollection.updateOne({ _id: coupon._id }, { $inc: { claimCount: 1 } });

    return res.json({
      success: true,
      coupon: coupon.code,
    });
  } catch (error) {
    console.error("Error claiming coupon:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your request.",
    });
  }
});

module.exports = router;


const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const { connectToDatabase } = require("./db")
const { ObjectId } = require("mongodb")

// Import routes
const couponRoutes = require("./routes/coupons")

// Create Express app
const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173", // Vite default port
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

// IP tracking middleware
app.use((req, res, next) => {
  const forwardedFor = req.headers["x-forwarded-for"]
  req.clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : req.ip || "127.0.0.1"
  next()
})

// Routes
app.use("/api/coupons", couponRoutes)

app.get("/", (req, res) => {
    res.send("Coupon Distribution System Server is running....");
    
  });

// Seed route
app.get("/api/seed", async (req, res) => {
  try {
    const { db } = await connectToDatabase()

    // Check if coupons already exist
    const couponCount = await db.collection("coupons").countDocuments()

    if (couponCount > 0) {
      return res.json({
        success: true,
        message: "Database already seeded",
        couponCount,
      })
    }

    // Sample coupon codes
    const coupons = [
      { code: "SAVE10", discount: "10%", active: true, claimCount: 0 },
      { code: "SAVE20", discount: "20%", active: true, claimCount: 0 },
      { code: "FREESHIP", discount: "Free Shipping", active: true, claimCount: 0 },
      { code: "EXTRA15", discount: "15%", active: true, claimCount: 0 },
      { code: "WELCOME25", discount: "25%", active: true, claimCount: 0 },
    ]

    await db.collection("coupons").insertMany(coupons)

    return res.json({
      success: true,
      message: "Database seeded successfully",
      couponCount: coupons.length,
    })
  } catch (error) {
    console.error("Error seeding database:", error)
    return res.status(500).json({ success: false, message: "Failed to seed database" })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})


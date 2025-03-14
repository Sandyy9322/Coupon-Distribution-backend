const { MongoClient } = require("mongodb")
require("dotenv").config()

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your MongoDB URI to .env file")
}

const uri = process.env.MONGODB_URI
const options = {}

let client
let clientPromise

if (process.env.NODE_ENV === "development") {

  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

async function connectToDatabase() {
  const client = await clientPromise
  const db = client.db(process.env.MONGODB_DB || "coupon-system")

  return { client, db }
}

module.exports = { connectToDatabase }


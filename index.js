const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config("/.env");
const app = express();
app.use(cors());

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = process.env.URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const port = 3000;

app.get("/", (req, res) => {
  res.send("backend running");
});

app.get("/data", (req, res) => {
  res.send("data comming soon");
});

async function run() {
  try {
    await client.connect();
    const db = client.db("habit-tracker");
    const bidsCollection = db.collection("habits");

    // controller
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`localhost Running port on: ${port}`);
});

// call batabases
client
  .connect()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running now on port: ${port}`);
    });
  })
  .catch(console.dir);

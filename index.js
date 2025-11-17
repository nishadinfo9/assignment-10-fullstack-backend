const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config("/.env");
const app = express();
app.use(express.json());
app.use(express.urlencoded());
app.use(cors());

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFireBaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return;
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("inside token", decoded);
    req.token_email = decoded.email;
    next();
  } catch (error) {}
  if (!decoded) {
    res.send({ message: "unauthorize decoded token" });
  }
};

const client = new MongoClient(process.env.URI, {
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
    const db = client.db("habit-tracker-app");
    const habitCollection = db.collection("habit");

    // controller
    app.post("/habits", async (req, res) => {
      const newData = {
        ...req.body,
        stack: 0,
        completionHistory: [],
        createdAt: new Date(),
      };
      const cretaedHabits = await habitCollection.insertOne(newData);
      res.send(cretaedHabits);
    });

    app.patch("/habits/update/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) return;
      const query = { _id: new ObjectId(id) };
      const updatedData = req.body;
      const update = {
        $set: {
          title: updatedData.title,
          description: updatedData.description,
          category: updatedData.category,
        },
      };
      const result = await habitCollection.updateOne(query, update);
      res.send(result);
    });

    app.delete("/habits/delete/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) return;
      const query = { _id: new ObjectId(id) };
      const result = await habitCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/habits", async (req, res) => {
      const cursor = habitCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/habits/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) return;
      const query = { _id: new ObjectId(id) };
      const getById = await habitCollection.findOne(query);
      res.send(getById);
    });

    app.get("/recent", async (req, res) => {
      const cursor = habitCollection.find().sort({ createdAt: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/my-habits", verifyFireBaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};

      if (email) {
        query.author_email = email;
      }

      if (email !== req.token_email) {
        return res.status(403).send({ message: "forbeden access" });
      }

      const cursor = habitCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // daily stack
    app.patch("/habits/mark/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) return;
      const query = { _id: new ObjectId(id) };
      const today = new Date().toISOString().split("T")[0];

      const habits = await habitCollection.findOne(query);
      const isTodayCompleted = habits?.completionHistory?.includes(today);
      let updateData = {};

      if (!isTodayCompleted) {
        updateData = {
          $push: { completionHistory: today },
          $inc: { stack: 1 },
        };
      } else {
        return res
          .status(401)
          .json({ message: "today is completed", updateData });
      }

      const updateCompletionHistory = await habitCollection.updateOne(
        query,
        updateData
      );
      res.send(updateCompletionHistory);
    });

    app.patch("/habits/missed/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) return;
      const query = { _id: new ObjectId(id) };

      const habits = await habitCollection.findOne(query);

      const today = new Date().toISOString().split("T")[0];
      const lastDate =
        habits.completionHistory[habits.completionHistory?.length - 1];

      const diffdate =
        (new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24);

      if (diffdate >= 2) {
        await habitCollection.updateOne(query, {
          $inc: { stack: -1 },
        });
      }
      res.send({ message: "checked" });
    });
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

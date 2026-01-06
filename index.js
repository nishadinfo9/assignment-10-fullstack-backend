const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const bcrypt = require("bcryptjs");
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
    const db = client.db("habits-app");
    const habitCollection = db.collection("habits");
    const userCollection = db.collection("users");

    // controller
    app.post("/user/create-account", async (req, res) => {
      try {
        const { fullName, email, photoURL, password, provider, emailVerified } =
          req.body;

        if (!fullName || !email || !photoURL || !password) {
          return res.status(400).json({ message: "all field are empty" });
        }

        const existUser = await userCollection.findOne({ email });

        if (existUser) {
          const isPasswordCorrect = await bcrypt.compare(
            password,
            existUser.password
          );

          if (!isPasswordCorrect) {
            return res.status(401).json({ message: "Invalid Credentials" });
          }

          return res
            .status(200)
            .json({ message: "recent user login successfully" });
        }

        const hashedPasword = await bcrypt.hash(password, 10);

        if (!hashedPasword) {
          return res.status(401).json({ message: "password hashed faild" });
        }

        const user = userCollection.insertOne({
          fullName,
          email,
          photoURL,
          password: hashedPasword,
          provider,
          emailVerified,
        });

        return res
          .status(201)
          .json({ message: "account created successfully", user });
      } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    //Dashboard
    app.post("/habit/add", async (req, res) => {
      try {
        const { habitName } = req.body;

        if (!habitName) {
          return res.status(400).json({ message: "habitName does not exist" });
        }

        const today = new Date().toISOString().split("T")[0];

        const newHabit = {
          _id: new ObjectId(),
          habitName,
          streak: 0,
          completed: false,
          pinned: false,
          history: {
            [today]: true,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await habitCollection.insertOne(newHabit);

        return res
          .status(201)
          .json({ message: "habit created successfully", habit: newHabit });
      } catch (error) {
        console.log("habit creatde error", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/habit/update-habit/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { habitName } = req.body;
        console.log(habitName);

        if (!id) {
          return res
            .status(400)
            .json({ message: "habit updated id does not exist" });
        }

        if (!habitName) {
          return res
            .status(400)
            .json({ message: "updated habit does not exist" });
        }

        const query = { _id: new ObjectId(id) };

        const update = await habitCollection.findOneAndUpdate(
          query,
          {
            $set: {
              habitName: habitName,
            },
          },
          { returnDocument: "after" }
        );

        return res
          .status(200)
          .json({ message: "habit updated successfully", habit: update });
      } catch (error) {
        console.log("habit update error", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/habit/all-habits", async (req, res) => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const habits = await habitCollection
          .find(
            {},
            {
              projection: { habitName: 1, pinned: 1, history: 1, completed: 1 },
            }
          )
          .sort({ pinned: -1, createdAt: -1 })
          .toArray();

        const todayHabits = habits.map((h) => ({
          _id: h._id,
          habitName: h.habitName,
          pinned: h.pinned,
          completed: !!h.history?.[todayStr],
        }));

        if (!todayHabits) {
          return res.status(404).json({ message: "todayHabits not found" });
        }

        return res.status(200).json({
          message: "todayHabits found successfully",
          habits: todayHabits,
        });
      } catch (error) {
        console.log("all habits found successfully", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/habit/delete/:id", async (req, res) => {
      try {
        const { id } = req.params;
        console.log("id", id);

        if (!id) {
          return res.status(400).json({ message: "delete id does not exist" });
        }

        const query = { _id: new ObjectId(id) };

        const deleteHabit = await habitCollection.deleteOne(query);

        if (!deleteHabit) {
          return res.status(401).json({ message: "habit deleted failed" });
        }

        return res
          .status(200)
          .json({ message: "habit deleted successfully", habit: deleteHabit });
      } catch (error) {
        console.log("habit deleted error", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/habit/habit-completion/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { isCompleted } = req.body;
        if (!id) {
          return res
            .status(400)
            .json({ message: "habit completion id does not exist" });
        }
        const query = { _id: new ObjectId(id) };

        const habit = await habitCollection.findOne(query);

        if (!habit) {
          return res.status(401).json({ message: "habit not found" });
        }

        const today = new Date().toISOString().split("T")[0];

        habit.history[today] = !habit.history[today];

        const dates = Object.keys(habit.history).sort().reverse();

        let streak = 0;
        for (const date of dates) {
          if (!habit.history[date]) break;
          streak++;
        }

        habit.streak = streak;
        habit.completed = habit.history[today];
        habit.updatedAt = new Date();

        await habitCollection.updateOne(query, {
          $set: {
            history: habit.history,
            streak: habit.streak,
            completed: isCompleted,
          },
        });
        return res
          .status(200)
          .json({ message: "toggle completion successfully", habit });
      } catch (error) {
        console.log("toggle completion failed", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/habit/pin-habit/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { pinned } = req.body;

        const habit = await habitCollection.findOne({ _id: new ObjectId(id) });
        if (!habit) return res.status(404).json({ message: "Habit not found" });

        habit.pinned = pinned;
        habit.updatedAt = new Date();

        await habitCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { pinned: pinned } }
        );

        return res.status(200).json({ habit });
      } catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`localhost Running port on: ${port}`);
});

// call batabases
// client
//   .connect()
//   .then(() => {
//     app.listen(port, () => {
//       console.log(`Server is running now on port: ${port}`);
//     });
//   })
//   .catch(console.dir);

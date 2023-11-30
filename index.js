const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
// const stripe = require("stripe")(
//   "sk_test_51OGC6bLgdKhl0Qn1VTDVWazHBd3FObmpcdxeXac6U9KWZiDgswRyGhpU6onToj0lDjK6r7dX2NuNyTUPRn4uw4aw00q8x2pbWN"
// );
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middle ware
app.use(cors({origin: ['http://localhost:5173'],credentials: true,
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ukrdjza.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();
    const propertyCollection = client
      .db("verderaRealEstateDB")
      .collection("properties");
    const userCollection = client.db("verderaRealEstateDB").collection("users");
    const offerCollection = client.db("verderaRealEstateDB").collection("offers");

      const verifyToken = (req, res, next) => {
        const token = req.cookies.token;
        if (!token) {
          return res.status(401).send({ message: "Not authorized" });
        }
        jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: "Unauthorized" });
          }
          // if token valid it would be decoded
          req.user = decoded;
          next();
        });
      };
      
      app.post('/jwt', async(req,res)=> {
        const user = req.body;
        const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, {expiresIn: '6h'});
        res.cookie('token', token, {httpOnly:true, secure:true, sameSite: 'none'}).send({success:true})
      })

      app.post("/logout", async (req, res) => {
        const user = req.body;
        res.clearCookie("token", { maxAge: 0, 
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          }).send({ success: true });
      });
    // properties related api
    app.get("/properties", async (req, res) => {
      const result = await propertyCollection.find().toArray();
      res.send(result);
    });
    app.get("/properties/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(filter);
      res.send(result);
    });

    // offer related api
    app.post("/offers",verifyToken, async (req, res) => {
      const body = req.body; // body
      const offer = {
        ...body,
      };
      const result = await offerCollection.insertOne(offer);
      res.send(result);
    });
    app.get("/offers",verifyToken,  async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await offerCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/offers/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await offerCollection.findOne(filter);
      res.send(result);
    });
    app.delete("/offers/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = offerCollection.deleteOne(filter);
      res.send(result);
    });

    // user related api

    app.post("/users",verifyToken, async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users",verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.delete("/users/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`Verdera real estate server is runnig`);
});
app.listen(port, () => {
  console.log(`Verdera real estate server is runnig on Port/${port}`);
});

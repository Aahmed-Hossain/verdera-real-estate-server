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
app.use(cors());
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
    const propertyCollection = client.db("verderaRealEstateDB").collection("properties");
    const userCollection = client.db("verderaRealEstateDB").collection("users");

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

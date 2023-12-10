const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KRY);
const app = express();
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
	username: 'api',
	key: process.env.MAIL_GUN_API_KEY,
});

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middle ware
app.use(cors({ origin: ["http://localhost:5173", "https://fir-module51.web.app"], credentials: true }));
app.use(express.json());
app.use(cookieParser());

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
    // await client.connect();
    const propertyCollection = client
      .db("verderaRealEstateDB")
      .collection("properties");
    const userCollection = client.db("verderaRealEstateDB").collection("users");
    const offerCollection = client.db("verderaRealEstateDB").collection("offers");
    const wishListCollection = client.db("verderaRealEstateDB").collection("wishList");
    const reviewCollection = client.db("verderaRealEstateDB").collection("reviews");
    const paymentCollection = client.db("verderaRealEstateDB").collection("payments");

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

    const verifyAdmin = async (req, res, next)=> {
      const user = req.user;
      const query = {email: user?.email};
      const result = await userCollection.findOne(query);
      if(!result || result?.role !=="Admin")
      return res.status(401).send({message: 'Un Authorized'})
    next();
    };

    const verifyAgent = async (req, res, next)=> {
      const user = req.user;
      const query = {email: user?.email};
      const result = await userCollection.findOne(query);
      if(!result || result?.role !=="Agent")
      return res.status(401).send({message: 'Un Authorized'})
    next();
    };

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, {
        expiresIn: "6h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    

    app.get("/properties", async (req, res) => {
      const query = {
        verification_status: "Verified"
      };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/properties/verifiyStatus", async (req, res) => {
      const query = {
        verification_status: "Pending"
      };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });
    //property verify related api
    app.delete("/properties/verifiyStatus/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const result = await propertyCollection.deleteOne(filter);
      res.send(result);
    });

    app.put("/properties/verifiyStatus/:id", async (req, res) => {
      const id = req.params.id;
      const result = await propertyCollection.updateOne({ _id: new ObjectId(id), verification_status: "Pending" },
      { $set: { verification_status: "Verified" } });
      res.send(result);
    });

     app.delete("/properties/addedProperties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const result = await propertyCollection.deleteOne(filter);
      res.send(result);
    });

    app.put("/properties/addedProperties/:id", async (req, res) => {
      const id = { _id: new ObjectId(req.params.id) };
      console.log("/properties/addedProperties/:id", id);
      const body = req.body;
      const updatedData = {
        $set: { ...body },
      };
      const option = { upsert: true };
      const result = await propertyCollection.updateOne(id, updatedData, option);
      res.send(result);
    });

     app.get("/properties/addedProperties", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { agent_email: req.query.email };
      }
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });
    
    app.get("/properties/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(filter);
      res.send(result);
    });

    app.post("/properties", async (req, res) => {
      const body = req.body;
      const property = {
        ...body,
      };
      const result = await propertyCollection.insertOne(property);
      res.send(result);
    });

    app.delete('/mark-fraud/:email', verifyToken,  async(req, res)=> {
      try{
        const  fraudEmail = req?.params?.email;
      // {agent_email: fraudEmail, verification_status: "Pending"}
      const updateUserResult = await userCollection.updateOne(
        { email: fraudEmail, role: { $in: ["Agent", "User", "Admin"] } },
        { $set: { role: "Fraud" } }
      );
      const deletePropertiesResult = await propertyCollection.deleteMany({ agent_email: fraudEmail });
      res.send({ updateUserResult, deletePropertiesResult });
      }
      catch(error){
        res.send(error)
      }
    })


    // app.get("/allProperties/:name", async (req, res) => {
    //   const name = req.params.name;
    //   console.log(name);
    //   const query = { property_title: { $regex: new RegExp(name, "i") } }; // Case-insensitive search
    //   const result = await propertyCollection.find(query).toArray();
    //   res.send(result);
    // });
    app.get("/allProperties/:name", async (req, res) => {
      try {
        const name = req.params.name;
        console.log(name);
        const decodedSearchTerm = decodeURIComponent(name); // Decode the search term
        const query = { property_title: { $regex: new RegExp(decodedSearchTerm, "i") } };
        const result = await propertyCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    }); 
    



    // user offers api
    app.post("/offers", verifyToken, async (req, res) => {
      const body = req.body; // body
      const offer = {
        ...body,
      };
      const result = await offerCollection.insertOne(offer);
      res.send(result);
    });

    app.delete("/offers/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = offerCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/allOffers", verifyToken, async (req, res) => {
      const result = await offerCollection.find().toArray();
      res.send(result);
    });

    // TO LOAD INDIVIDUAL DATA FOR AGENT TO  ACCEPT OR REJECT A OFFER
    app.get("/offers", verifyToken, async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { agent_email: req.query.email };
      }
      const result = await offerCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/offers/user", verifyToken, async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await offerCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/offers/accepted/calculatePrice", async (req, res) => {
      const { status, email } = req.query;
      const query = {
        status: status || "Accepted", 
        email: email ,
      };
      const result = await offerCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/offers/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await offerCollection.findOne(filter);
      res.send(result);
    });

    app.put("/allOffers/accepted/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await offerCollection.updateOne(
        { _id: new ObjectId(id), status: { $in: ["Pending", "pending", "Rejected", "Accepted"] } },
        { $set: { status: "Accepted" } }
      );
      res.send(result);
    });

    app.put("/allOffers/rejected/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await offerCollection.updateOne(
        { _id: new ObjectId(id), status: { $in: ["Pending", "pending", "Rejected", "Accepted"] } },
        { $set: { status: "Rejected" } }
      );
      res.send(result);
    });

    // user related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users/admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      // console.log('Admin id', id);
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id), role: { $in: ["Agent", "User"] } },
        { $set: { role: "Admin" } }
      );
      res.send(result);
    });

    app.put("/users/agent/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      // console.log('Admin id', id);
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id), role: { $in: ["User", "Fraud"] } },
        { $set: { role: "Agent" } }
      );
      res.send(result);
    });

    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/user/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const result = await userCollection.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
      // console.log(result);
      res.send(result);
    });
    app.delete("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });

    // wish list 

    app.post("/wishList", verifyToken, async (req, res) => {
      const body = req.body; 
      const wishList = {
        ...body,
      };
      const result = await wishListCollection.insertOne(wishList);
      res.send(result);
    });

    app.get('/wishList/:email', verifyToken, async(req,res)=> {
      const email = req.params.email;
      // console.log('/wishList/:email', email);
      const result = await wishListCollection.find({email}).toArray();
      res.send(result);
    });
    app.delete('/wishList/:id', async(req, res)=> {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const result = await wishListCollection.deleteOne(filter);
      res.send(result);
    });

    // reviews related api
    app.get('/reviews', async(req,res)=> {
      const result = await reviewCollection.find().toArray();
      console.log(result );
      res.send(result);
    });

    app.get('/reviews/titleSpecific/:title', verifyToken, async(req,res)=> {
      const title = req.params.title
      const result = await reviewCollection.find({property_title:title}).toArray();
      res.send(result);
    });

    app.post("/reviews/titleSpecific", verifyToken, async (req, res) => {
      const body = req.body; // body
      const review = {
        ...body,
      };
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.get('/reviews/:email', verifyToken, async(req,res)=> {
      const email = req.params.email;
      const result = await reviewCollection.find({email}).toArray();
      console.log(result);
      res.send(result);
    });

    app.delete('/reviews/:id', verifyToken, async(req, res)=>{
      const id =  req.params.id;
      const filter = {_id: new ObjectId(id)};
      const result = await reviewCollection.deleteOne(filter);
      res.send(result);
    });

    // payment related api
    app.post('/createPaymentIntent', verifyToken, async(req, res)=> {
      const {price} = req.body;
      const amount = parseInt(price*100);
      if(!price || amount<1) return;
      const {client_secret} = await stripe.paymentIntents.create({
        amount:amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({clientSecret: client_secret});
    });

    app.post('/payments',verifyToken, async(req,res)=> {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      mg.messages
	.create(process.env.MAIL_GUN_SENDING_DOMAIN, {
		from: "Mailgun Sandbox <postmaster@sandboxd1b4c498ff5c4e41ac9128f88ce33a08.mailgun.org>",
		to: [`${payment?.payment?.email}`],
		subject: "Verdera Real Estate Company",
		text: "Testing some Mailgun awesomness!",
    html: `
    <div>
    <h2> Thank you for your order</h2>
   <h4> Yor Transaction ID: <strong>${payment.transactionId}"</strong></h4>
   <p> We would like to get your Feedback</p>
    </div>
    `
	})
	.then(msg => console.log(msg)) // logs response data
	.catch(err => console.log(err)); // logs any error`;
      res.send(result);
    });

    app.get('/payment/specifiAgent',verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await paymentCollection.find({ 'payment.agent_email': email }).toArray();
      res.send(result);
    });

    app.get('/payment/specificUser', verifyToken, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const result = await paymentCollection.find({ 'payment.email': email }).toArray();
      res.send(result);
    });
    

    // TODO: want to change status of accepted offered sale_status but not working.

    // app.patch('/saleStatus', async (req, res) => {
    //   const id = req.params.id;
    //   const status = req.query.status; // Access status from query parameters
    //   const query = { _id: new ObjectId(id) };
    //   const updateDoc = {
    //     $set: {
    //       sale_status: status,
    //     },
    //   };
    //   try {
    //     const result = await offerCollection.updateOne(query, updateDoc);
    //     console.log(result);
    //     res.send(result);
    //   } catch (err) {
    //     console.error(err);
    //     res.status(500).send(err.message);
    //   }
    // });

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

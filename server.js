import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { threadId } from "worker_threads";
config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Supabase Configuration (Replace with your credentials)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Express Setup
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.json()); // Body parser middleware
app.use(express.urlencoded({ extended: false })); // Form parser middleware

const authenticate = async (req, res, next) => {
  const { access_token } = req.session; // Use session or cookie
  if (!access_token) {
    return res.redirect("/admin/login"); // Redirect to login if no token
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(access_token);
    if (error) throw Error(error.message); // Redirect if unauthorized

    req.user = user; // Attach user info to request
    next();
  } catch (error) {
    res.redirect("/admin/login");
  }
};

// Routes
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/service", (req, res) => {
  res.render("service");
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/contact", (req, res) => {
  res.render("contact");
});

app.get("/testimonial", (req, res) => {
  res.render("testimonial");
});

app.get("/track", async (req, res) => {
  const { id } = req.query;
  try {
    // Fetch order details using the tracking ID
    const { data: order, error } = await supabase
      .from("order") // Replace with your actual table name
      .select("*")
      .eq("id", id) // Adjust this to the correct column name
      .single();

    // Handle error from Supabase
    if (error || !order) {
      return res.render("track", { error: "Tracking id is invalid.", id });
    }

    // Render the order details page (create an appropriate EJS template)
    res.render("track", { order, id, error: null });
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.render("track", {
      error: "An error occurred while fetching the order.",
      id,
    });
  }
});

app.get("/admin/dashboard", authenticate, async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from("order").select("*");
    if (error) throw Error("An error occured");
    res.render("admin/index", { orders, error: null });
  } catch (error) {
    res.render("admin/index", {
      error: "An error occurred while fetching orders.",
    });
  }
});

app.get("/admin/tracker", authenticate, async (req, res) => {
  res.render("admin/tracking");
});

app.get("/admin/login", (req, res) => {
  if (req.session.access_token) res.redirect("/admin/dashboard");
  res.render("admin/login", { error: null });
});

app.get("/admin/register", (req, res) => {
  if (req.session.access_token) res.redirect("/admin/dashboard");

  res.render("admin/register", { error: null });
});

app.get("/admin/reset", (req, res) => {
  if (req.session.access_token) res.redirect("/admin/dashboard");

  res.render("admin/reset", { error: null, sent: null });
});

// Route to view a specific order
app.get("/admin/order/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  const { data: order, error } = await supabase
    .from("order")
    .select("*")
    .eq("id", id)
    .single(); // Fetch single record

  if (error) {
    return res.status(404).send("Order not found");
  }

  res.render("admin/order", { order });
});

// Route to view a specific order
app.get("/admin/order/:id/edit", authenticate, async (req, res) => {
  const { id } = req.params;

  const { data: order, error } = await supabase
    .from("order")
    .select("*")
    .eq("id", id)
    .single(); // Fetch single record

  if (error) {
    return res.status(404).send("Order not found");
  }

  res.render("admin/editTrack", { order });
});

// post routes

app.post("/admin/order", authenticate, async (req, res) => {
  const {
    senderName,
    senderEmail,
    senderAddress,
    parcelHeight,
    parcelWidth,
    parcelLength,
    parcelWeight,
    recipientName,
    recipientEmail,
    recipientAddress,
    item,
    shipping_address,
    status,
  } = req.body;

  const userId = req.user.id; // Get user ID

  const { error } = await supabase.from("order").insert([
    {
      userId,
      email: recipientEmail,
      status,
      sender_address: senderAddress,
      sender_email: senderEmail,
      sender_name: senderName,
      shipping_address,
      item,
      recipient_name: recipientName,
      recipient_address: recipientAddress,
      height: parcelHeight,
      length: parcelLength,
      weight: parcelWeight,
      width: parcelWidth,
    },
  ]);

  if (error) return res.status(400).send(error.message);
  res.redirect("/admin/dashboard");
});

app.post("/admin/order/delete", authenticate, async (req, res) => {
  const { order } = req.body;

  const { error } = await supabase.from("order").delete().eq("id", order);

  if (error) return res.status(400).send(error.message);
  res.redirect("/admin/dashboard");
});

app.post("/admin/order/edit", authenticate, async (req, res) => {
  const {
    senderName,
    senderEmail,
    senderAddress,
    parcelHeight,
    parcelWidth,
    parcelLength,
    parcelWeight,
    recipientName,
    recipientEmail,
    recipientAddress,
    item,
    shipping_address,
    status,
    id,
  } = req.body;

  try {
    const { data, error } = await supabase
      .from("order")
      .update({
        email: recipientEmail,
        status,
        sender_address: senderAddress,
        sender_email: senderEmail,
        sender_name: senderName,
        shipping_address,
        item,
        recipient_name: recipientName,
        recipient_address: recipientAddress,
        height: parcelHeight,
        length: parcelLength,
        weight: parcelWeight,
        width: parcelWidth,
      })
      .eq("id", id)
      .select();

    if (error) return res.status(400).send(error.message);

    res.redirect("/admin/order/" + id);
  } catch (error) {
    console.log(error);
  }
});

// handling authorizations
// Register User
app.post("/admin/register", async (req, res) => {
  const { email, password } = req.body;
  if (email.lenght == 0 || password.lenght == 0)
    return res.render("admin/register", {
      error: "no field should be left empty",
    });
  try {
    const { user, error } = await supabase.auth.signUp({ email, password });
    if (error)
      return res.status(401).render("admin/register", { error: error.message });
  } catch (error) {
    return res
      .status(401)
      .render("admin/register", { error: "Internal server error" });
  }

  res.redirect("/admin/login");
});

// Login User
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  if (email.lenght == 0 || password.lenght == 0)
    return res.render("admin/login", {
      error: "no field should be left empty",
    });

  const {
    data: { session },
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error)
    return res.status(401).render("admin/login", { error: error.message });

  req.session.access_token = session.access_token;

  res.redirect("/admin/dashboard");
});

app.post("/admin/reset", async (req, res) => {
  const { email } = req.body;
  try {
    if (email.lenght == 0)
      return res.render("admin/login", {
        error: "no field should be left empty",
      });

    let { data, error } = await supabase.auth.resetPasswordForEmail(email);

    if (error)
      return res
        .status(401)
        .render("admin/reset", { error: error.message, sent: false });

    res.render("/admin/reset", { sent: true, error: null });
  } catch (error) {
    res.render("/admin/reset", { sent: true, error: error.message });
  }
});

// Logout User
app.post("/logout", async (req, res) => {
  await supabase.auth.signOut();
  req.session.destroy();
  res.redirect("/");
});

// Handling app request errors
app.use((req, res, next) => {
  const error = new Error("Not Found");
  error.status = 404;
  next(error); // Pass the error to the next error handling middleware
});

app.use((err, req, res, next) => {
  const errorcode = err == "Error: Not Found" ? 404 : 500; // Default to 500 for internal server error
  const errorMessage =
    err == "Error: Not Found" ? "Page Not Found" : "Internal Server Error";
  res.status(errorcode).render("404", { errorcode, errorMessage });
});

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

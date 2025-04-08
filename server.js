import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
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

  if (!id) {
    return res.render("track", { id: "", error: null, order: null });
  }

  try {
    // Fetch order details using the tracking ID (now can be custom tracking number)
    const { data: order, error } = await supabase
      .from("order")
      .select("*")
      // .or(`id.eq.${id},tracking_number.eq.${id}`)
      .eq("tracking_number", id)
      .single();

    // Handle error from Supabase
    if (error || !order) {
      return res.render("track", {
        error: "Tracking ID is invalid.",
        id,
        order: null,
      });
    }

    // Render the order details page
    res.render("track", { order, id, error: null });
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.render("track", {
      error: "An error occurred while fetching the order.",
      id,
      order: null,
    });
  }
});

app.get("/admin/dashboard", authenticate, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("order")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw Error("An error occurred");
    res.render("admin/index", { orders, error: null });
  } catch (error) {
    res.render("admin/index", {
      error: "An error occurred while fetching orders.",
      orders: [],
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

  // Get list of statuses for dropdown
  const statuses = [
    "PACKAGE RECEIVED",
    "IN TRANSIT",
    "OUT FOR DELIVERY",
    "DELIVERED",
    "DELIVERY EXCEPTION",
    "CLEARANCE DELAY",
    "INCORRECT ADDRESS",
    "PENDING",
  ];

  res.render("admin/editTrack", { order, statuses });
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
    tracking_number,
  } = req.body;

  const userId = req.user.id; // Get user ID

  // Generate tracking number if not provided
  const finalTrackingNumber =
    tracking_number || `GHS${Math.floor(100000 + Math.random() * 900000)}`;

  const { data, error } = await supabase
    .from("order")
    .insert([
      {
        userId,
        email: recipientEmail,
        status: status || "PENDING",
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
        tracking_number: finalTrackingNumber,
      },
    ])
    .select();

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
    tracking_number,
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
        tracking_number: tracking_number,
      })
      .eq("id", id)
      .select();

    if (error) return res.status(400).send(error.message);

    res.redirect("/admin/order/" + id);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
});

// Route to update just the status (for quick status updates)
app.post("/admin/order/update-status", authenticate, async (req, res) => {
  const { id, status } = req.body;

  try {
    const { error } = await supabase
      .from("order")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    res.redirect("/admin/order/" + id);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating status");
  }
});

// handling authorizations
// Register User
app.post("/admin/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || email.length == 0 || password.length == 0)
    return res.render("admin/register", {
      error: "No field should be left empty",
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

  if (!email || !password || email.length == 0 || password.length == 0)
    return res.render("admin/login", {
      error: "No field should be left empty",
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
    if (!email || email.length == 0)
      return res.render("admin/login", {
        error: "No field should be left empty",
      });

    let { data, error } = await supabase.auth.resetPasswordForEmail(email);

    if (error)
      return res
        .status(401)
        .render("admin/reset", { error: error.message, sent: false });

    res.render("admin/reset", { sent: true, error: null });
  } catch (error) {
    res.render("admin/reset", { sent: false, error: error.message });
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
  const errorcode = err.message == "Not Found" ? 404 : 500; // Default to 500 for internal server error
  const errorMessage =
    err.message == "Not Found" ? "Page Not Found" : "Internal Server Error";
  console.log(err);
  res.status(errorcode).render("404", { errorcode, errorMessage });
});

const port = process.env.PORT || 5050;
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

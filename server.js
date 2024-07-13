import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Supabase Configuration (Replace with your credentials)
const supabaseUrl = "https://hrjnfdqruuenjieffspf.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyam5mZHFydXVlbmppZWZmc3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NTQ3ODUsImV4cCI6MjAzNjIzMDc4NX0.PvujPAR0_LI9sREcht8-LDTVMbn5TbUYUQVVs895gXA";
const supabase = createClient(supabaseUrl, supabaseKey);

// Express Setup
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(
  session({
    secret:
      "c29tZSByYW5kb20gc3RyaW5nIHdpdGggcmFuZG9tIHN0cmluZyBhbmQgcGFyYWxsbGVsIHNjaGVtZXMgYW5kIGNvbW1lbnRz",
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
    if (error) {
      return res.redirect("/admin/login"); // Redirect if unauthorized
    }

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

app.get("/track", (req, res) => {
  const { id } = req.query;
  console.log(id);
  res.render("track", { id });
});

app.get("/admin/dashboard", authenticate, async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from("order").select("*");
    console.log(orders);
    if (error) throw Error("An error occured");
    res.render("admin/index", { orders, error: null });
  } catch (error) {
    res.render("admin/index", {
      error: "An error occurred while fetching orders.",
    });
  }
});

app.get("/admin/login", (req, res) => {
  if (req.session.access_token) res.redirect("/admin/dashboard");
  res.render("admin/login", { error: null });
});

app.get("/admin/register", (req, res) => {
  if (req.session.access_token) res.redirect("/admin/dashboard");

  res.render("admin/register", { error: null });
});

// post routes

app.post("/orders", authenticate, async (req, res) => {
  const { product_id, quantity } = req.body;
  const userId = req.session.user.id; // Get user ID from session

  const { data, error } = await supabase
    .from("orders")
    .insert([{ user_id: userId, product_id, quantity }]);

  if (error) return res.status(400).send(error.message);
  res.redirect("/orders"); // Redirect to orders page
});

// handling authorizations
// Register User
app.post("/admin/register", async (req, res) => {
  const { email, password } = req.body;
  // if (email.lenght == 0 || password.lenght == 0)
  //   return res.render("admin/register", {
  //     error: "no field should be left empty",
  //   });
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

  console.log(session);
  if (error)
    return res.status(401).render("admin/login", { error: error.message });

  req.session.access_token = session.access_token;

  res.redirect("/admin/dashboard");
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

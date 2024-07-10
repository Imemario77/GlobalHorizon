import express from "express";
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

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

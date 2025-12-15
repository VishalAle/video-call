const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);

/**
 * Health check route
 * This is IMPORTANT so you don't see "Cannot GET /"
 */
app.get("/", (req, res) => {
  res.send("Socket.io signaling server is running");
});

const io = require("socket.io")(server, {
  cors: {
    origin: "*", // allow frontend (Vercel)
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Send socket id to frontend
  socket.emit("me", socket.id);

  socket.on("disconnect", () => {
    socket.broadcast.emit("callEnded");
  });

  socket.on("callUser", (data) => {
    io.to(data.userToCall).emit("callUser", {
      signal: data.signalData,
      from: data.from,
      name: data.name,
    });
  });

  socket.on("answerCall", (data) => {
    io.to(data.to).emit("callAccepted", data.signal);
  });

  socket.on("endCall", (data) => {
    io.to(data.to).emit("callEnded");
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

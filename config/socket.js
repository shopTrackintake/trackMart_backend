import { Server } from "socket.io";

let io = null;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "https://trackmart-frontend-1erg.onrender.com"
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log("⚡ [WebSocket] Client connected:", socket.id);

    // Allow authenticated/connected user to join their personal room
    socket.on("join_user_room", (userId) => {
      if (userId) {
        const roomName = `user_${userId}`;
        socket.join(roomName);
        console.log(`👤 [WebSocket] Socket ${socket.id} joined room ${roomName}`);
      }
    });

    socket.on("disconnect", () => {
      console.log("🔌 [WebSocket] Client disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  return io;
};

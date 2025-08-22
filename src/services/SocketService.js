// src/services/SocketService.js
let io = null;

class SocketService {
  static init(socketIo) {
    io = socketIo;
    
    io.on('connection', (socket) => {
      console.log('客户端连接:', socket.id);
      
      socket.on('disconnect', () => {
        console.log('客户端断开连接:', socket.id);
      });

      // 客户端可以加入特定房间以接收定向消息
      socket.on('join', (data) => {
        if (data.room) {
          socket.join(data.room);
          console.log(`客户端 ${socket.id} 加入房间: ${data.room}`);
        }
      });
    });
  }

  static emitToSocket(socketId, event, data) {
    if (io && socketId) {
      io.to(socketId).emit(event, data);
    }
  }

  static emitToRoom(room, event, data) {
    if (io && room) {
      io.to(room).emit(event, data);
    }
  }

  static broadcast(event, data) {
    if (io) {
      io.emit(event, data);
    }
  }
}

module.exports = SocketService;
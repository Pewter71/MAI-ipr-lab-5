import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

const PORT = process.env.PORT || 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES) || 50;

export function createChatServer(options = {}) {
  const {
    redisUrl = REDIS_URL,
    corsOrigin = CORS_ORIGIN,
    maxMessages = MAX_MESSAGES
  } = options;

  const httpServer = createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }));
      return;
    }
    
    res.writeHead(404);
    res.end();
  });

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
  subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    adapter: createAdapter(pubClient, subClient)
  });

  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    const clientId = socket.id;
    console.log(`User connected: ${clientId}`);

    pubClient.lRange('chat:messages', 0, maxMessages - 1).then(messages => {
      const parsedMessages = messages.reverse().map(msg => {
        try {
          return JSON.parse(msg);
        } catch (e) {
          console.error('Error parsing message:', e);
          return null;
        }
      }).filter(Boolean);
      
      socket.emit('message:history', parsedMessages);
    }).catch(err => {
      console.error('Error fetching message history:', err);
      socket.emit('message:history', []);
    });

    socket.on('user:join', (username) => {
      if (!username || typeof username !== 'string') {
        return socket.emit('error', { message: 'Invalid username' });
      }

      const sanitizedUsername = username.trim().substring(0, 50);
      onlineUsers.set(clientId, sanitizedUsername);
      socket.username = sanitizedUsername;
      
      io.emit('user:list', Array.from(onlineUsers.values()));
      io.emit('system:message', { 
        text: `${sanitizedUsername} присоединился к чату`, 
        timestamp: Date.now() 
      });

      console.log(`User joined: ${sanitizedUsername}`);
    });

    socket.on('message:send', async (data) => {
      if (!socket.username) {
        return socket.emit('error', { message: 'Not authorized' });
      }

      if (!data || !data.text || typeof data.text !== 'string') {
        return socket.emit('error', { message: 'Invalid message' });
      }

      const sanitizedText = data.text.trim().substring(0, 1000);
      if (!sanitizedText) return;

      const message = {
        id: Date.now() + Math.random(),
        username: socket.username,
        text: sanitizedText,
        timestamp: Date.now()
      };

      try {
        await pubClient.lPush('chat:messages', JSON.stringify(message));
        await pubClient.lTrim('chat:messages', 0, maxMessages - 1);

        io.emit('message:new', message);
        console.log(`Message from ${socket.username}: ${sanitizedText.substring(0, 50)}`);
      } catch (err) {
        console.error('Error saving message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing:start', () => {
      if (socket.username) {
        socket.broadcast.emit('typing:update', { 
          username: socket.username, 
          isTyping: true 
        });
      }
    });

    socket.on('typing:stop', () => {
      if (socket.username) {
        socket.broadcast.emit('typing:update', { 
          username: socket.username, 
          isTyping: false 
        });
      }
    });

    socket.on('disconnect', () => {
      const username = onlineUsers.get(clientId);
      if (username) {
        onlineUsers.delete(clientId);
        io.emit('user:list', Array.from(onlineUsers.values()));
        io.emit('system:message', { 
          text: `${username} покинул чат`, 
          timestamp: Date.now() 
        });
        console.log(`User disconnected: ${username}`);
      }
    });
  });

  return {
    httpServer,
    io,
    pubClient,
    subClient,
    onlineUsers,
    async start(port = PORT) {
      await Promise.all([
        pubClient.connect(),
        subClient.connect()
      ]);
      console.log('Connected to Redis');

      return new Promise((resolve) => {
        httpServer.listen(port, () => {
          console.log(`Server running on port ${port}`);
          console.log(`CORS enabled for: ${corsOrigin}`);
          resolve();
        });
      });
    },
    async stop() {
      io.close();
      await pubClient.quit();
      await subClient.quit();
      httpServer.close();
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createChatServer();
  
  server.start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, closing connections...`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

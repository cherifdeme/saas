require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import configurations and utilities
const connectDB = require('./config/database');
const { handleConnection } = require('./socket/socketHandlers');

// Import routes
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const voteRoutes = require('./routes/votes');

// Import models for test users
const User = require('./models/User');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 requests per minute
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
  skip: (req) => {
    // Skip rate limiting for health check and in development
    return req.path === '/api/health' || process.env.NODE_ENV === 'development';
  }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/votes', voteRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files if build directory exists
const path = require('path');
const fs = require('fs');
const buildPath = path.join(__dirname, 'client/build');

if (fs.existsSync(buildPath)) {
  console.log('📁 Serving static files from:', buildPath);
  app.use(express.static(buildPath));
  
  // Catch all handler: send back React's index.html file for any non-API routes
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ message: 'API endpoint non trouvé' });
    }
    
    const indexPath = path.resolve(__dirname, 'client', 'build', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ message: 'Application frontend non trouvée' });
    }
  });
} else {
  console.log('⚠️ Build directory not found, serving API only');
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err.stack);
  res.status(500).json({ 
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler - only for API routes not caught above
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint non trouvé' });
});

// Socket.IO connection handling
handleConnection(io);

// Create test users
const createTestUsers = async () => {
  try {
    const testUsers = [
      { username: 'AmySy', passwordHash: 'test1234' },
      { username: 'JonDoe', passwordHash: 'test1234' },
      { username: 'AdminTest', passwordHash: 'test1234' },
      { username: 'ScrumMaster', passwordHash: 'test1234' }
    ];

    for (const userData of testUsers) {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
      }
    }
  } catch (error) {
    console.error('Erreur lors de la création des utilisateurs de test:', error);
  }
};

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  
  // Create test users after server starts
  createTestUsers();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Serveur fermé.');
    process.exit(0);
  });
});

module.exports = { app, server, io }; 
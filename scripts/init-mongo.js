// MongoDB initialization script
db = db.getSiblingDB('planning-poker');

// Create collections with indexes
db.createCollection('users');
db.createCollection('sessions');
db.createCollection('votes');

// Create indexes for better performance
db.users.createIndex({ "username": 1 }, { unique: true });
db.sessions.createIndex({ "createdBy": 1 });
db.sessions.createIndex({ "isPublic": 1 });
db.sessions.createIndex({ "createdAt": -1 });
db.votes.createIndex({ "sessionId": 1, "userId": 1, "round": 1 }, { unique: true });
db.votes.createIndex({ "sessionId": 1, "round": 1 });

print('Planning Poker database initialized successfully!'); 
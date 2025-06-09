const roles = {
  "admin": {
    "createSession": true,
    "deleteSession": true,
    "revealVotes": true,
    "resetVotes": true,
    "selectJiraTicket": true,
    "submitVote": true,
    "viewRevealedVotes": true
  },
  "participant": {
    "createSession": false,
    "deleteSession": false,
    "revealVotes": false,
    "resetVotes": false,
    "selectJiraTicket": false,
    "submitVote": true,
    "viewRevealedVotes": true
  }
};

const getUserRole = (userId, session) => {
  return session.createdBy.toString() === userId.toString() ? 'admin' : 'participant';
};

const hasPermission = (userId, session, action) => {
  const userRole = getUserRole(userId, session);
  return roles[userRole][action] || false;
};

module.exports = {
  roles,
  getUserRole,
  hasPermission
}; 
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'homeops-prod-jwt-secret-2025-secure-key'; // From .env.local

// Create a test token
const testPayload = {
  userId: 'test-user-123',
  email: 'test@homeops.com',
  role: 'admin',
  permissions: ['delegation:read', 'delegation:write', 'delegation:admin']
};

const testToken = jwt.sign(testPayload, JWT_SECRET, { 
  expiresIn: '1h',
  issuer: 'homeops-backend'
});

console.log('Test JWT Token:');
console.log(testToken);
console.log('\nUse this token in Authorization header:');
console.log(`Bearer ${testToken}`);

// Verify the token works
try {
  const decoded = jwt.verify(testToken, JWT_SECRET);
  console.log('\nToken verification successful:');
  console.log(decoded);
} catch (error) {
  console.error('\nToken verification failed:', error);
}
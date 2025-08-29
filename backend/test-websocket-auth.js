const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3201/delegation';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGhvbWVvcHMuY29tIiwicm9sZSI6ImFkbWluIiwicGVybWlzc2lvbnMiOlsiZGVsZWdhdGlvbjpyZWFkIiwiZGVsZWdhdGlvbjp3cml0ZSIsImRlbGVnYXRpb246YWRtaW4iXSwiaWF0IjoxNzU2NDU0NDk0LCJleHAiOjE3NTY0NTgwOTQsImlzcyI6ImhvbWVvcHMtYmFja2VuZCJ9._9g9COLLfEHsnBu0-5tsh4HbJxUJHG38v_Y1dC1qWXQ';

console.log('Testing WebSocket authentication...');

// Test 1: Connection without authentication (should fail)
console.log('\n1. Testing connection WITHOUT authentication...');
const wsNoAuth = new WebSocket(WS_URL);

wsNoAuth.on('open', () => {
  console.log('❌ Connection opened without auth - this should not happen');
  wsNoAuth.close();
});

wsNoAuth.on('error', (error) => {
  console.log('✅ Connection failed without auth (expected):', error.message);
});

wsNoAuth.on('close', (code, reason) => {
  console.log(`✅ Connection closed: ${code} ${reason.toString()}`);
  
  // Test 2: Connection with authentication (should succeed)
  setTimeout(() => {
    console.log('\n2. Testing connection WITH authentication...');
    const wsWithAuth = new WebSocket(`${WS_URL}?token=${JWT_TOKEN}`);
    
    wsWithAuth.on('open', () => {
      console.log('✅ Connection opened with auth token');
      
      // Send a test message
      const testMessage = {
        id: 'test-' + Date.now(),
        type: 'system_event',
        timestamp: Date.now(),
        agentId: 'test-client',
        event: {
          name: 'auth_test',
          level: 'info',
          description: 'Testing WebSocket authentication'
        }
      };
      
      wsWithAuth.send(JSON.stringify(testMessage));
    });
    
    wsWithAuth.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('✅ Received message:', message.type, '-', message.event?.description);
        wsWithAuth.close();
      } catch (error) {
        console.log('❌ Invalid message received:', data.toString());
        wsWithAuth.close();
      }
    });
    
    wsWithAuth.on('error', (error) => {
      console.log('❌ Connection with auth failed:', error.message);
    });
    
    wsWithAuth.on('close', (code, reason) => {
      console.log(`✅ Authenticated connection closed: ${code} ${reason.toString()}`);
      console.log('\n✅ WebSocket authentication test completed');
      process.exit(0);
    });
    
  }, 1000);
});

// Test 3: Connection with Bearer header authentication
setTimeout(() => {
  console.log('\n3. Testing connection with Authorization header...');
  const wsWithHeader = new WebSocket(WS_URL, {
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`
    }
  });
  
  wsWithHeader.on('open', () => {
    console.log('✅ Connection opened with Authorization header');
    wsWithHeader.close();
  });
  
  wsWithHeader.on('error', (error) => {
    console.log('Connection with header failed:', error.message);
  });
  
  wsWithHeader.on('close', (code, reason) => {
    console.log(`Header connection closed: ${code} ${reason.toString()}`);
  });
  
}, 2000);
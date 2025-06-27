// Multi-user Socket.IO auction scenario module
// Usage: Import these functions in your test files or scripts

const { io } = require('socket.io-client');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Scenario 1: Normal bidding (users take turns, auction ends normally)
async function scenarioNormalBidding({ JWT_USERS, AUCTION_ID, SERVER_URL, BID_DELAY_MS = 1000, TOTAL_BIDS = 10, startBid = 100, minIncrement = 5 }) {
  let globalBidCount = 0;
  let currentBid = startBid;
  let increment = minIncrement;

  async function runUser(index, jwt) {
    return new Promise((resolve) => {
      const socket = io(SERVER_URL, { auth: { token: jwt } });
      let joined = false;
      socket.on('connect', () => {
        socket.emit('join_auction', { auctionId: AUCTION_ID });
      });
      socket.on('auction_state', (state) => {
        currentBid = Number(state.currentBid);
        increment = state.minIncrement || minIncrement;
        joined = true;
      });
      socket.on('bid_update', (data) => {
        currentBid = Number(data.currentBid);
        increment = data.minIncrement || minIncrement;
      });
      socket.on('auction_end', (data) => {
        socket.disconnect();
        resolve(data);
      });
      socket.on('join_error', () => { socket.disconnect(); resolve(); });
      socket.on('bid_error', () => {});
      async function autoBidLoop() {
        while (globalBidCount < TOTAL_BIDS) {
          if (!joined) { await sleep(200); continue; }
          if (globalBidCount % JWT_USERS.length === index) {
            const bidAmount = currentBid + increment;
            socket.emit('place_bid', { auctionId: AUCTION_ID, amount: bidAmount });
            globalBidCount++;
            await sleep(BID_DELAY_MS);
          } else {
            await sleep(100);
          }
        }
      }
      autoBidLoop();
    });
  }
  return Promise.all(JWT_USERS.map((jwt, i) => runUser(i, jwt)));
}

// Scenario 2: Bid before auction start (should get error)
async function scenarioBidBeforeStart({ JWT_USERS, AUCTION_ID, SERVER_URL, startBid = 100, minIncrement = 5 }) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, { auth: { token: JWT_USERS[0] } });
    let errorReceived = false;
    socket.on('connect', () => {
      socket.emit('join_auction', { auctionId: AUCTION_ID });
    });
    socket.on('auction_state', () => {
      socket.emit('place_bid', { auctionId: AUCTION_ID, amount: startBid + minIncrement });
    });
    socket.on('bid_error', (msg) => {
      if (msg && msg.toLowerCase().includes('not started')) errorReceived = true;
      socket.disconnect();
      resolve(errorReceived);
    });
    socket.on('auction_end', () => { socket.disconnect(); resolve(false); });
    setTimeout(() => { socket.disconnect(); resolve(false); }, 3000);
  });
}

// Scenario 3: Bid after auction end (should get error)
async function scenarioBidAfterEnd({ JWT_USERS, AUCTION_ID, SERVER_URL, startBid = 100, minIncrement = 5 }) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, { auth: { token: JWT_USERS[0] } });
    let errorReceived = false;
    socket.on('connect', () => {
      socket.emit('join_auction', { auctionId: AUCTION_ID });
    });
    socket.on('auction_end', () => {
      socket.emit('place_bid', { auctionId: AUCTION_ID, amount: startBid + minIncrement });
    });
    socket.on('bid_error', (msg) => {
      if (msg && msg.toLowerCase().includes('ended')) errorReceived = true;
      socket.disconnect();
      resolve(errorReceived);
    });
    setTimeout(() => { socket.disconnect(); resolve(false); }, 3000);
  });
}

// Scenario 4: Reserve price not met (bids below reserve)
async function scenarioReserveNotMet({ JWT_USERS, AUCTION_ID, SERVER_URL, reservePrice, startBid = 100, minIncrement = 5 }) {
  let globalBidCount = 0;
  let currentBid = startBid;
  let increment = minIncrement;
  const TOTAL_BIDS = 5;
  async function runUser(index, jwt) {
    return new Promise((resolve) => {
      const socket = io(SERVER_URL, { auth: { token: jwt } });
      let joined = false;
      socket.on('connect', () => {
        socket.emit('join_auction', { auctionId: AUCTION_ID });
      });
      socket.on('auction_state', (state) => {
        currentBid = Number(state.currentBid);
        increment = state.minIncrement || minIncrement;
        joined = true;
      });
      socket.on('auction_end', (data) => {
        socket.disconnect();
        resolve(data.status === 'reserve_not_met' || data.status === 'no_winner');
      });
      async function autoBidLoop() {
        while (globalBidCount < TOTAL_BIDS) {
          if (!joined) { await sleep(200); continue; }
          if (globalBidCount % JWT_USERS.length === index) {
            const bidAmount = Math.min(currentBid + increment, reservePrice - 1);
            socket.emit('place_bid', { auctionId: AUCTION_ID, amount: bidAmount });
            globalBidCount++;
            await sleep(500);
          } else {
            await sleep(100);
          }
        }
      }
      autoBidLoop();
    });
  }
  return Promise.all(JWT_USERS.map((jwt, i) => runUser(i, jwt)));
}

// Scenario 5: Simultaneous bids (race condition)
async function scenarioSimultaneousBids({ JWT_USERS, AUCTION_ID, SERVER_URL, startBid = 100, minIncrement = 5 }) {
  return Promise.all(JWT_USERS.map((jwt) => {
    return new Promise((resolve) => {
      const socket = io(SERVER_URL, { auth: { token: jwt } });
      socket.on('connect', () => {
        socket.emit('join_auction', { auctionId: AUCTION_ID });
      });
      socket.on('auction_state', (state) => {
        const bidAmount = Number(state.currentBid) + (state.minIncrement || minIncrement);
        // All users bid at the same time
        socket.emit('place_bid', { auctionId: AUCTION_ID, amount: bidAmount });
      });
      socket.on('auction_end', (data) => {
        socket.disconnect();
        resolve(data);
      });
      setTimeout(() => { socket.disconnect(); resolve(); }, 3000);
    });
  }));
}

// Scenario 6: User disconnects and rejoins
async function scenarioDisconnectRejoin({ JWT_USERS, AUCTION_ID, SERVER_URL, startBid = 100, minIncrement = 5 }) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, { auth: { token: JWT_USERS[0] } });
    let rejoined = false;
    socket.on('connect', () => {
      socket.emit('join_auction', { auctionId: AUCTION_ID });
    });
    socket.on('auction_state', (state) => {
      if (!rejoined) {
        socket.disconnect();
        setTimeout(() => {
          const socket2 = io(SERVER_URL, { auth: { token: JWT_USERS[0] } });
          socket2.on('connect', () => {
            socket2.emit('join_auction', { auctionId: AUCTION_ID });
          });
          socket2.on('auction_state', () => {
            socket2.emit('place_bid', { auctionId: AUCTION_ID, amount: startBid + minIncrement });
          });
          socket2.on('auction_end', (data) => {
            socket2.disconnect();
            resolve(data);
          });
        }, 500);
        rejoined = true;
      }
    });
    setTimeout(() => { socket.disconnect(); resolve(); }, 3000);
  });
}

// Scenario 7: No bids placed
async function scenarioNoBids({ JWT_USERS, AUCTION_ID, SERVER_URL }) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, { auth: { token: JWT_USERS[0] } });
    socket.on('connect', () => {
      socket.emit('join_auction', { auctionId: AUCTION_ID });
    });
    socket.on('auction_end', (data) => {
      socket.disconnect();
      resolve(data.status === 'no_bids');
    });
    setTimeout(() => { socket.disconnect(); resolve(false); }, 5000);
  });
}

module.exports = {
  scenarioNormalBidding,
  scenarioBidBeforeStart,
  scenarioBidAfterEnd,
  scenarioReserveNotMet,
  scenarioSimultaneousBids,
  scenarioDisconnectRejoin,
  scenarioNoBids
}; 
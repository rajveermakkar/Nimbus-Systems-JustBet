const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false //for azure postgres server , not requrred for localhost
  } : false,
  // Improved connection pool settings for Azure
  max: 20, // Reduced from 30 to leave more room for other connections
  idleTimeoutMillis: 10000, // Close idle clients after 10 seconds (reduced from 30)
  connectionTimeoutMillis: 5000, // Increased from 2 seconds to 5 seconds
  maxUses: 1000, // Reduced from 7500 to refresh connections more frequently
  allowExitOnIdle: true, // Allow the pool to exit when idle
});

// Helper to log pool stats
function logPoolStats(context = '') {
  console.log(`[POOL STATS${context ? ' - ' + context : ''}] total: ${pool.totalCount}, idle: ${pool.idleCount}, waiting: ${pool.waitingCount}`);
}

// Add error handling to prevent crashes
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't crash the app, just log the error
});

pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Database client error:', err);
    // Don't crash the app, just log the error
  });
});

// Add a wrapper function for database queries with retry logic
const queryWithRetry = async (text, params, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logPoolStats('queryWithRetry');
      return await pool.query(text, params);
    } catch (error) {
      lastError = error;
      console.error(`Database query attempt ${attempt} failed:`, error.message);
      
      // If it's a connection error and we have retries left, wait and try again
      if (attempt < maxRetries && (
        error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ETIMEDOUT' ||
        error.message.includes('Connection terminated') ||
        error.message.includes('connection timeout') ||
        error.message.includes('Connection terminated due to connection timeout')
      )) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5 seconds
        console.log(`Retrying database query in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If it's not a connection error or we're out of retries, throw the error
      throw error;
    }
  }
  
  throw lastError;
};

// Export the retry wrapper
module.exports.queryWithRetry = queryWithRetry;

// Add connection health check
const testConnection = async () => {
  try {
    logPoolStats('testConnection');
    const result = await queryWithRetry('SELECT 1 as test');
    console.log('Database connection test successful');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
};

// Periodic connection health check (every 5 minutes)
setInterval(async () => {
  await testConnection();
}, 5 * 60 * 1000);

// Export the test function
module.exports.testConnection = testConnection;

// Add new columns to users table if they don't exist
const updateUsersTable = async () => {
  try {
    // Check if is_verified column exists
    const isVerifiedCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_verified'
    `);

    if (isVerifiedCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN verification_token UUID,
        ADD COLUMN verification_token_expires TIMESTAMP WITH TIME ZONE
      `);
    }

    // Check for reset token columns
    const resetTokenCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'reset_token'
    `);

    if (resetTokenCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN reset_token UUID,
        ADD COLUMN reset_token_expires TIMESTAMP WITH TIME ZONE
      `);
    }

    // Check for business-related columns
    const businessColumnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'business_name'
    `);

    if (businessColumnsCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN business_name VARCHAR(255),
        ADD COLUMN business_description TEXT,
        ADD COLUMN business_address TEXT,
        ADD COLUMN business_phone VARCHAR(50),
        ADD COLUMN is_approved BOOLEAN DEFAULT false
      `);
    }
  } catch (error) {
    console.error('Error updating users table:', error);
    throw error;
  }
};

const createInitialAdmin = async () => {
  try {
    // Check if admin already exists
    const adminCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      ['admin@justbet.com']
    );

    if (adminCheck.rows.length === 0) {
      // Hash admin password
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // Create initial admin user
      await pool.query(
        `INSERT INTO users (first_name, last_name, email, password, role, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Admin', 'User', 'admin@justbet.com', hashedPassword, 'admin', true]
      );
      console.log('Created initial admin user');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
};

const initDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Create users table if it doesn't exist
      await pool.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'buyer',
          is_verified BOOLEAN NOT NULL DEFAULT false,
          verification_token UUID,
          verification_token_expires TIMESTAMP WITH TIME ZONE,
          reset_token UUID,
          reset_token_expires TIMESTAMP WITH TIME ZONE,
          business_name VARCHAR(255),
          business_description TEXT,
          business_address TEXT,
          business_phone VARCHAR(50),
          is_approved BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create function to update updated_at timestamp
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      // Create trigger to automatically update updated_at
      await pool.query(`
        DROP TRIGGER IF EXISTS update_users_updated_at ON users;
        CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);

      // Create initial admin user only if table was just created
      await createInitialAdmin();
    } else {
      // Update existing table with new columns
      await updateUsersTable();
    }

    // Always check and create admin user if it doesn't exist
    await createInitialAdmin();
    
    // Check if settled_auctions table exists
    const settledAuctionsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'settled_auctions'
      );
    `);

    if (!settledAuctionsTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE settled_auctions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          seller_id UUID NOT NULL REFERENCES users(id),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          image_url TEXT,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE NOT NULL,
          starting_price NUMERIC(12,2) NOT NULL,
          reserve_price NUMERIC(12,2),
          current_highest_bid NUMERIC(12,2),
          current_highest_bidder_id UUID REFERENCES users(id),
          bid_count INTEGER DEFAULT 0,
          min_bid_increment NUMERIC(12,2) DEFAULT 1,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          is_approved BOOLEAN DEFAULT false,
          type VARCHAR(20) NOT NULL DEFAULT 'settled',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create function to update updated_at timestamp for settled_auctions
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_settled_auctions_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS update_settled_auctions_updated_at ON settled_auctions;
        CREATE TRIGGER update_settled_auctions_updated_at
          BEFORE UPDATE ON settled_auctions
          FOR EACH ROW
          EXECUTE FUNCTION update_settled_auctions_updated_at_column();
      `);
    }
    // Always check and add/configure type column for settled_auctions (outside the if block)
    try {
      const typeColumnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'settled_auctions' AND column_name = 'type'
      `);
      if (typeColumnCheck.rows.length === 0) {
        await pool.query(`ALTER TABLE settled_auctions ADD COLUMN type VARCHAR(20)`);
        await pool.query(`UPDATE settled_auctions SET type = 'settled' WHERE type IS NULL`);
        await pool.query(`ALTER TABLE settled_auctions ALTER COLUMN type SET DEFAULT 'settled'`);
        await pool.query(`ALTER TABLE settled_auctions ALTER COLUMN type SET NOT NULL`);
      }
    } catch (err) {
      console.error('ERROR while checking/adding type column for settled_auctions:', err);
    }

    // Always check and add bidding columns to settled_auctions if they don't exist
    const biddingColumnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'settled_auctions' AND column_name = 'current_highest_bid'
    `);

    if (biddingColumnsCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE settled_auctions 
        ADD COLUMN current_highest_bid NUMERIC(12,2),
        ADD COLUMN current_highest_bidder_id UUID REFERENCES users(id),
        ADD COLUMN bid_count INTEGER DEFAULT 0,
        ADD COLUMN min_bid_increment NUMERIC(12,2) DEFAULT 1
      `);
    }

    // Check if live_auctions table exists
    const liveAuctionsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'live_auctions'
      );
    `);

    if (!liveAuctionsTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE live_auctions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          seller_id UUID NOT NULL REFERENCES users(id),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          image_url TEXT,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE NOT NULL,
          starting_price NUMERIC(12,2) NOT NULL,
          reserve_price NUMERIC(12,2),
          max_participants INTEGER NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          type VARCHAR(20) NOT NULL DEFAULT 'live',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create function to update updated_at timestamp for live_auctions
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_live_auctions_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS update_live_auctions_updated_at ON live_auctions;
        CREATE TRIGGER update_live_auctions_updated_at
          BEFORE UPDATE ON live_auctions
          FOR EACH ROW
          EXECUTE FUNCTION update_live_auctions_updated_at_column();
      `);

    }
    // Always check and add/configure type column for live_auctions (outside the if block)
    try {
      const liveTypeColumnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'live_auctions' AND column_name = 'type'
      `);
      if (liveTypeColumnCheck.rows.length === 0) {
        await pool.query(`ALTER TABLE live_auctions ADD COLUMN type VARCHAR(20)`);
        await pool.query(`UPDATE live_auctions SET type = 'live' WHERE type IS NULL`);
        await pool.query(`ALTER TABLE live_auctions ALTER COLUMN type SET DEFAULT 'live'`);
        await pool.query(`ALTER TABLE live_auctions ALTER COLUMN type SET NOT NULL`);
      }
    } catch (err) {
      console.error('ERROR while checking/adding type column for live_auctions:', err);
    }

    // Always check and add bidding columns to live_auctions if they don't exist
    const liveBiddingColumnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'live_auctions' AND column_name = 'current_highest_bid'
    `);

    if (liveBiddingColumnsCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE live_auctions 
        ADD COLUMN current_highest_bid NUMERIC(12,2),
        ADD COLUMN current_highest_bidder_id UUID REFERENCES users(id),
        ADD COLUMN bid_count INTEGER DEFAULT 0,
        ADD COLUMN min_bid_increment NUMERIC(12,2) DEFAULT 1
      `);
    }

    // Check if settled_auction_bids table exists (renamed from bids)
    const settledAuctionBidsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'settled_auction_bids'
      );
    `);

    if (!settledAuctionBidsTableCheck.rows[0].exists) {
      // Drop old bids table if it exists
      await pool.query('DROP TABLE IF EXISTS bids CASCADE');
      
      await pool.query(`
        CREATE TABLE settled_auction_bids (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          auction_id UUID NOT NULL REFERENCES settled_auctions(id),
          user_id UUID NOT NULL REFERENCES users(id),
          amount NUMERIC(12,2) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    // Check if refresh_tokens table exists
    const refreshTokensTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'refresh_tokens'
      );
    `);
    if (!refreshTokensTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    // Check if live_auction_bids table exists
    const liveAuctionBidsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'live_auction_bids'
      );
    `);

    if (!liveAuctionBidsTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE live_auction_bids (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          auction_id UUID NOT NULL REFERENCES live_auctions(id),
          user_id UUID NOT NULL REFERENCES users(id),
          amount NUMERIC(12,2) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    // Check if live_auction_results table exists
    const liveAuctionResultsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'live_auction_results'
      );
    `);

    if (!liveAuctionResultsTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE live_auction_results (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          auction_id UUID NOT NULL REFERENCES live_auctions(id),
          winner_id UUID REFERENCES users(id),
          final_bid NUMERIC(12,2),
          reserve_met BOOLEAN NOT NULL,
          status VARCHAR(20) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // Check if settled_auction_results table exists
    const settledAuctionResultsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'settled_auction_results'
      );
    `);

    if (!settledAuctionResultsTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE settled_auction_results (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          auction_id UUID NOT NULL REFERENCES settled_auctions(id),
          winner_id UUID REFERENCES users(id),
          final_bid NUMERIC(12,2),
          reserve_met BOOLEAN NOT NULL,
          status VARCHAR(20) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    // Add rejection fields to auction tables if they don't exist
    await updateAuctionTablesWithRejectionFields();
    
    console.log('Database initialization complete!');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Add rejection fields to auction tables if they don't exist
const updateAuctionTablesWithRejectionFields = async () => {
  try {
    // Check and add rejection fields to settled_auctions table
    const settledRejectionFieldsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'settled_auctions' AND column_name = 'rejection_reason'
    `);

    if (settledRejectionFieldsCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE settled_auctions 
        ADD COLUMN rejection_reason TEXT,
        ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN rejected_by UUID REFERENCES users(id)
      `);
      console.log('Added rejection fields to settled_auctions table');
    }

    // Check and add rejection fields to live_auctions table
    const liveRejectionFieldsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'live_auctions' AND column_name = 'rejection_reason'
    `);

    if (liveRejectionFieldsCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE live_auctions 
        ADD COLUMN rejection_reason TEXT,
        ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN rejected_by UUID REFERENCES users(id)
      `);
      console.log('Added rejection fields to live_auctions table');
    }
  } catch (error) {
    console.error('Error updating auction tables with rejection fields:', error);
    throw error;
  }
};

module.exports = {
  pool,
  initDatabase,
  testConnection,
  queryWithRetry,
  logPoolStats
};
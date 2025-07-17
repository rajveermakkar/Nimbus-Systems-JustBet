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

// Helper to log database changes
function logDbChange(message) {
  console.log(`[DB CHANGE] ${message}`);
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
      logDbChange('Adding verification columns to users table');
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
      logDbChange('Adding reset token columns to users table');
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
      logDbChange('Adding business columns to users table');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN business_name VARCHAR(255),
        ADD COLUMN business_description TEXT,
        ADD COLUMN business_address TEXT,
        ADD COLUMN business_phone VARCHAR(50),
        ADD COLUMN is_approved BOOLEAN DEFAULT false
      `);
    }


    // Check for Stripe customer ID column
    const stripeCustomerIdCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'stripe_customer_id'
    `);
    if (stripeCustomerIdCheck.rows.length === 0) {
      logDbChange('Adding stripe_customer_id column to users table');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN stripe_customer_id VARCHAR(255)
      `);
    }

    // Check for Stripe Connect account ID column
    const stripeAccountIdCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'stripe_account_id'
    `);
    if (stripeAccountIdCheck.rows.length === 0) {
      logDbChange('Adding stripe_account_id column to users table');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN stripe_account_id VARCHAR(255)
      `);
    }

    // Check and add ban-related columns individually
    const banColumns = [
      { name: 'ban_count', sql: 'ADD COLUMN ban_count INTEGER NOT NULL DEFAULT 0' },
      { name: 'is_banned', sql: 'ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT false' },
      { name: 'ban_reason', sql: 'ADD COLUMN ban_reason TEXT' },
      { name: 'ban_expiry', sql: 'ADD COLUMN ban_expiry TIMESTAMP WITH TIME ZONE' },
      { name: 'ban_history', sql: "ADD COLUMN ban_history JSONB DEFAULT '[]'::jsonb" }
    ];
    for (const col of banColumns) {
      const check = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = $1
      `, [col.name]);
      if (check.rows.length === 0) {
        logDbChange(`Adding column ${col.name} to users table`);
        await pool.query(`ALTER TABLE users ${col.sql}`);
      }
    }
    // Add status column if it doesn't exist
    const statusCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'status'
    `);
    if (statusCheck.rows.length === 0) {
      logDbChange('Adding status column to users table');
      await pool.query(`ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'`);
    }
    // Add deletionScheduledAt column if it doesn't exist (case-insensitive check)
    const deletionScheduledAtCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND lower(column_name) = 'deletionscheduledat'
    `);
    if (deletionScheduledAtCheck.rows.length === 0) {
      logDbChange('Adding deletionScheduledAt column to users table');
      await pool.query(`ALTER TABLE users ADD COLUMN deletionScheduledAt TIMESTAMP WITH TIME ZONE`);
    }
    // Add seller_rejection_reason column if it doesn't exist
    const sellerRejectionReasonCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'seller_rejection_reason'
    `);
    if (sellerRejectionReasonCheck.rows.length === 0) {
      logDbChange('Adding seller_rejection_reason column to users table');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN seller_rejection_reason TEXT
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
        `INSERT INTO users (first_name, last_name, email, password, role, is_verified, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['Admin', 'User', 'admin@justbet.com', hashedPassword, 'admin', true, 'active']
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
      logDbChange('Creating users table');
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
    
    // Backfill: create Stripe customers for users missing stripe_customer_id
    const usersWithoutCustomer = await pool.query(
      "SELECT id, email FROM users WHERE stripe_customer_id IS NULL"
    );
    if (usersWithoutCustomer.rows.length > 0) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      for (const user of usersWithoutCustomer.rows) {
        try {
          const customer = await stripe.customers.create({ email: user.email });
          await pool.query(
            "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
            [customer.id, user.id]
          );
          logDbChange(`Created Stripe customer for user ${user.email}`);
        } catch (err) {
          console.error(`Failed to create Stripe customer for user ${user.email}:`, err.message);
        }
      }
    }

    // Check if settled_auctions table exists
    const settledAuctionsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'settled_auctions'
      );
    `);

    if (!settledAuctionsTableCheck.rows[0].exists) {
      logDbChange('Creating settled_auctions table');
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
      logDbChange('Creating live_auctions table');
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

    // Always check and add unique constraint to live_auction_results if it doesn't exist
    try {
      const uniqueConstraintCheck = await pool.query(`
        SELECT COUNT(*) FROM information_schema.table_constraints
        WHERE table_name = 'live_auction_results' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name LIKE '%auction_id%'
      `);
      
      if (parseInt(uniqueConstraintCheck.rows[0].count) === 0) {
        // First, clean up any existing duplicates
        logDbChange('Cleaning up duplicate entries in live_auction_results');
        await pool.query(`
          DELETE FROM live_auction_results 
          WHERE id IN (
            SELECT id FROM (
              SELECT id, 
                     ROW_NUMBER() OVER (PARTITION BY auction_id ORDER BY created_at ASC) as rn
              FROM live_auction_results
            ) t 
            WHERE t.rn > 1
          )
        `);
        console.log('Cleaned up duplicate entries in live_auction_results');
        
        logDbChange('Adding unique constraint to live_auction_results.auction_id');
        await pool.query(`
          ALTER TABLE live_auction_results 
          ADD CONSTRAINT UQ_live_auction_results_auction_id 
          UNIQUE (auction_id)
        `);
        console.log('Added unique constraint to live_auction_results.auction_id');
      }
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.error('Error adding unique constraint to live_auction_results.auction_id:', err);
        throw err;
      }
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
    
    // Check if user_profiles table exists
    const userProfilesTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_profiles'
      );
    `);
    if (!userProfilesTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE user_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          avatar_url TEXT,
          phone VARCHAR(20),
          address TEXT,
          city VARCHAR(100),
          state VARCHAR(100),
          country VARCHAR(100),
          postal_code VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id)
        );
      `);
      // Create function to update updated_at timestamp for user_profiles
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_user_profiles_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
        CREATE TRIGGER update_user_profiles_updated_at
          BEFORE UPDATE ON user_profiles
          FOR EACH ROW
          EXECUTE FUNCTION update_user_profiles_updated_at_column();
      `);
      console.log('Created user_profiles table');
    } else {
      // Ensure user_id is unique in user_profiles
      const uniqueCheck = await pool.query(`
        SELECT COUNT(*) FROM information_schema.table_constraints
        WHERE table_name = 'user_profiles' AND constraint_type = 'UNIQUE';
      `);
      if (parseInt(uniqueCheck.rows[0].count) === 0) {
        try {
          await pool.query(`ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);`);
          console.log('Added UNIQUE constraint to user_profiles.user_id');
        } catch (err) {
          if (!err.message.includes('already exists')) {
            console.error('Error adding UNIQUE constraint to user_profiles.user_id:', err);
            throw err;
          }
        }
      }
    }
    
    // Check if orders table exists
    const ordersTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'orders'
      );
    `);
    if (!ordersTableCheck.rows[0].exists) {
      logDbChange('Creating orders table');
      await pool.query(`
        CREATE TABLE orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          auction_id UUID NOT NULL,
          winner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          shipping_address TEXT,
          shipping_city VARCHAR(100),
          shipping_state VARCHAR(100),
          shipping_postal_code VARCHAR(20),
          shipping_country VARCHAR(100),
          status VARCHAR(20) NOT NULL DEFAULT 'under_process',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(auction_id)
        );
      `);
      
      // Create function to validate auction_id exists in either settled_auctions or live_auctions
      await pool.query(`
        CREATE OR REPLACE FUNCTION validate_auction_id()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Check if auction_id exists in settled_auctions
          IF EXISTS (SELECT 1 FROM settled_auctions WHERE id = NEW.auction_id) THEN
            RETURN NEW;
          END IF;
          
          -- Check if auction_id exists in live_auctions
          IF EXISTS (SELECT 1 FROM live_auctions WHERE id = NEW.auction_id) THEN
            RETURN NEW;
          END IF;
          
          -- If not found in either table, raise error
          RAISE EXCEPTION 'Auction with id % does not exist in either settled_auctions or live_auctions', NEW.auction_id;
        END;
        $$ language 'plpgsql';
      `);
      
      // Create trigger to validate auction_id before insert/update
      await pool.query(`
        DROP TRIGGER IF EXISTS validate_auction_id_trigger ON orders;
        CREATE TRIGGER validate_auction_id_trigger
          BEFORE INSERT OR UPDATE ON orders
          FOR EACH ROW
          EXECUTE FUNCTION validate_auction_id();
      `);
      
      // Create function and trigger for updated_at
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_orders_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
        CREATE TRIGGER update_orders_updated_at
          BEFORE UPDATE ON orders
          FOR EACH ROW
          EXECUTE FUNCTION update_orders_updated_at_column();
      `);
      console.log('Created orders table');
    } else {
      // Ensure all columns and constraints exist
      const columns = [
        { name: 'shipping_address', type: 'TEXT' },
        { name: 'shipping_city', type: 'VARCHAR(100)' },
        { name: 'shipping_state', type: 'VARCHAR(100)' },
        { name: 'shipping_postal_code', type: 'VARCHAR(20)' },
        { name: 'shipping_country', type: 'VARCHAR(100)' },
        { name: 'status', type: "VARCHAR(20) DEFAULT 'under_process'" }
      ];
      for (const col of columns) {
        const colCheck = await pool.query(`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = $1
        `, [col.name]);
        if (colCheck.rows.length === 0) {
          await pool.query(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type}`);
          console.log(`Added column ${col.name} to orders table`);
        }
      }
      // Ensure UNIQUE constraint on auction_id
      const uniqueCheck = await pool.query(`
        SELECT COUNT(*) FROM information_schema.table_constraints
        WHERE table_name = 'orders' AND constraint_type = 'UNIQUE';
      `);
      if (parseInt(uniqueCheck.rows[0].count) === 0) {
        try {
          await pool.query(`ALTER TABLE orders ADD CONSTRAINT orders_auction_id_key UNIQUE (auction_id);`);
          console.log('Added UNIQUE constraint to orders.auction_id');
        } catch (err) {
          if (!err.message.includes('already exists')) {
            console.error('Error adding UNIQUE constraint to orders.auction_id:', err);
            throw err;
          }
        }
      }
      // Ensure updated_at trigger exists
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_orders_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
        CREATE TRIGGER update_orders_updated_at
          BEFORE UPDATE ON orders
          FOR EACH ROW
          EXECUTE FUNCTION update_orders_updated_at_column();
      `);
      console.log('Checked/updated orders table');
      
      // Update existing orders table to remove foreign key constraint and add validation trigger
      try {
        logDbChange('Updating orders table to support both auction types');
        // Drop the foreign key constraint if it exists
        await pool.query(`
          ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_auction_id_fkey;
        `);
        
        // Create or replace the validation function
        await pool.query(`
          CREATE OR REPLACE FUNCTION validate_auction_id()
          RETURNS TRIGGER AS $$
          BEGIN
            -- Check if auction_id exists in settled_auctions
            IF EXISTS (SELECT 1 FROM settled_auctions WHERE id = NEW.auction_id) THEN
              RETURN NEW;
            END IF;
            
            -- Check if auction_id exists in live_auctions
            IF EXISTS (SELECT 1 FROM live_auctions WHERE id = NEW.auction_id) THEN
              RETURN NEW;
            END IF;
            
            -- If not found in either table, raise error
            RAISE EXCEPTION 'Auction with id % does not exist in either settled_auctions or live_auctions', NEW.auction_id;
          END;
          $$ language 'plpgsql';
        `);
        
        // Create or replace the validation trigger
        await pool.query(`
          DROP TRIGGER IF EXISTS validate_auction_id_trigger ON orders;
          CREATE TRIGGER validate_auction_id_trigger
            BEFORE INSERT OR UPDATE ON orders
            FOR EACH ROW
            EXECUTE FUNCTION validate_auction_id();
        `);
        
        logDbChange('Orders table updated successfully to support both auction types');
        console.log('Updated orders table to support both auction types');
      } catch (err) {
        console.error('Error updating orders table constraints:', err);
      }
    }
    
    // Check if wallets table exists
    const walletsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'wallets'
      );
    `);
    if (!walletsTableCheck.rows[0].exists) {
      logDbChange('Creating wallets table');
      await pool.query(`
        CREATE TABLE wallets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          balance NUMERIC(12,2) NOT NULL DEFAULT 0,
          currency VARCHAR(10) NOT NULL DEFAULT 'CAD',
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      // Trigger for updated_at
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_wallets_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
        CREATE TRIGGER update_wallets_updated_at
          BEFORE UPDATE ON wallets
          FOR EACH ROW
          EXECUTE FUNCTION update_wallets_updated_at_column();
      `);
      console.log('Created wallets table');
    }

    // Check if wallet_transactions table exists
    const walletTxTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'wallet_transactions'
      );
    `);
    if (!walletTxTableCheck.rows[0].exists) {
      logDbChange('Creating wallet_transactions table');
      await pool.query(`
        CREATE TABLE wallet_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL, -- deposit, withdraw, bid, refund, etc.
          amount NUMERIC(12,2) NOT NULL,
          description TEXT,
          reference_id TEXT, -- changed from UUID to TEXT for Stripe compatibility
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      // Add unique constraint for deposits on (type, reference_id)
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'wallet_transactions_type_reference_id_unique'
          ) THEN
            ALTER TABLE wallet_transactions
            ADD CONSTRAINT wallet_transactions_type_reference_id_unique UNIQUE (type, reference_id);
          END IF;
        END$$;
      `);
      console.log('Created wallet_transactions table');
    } else {
      // Always check and update reference_id column to TEXT if needed
      const refIdTypeCheck = await pool.query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'wallet_transactions' AND column_name = 'reference_id'
      `);
      if (refIdTypeCheck.rows.length > 0 && refIdTypeCheck.rows[0].data_type !== 'text') {
        logDbChange('Altering wallet_transactions.reference_id to TEXT');
        await pool.query(`ALTER TABLE wallet_transactions ALTER COLUMN reference_id TYPE TEXT`);
        console.log('Altered wallet_transactions.reference_id to TEXT');
      }
    }
    
    // Check if auction_id column exists in wallet_transactions
    const auctionIdColCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'auction_id'
    `);
    if (auctionIdColCheck.rows.length === 0) {
      logDbChange('Adding auction_id column to wallet_transactions table');
      await pool.query(`ALTER TABLE wallet_transactions ADD COLUMN auction_id UUID`);
      console.log('Added auction_id column to wallet_transactions table');
    }
    
    // Remove duplicate platform_fee transactions for the same auction_id, keeping only the latest
    await pool.query(`
      DELETE FROM wallet_transactions wt1
      USING wallet_transactions wt2
      WHERE wt1.id < wt2.id
        AND wt1.type = 'platform_fee'
        AND wt2.type = 'platform_fee'
        AND wt1.auction_id = wt2.auction_id;
    `);
    // Add unique partial index for platform_fee on (auction_id)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'wallet_transactions_platform_fee_unique_idx'
        ) THEN
          CREATE UNIQUE INDEX wallet_transactions_platform_fee_unique_idx
          ON wallet_transactions(auction_id)
          WHERE type = 'platform_fee';
        END IF;
      END$$;
    `);
    
    // Check if stripe_connected_customers table exists
    const connectedCustomersTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'stripe_connected_customers'
      );
    `);
    if (!connectedCustomersTableCheck.rows[0].exists) {
      logDbChange('Creating stripe_connected_customers table');
      await pool.query(`
        CREATE TABLE stripe_connected_customers (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          connected_account_id VARCHAR(255) NOT NULL,
          customer_id VARCHAR(255) NOT NULL,
          UNIQUE (user_id, connected_account_id)
        );
      `);
      console.log('Created stripe_connected_customers table');
    }
    
    // Check if wallet_blocks table exists
    const walletBlocksTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'wallet_blocks'
      );
    `);
    if (!walletBlocksTableCheck.rows[0].exists) {
      logDbChange('Creating wallet_blocks table');
      await pool.query(`
        CREATE TABLE wallet_blocks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          auction_id UUID NOT NULL,
          amount NUMERIC(12,2) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, auction_id)
        );
      `);
      console.log('Created wallet_blocks table');
    } else {
      // Ensure UNIQUE(user_id, auction_id) exists
      const uniqueCheck = await pool.query(`
        SELECT COUNT(*) FROM information_schema.table_constraints
        WHERE table_name = 'wallet_blocks' AND constraint_type = 'UNIQUE';
      `);
      if (parseInt(uniqueCheck.rows[0].count) === 0) {
        try {
          await pool.query(`ALTER TABLE wallet_blocks ADD CONSTRAINT wallet_blocks_user_auction_unique UNIQUE (user_id, auction_id);`);
          console.log('Added UNIQUE constraint to wallet_blocks (user_id, auction_id)');
        } catch (err) {
          if (!err.message.includes('already exists')) {
            console.error('Error adding UNIQUE constraint to wallet_blocks:', err);
            throw err;
          }
        }
      }
    }

    // Check if order_documents table exists
    const orderDocumentsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'order_documents'
      );
    `);
    if (!orderDocumentsTableCheck.rows[0].exists) {
      logDbChange('Creating order_documents table');
      await pool.query(`
        CREATE TABLE order_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL, -- 'invoice', 'certificate', etc.
          url TEXT NOT NULL,
          wallet_txn_id UUID REFERENCES wallet_transactions(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      // Trigger for updated_at
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_order_documents_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS update_order_documents_updated_at ON order_documents;
        CREATE TRIGGER update_order_documents_updated_at
          BEFORE UPDATE ON order_documents
          FOR EACH ROW
          EXECUTE FUNCTION update_order_documents_updated_at_column();
      `);
      console.log('Created order_documents table');
    }

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
  logDbChange
};
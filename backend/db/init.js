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
  } : false
});

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
      console.log('Added verification columns to users table');
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
      console.log('Added reset token columns to users table');
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
      console.log('Added business-related columns to users table');
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
      console.log('Users table created with all columns');

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
      console.log('Created update_updated_at function');

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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('settled_auctions table created');

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
      console.log('Added bidding columns to settled_auctions table');
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('live_auctions table created');

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
      console.log('settled_auction_bids table created');
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
      console.log('refresh_tokens table created');
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
      console.log('live_auction_bids table created');
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
      console.log('live_auction_results table created');
    }
    
    console.log('Database initialization complete!');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Database connection test successful');
    client.release();
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

module.exports = {
  pool,
  initDatabase,
  testConnection
};
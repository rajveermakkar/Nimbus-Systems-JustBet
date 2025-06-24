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
    
    // Check if auctions table exists
    const auctionTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'auctions'
      );
    `);

    if (!auctionTableCheck.rows[0].exists) {
      // Create auctions table if it doesn't exist
      await pool.query(`
        CREATE TABLE auctions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Auctions table created');
    }

    // Check if settled_auctions table exists
    const settledAuctionsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'settled_auctions'
      );
    `);

    if (!settledAuctionsTableCheck.rows[0].exists) {
      // Create settled_auctions table if it doesn't exist
      await pool.query(`
        CREATE TABLE settled_auctions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          seller_id UUID NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          image_url TEXT,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE NOT NULL,
          starting_price NUMERIC(12,2) NOT NULL,
          reserve_price NUMERIC(12,2),
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          is_approved BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('SettledAuctions table created');
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
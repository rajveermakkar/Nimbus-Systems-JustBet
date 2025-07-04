const { pool, queryWithRetry } = require('../db/init');

// Database monitoring utility
const dbMonitor = {
  // Get current pool statistics
  getPoolStats() {
    return {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
      active: pool.totalCount - pool.idleCount
    };
  },

  // Test database connectivity
  async testConnection() {
    try {
      const start = Date.now();
      await queryWithRetry('SELECT 1 as test');
      const duration = Date.now() - start;
      
      return {
        success: true,
        duration: `${duration}ms`,
        stats: this.getPoolStats()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stats: this.getPoolStats()
      };
    }
  },

  // Get database performance metrics
  async getPerformanceMetrics() {
    try {
      // Get current timestamp
      const now = new Date();
      
      // Test query performance
      const start = Date.now();
      await queryWithRetry('SELECT NOW() as current_time');
      const queryTime = Date.now() - start;
      
      return {
        timestamp: now.toISOString(),
        queryPerformance: `${queryTime}ms`,
        poolStats: this.getPoolStats(),
        recommendations: this.getRecommendations()
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        error: error.message,
        poolStats: this.getPoolStats(),
        recommendations: ['Check database connectivity', 'Verify connection pool settings']
      };
    }
  },

  // Get recommendations based on current stats
  getRecommendations() {
    const stats = this.getPoolStats();
    const recommendations = [];
    
    if (stats.waiting > 0) {
      recommendations.push('Consider increasing max pool size or optimizing queries');
    }
    
    if (stats.active > stats.total * 0.8) {
      recommendations.push('High connection usage - monitor for connection exhaustion');
    }
    
    if (stats.idle === 0 && stats.active > 0) {
      recommendations.push('No idle connections - consider connection reuse optimization');
    }
    
    return recommendations.length > 0 ? recommendations : ['Database connections healthy'];
  },

  // Log current status
  logStatus() {
    const stats = this.getPoolStats();
    console.log('=== Database Status ===');
    console.log(`Total connections: ${stats.total}`);
    console.log(`Active connections: ${stats.active}`);
    console.log(`Idle connections: ${stats.idle}`);
    console.log(`Waiting connections: ${stats.waiting}`);
    console.log('=======================');
  }
};

module.exports = dbMonitor; 
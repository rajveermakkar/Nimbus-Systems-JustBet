import apiService from './apiService';

class WalletService {
  async getBalance() {
    return apiService.get('/api/wallet/balance');
  }
  async getTransactions() {
    return apiService.get('/api/wallet/transactions');
  }
  async createWallet() {
    return apiService.post('/api/wallet/create', {});
  }
  async createDepositIntent(amount) {
    return apiService.post('/api/wallet/deposit/intent', { amount });
  }
  async createWithdrawal(amount) {
    return apiService.post('/api/wallet/withdraw', { amount });
  }
  // Payment method management
  async getPaymentMethods() {
    return apiService.get('/api/wallet/payment-methods');
  }
  async createSetupIntent() {
    return apiService.post('/api/wallet/payment-methods/setup-intent', {});
  }
  async removePaymentMethod(id) {
    return apiService.delete(`/api/wallet/payment-methods/${id}`);
  }
}

export const walletService = new WalletService();
export default walletService; 
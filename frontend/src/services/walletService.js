import apiService from './apiService';

class WalletService {
  async getBalance() {
    return apiService.get('/api/wallet/balance');
  }
  async getTransactions(page = 1, limit = 10) {
    return apiService.get(`/api/wallet/transactions?page=${page}&limit=${limit}`);
  }
  async createWallet() {
    return apiService.post('/api/wallet/create', {});
  }
  async createDepositIntent(amount, saveCard, paymentMethodId) {
    const body = { amount, saveCard };
    if (paymentMethodId) body.paymentMethodId = paymentMethodId;
    return apiService.post('/api/wallet/deposit/intent', body);
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
  async getMostRecentDepositCard() {
    return apiService.get('/api/wallet/deposit-card');
  }
  async getMonthlySummary() {
    return apiService.get('/api/wallet/monthly-summary');
  }
}

export const walletService = new WalletService();
export default walletService; 
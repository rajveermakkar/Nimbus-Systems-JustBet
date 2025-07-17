import React from "react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-r from-[#000000] to-[#2A2A72] py-12 px-2">
      <div className="relative w-full max-w-2xl mx-auto">
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
          background: 'linear-gradient(90deg, #a084e8 0%, #6a11cb 100%)',
          filter: 'blur(8px)',
          opacity: 0.4,
          zIndex: 0
        }}></div>
        <div className="relative z-10 bg-gradient-to-r from-[#000000]/90 to-[#2A2A72]/90 border-2 border-purple-400/60 rounded-2xl p-8 md:p-12 text-white shadow-xl backdrop-blur-md">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 text-purple-200 text-center">Terms of Service</h1>
          <div className="text-gray-200 space-y-6 text-base md:text-lg max-w-2xl mx-auto">
            <p>Welcome to JustBet! By using our platform, you agree to the following terms and conditions. Please read them carefully.</p>
            <h2 className="text-xl font-semibold text-purple-300 mt-6 mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using JustBet, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree, please do not use our platform.</p>
            <h2 className="text-xl font-semibold text-purple-300 mt-6 mb-2">2. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
            <h2 className="text-xl font-semibold text-purple-300 mt-6 mb-2">3. Auctions and Payments</h2>
            <p>All bids placed in auctions are binding. If you win an auction, the winning amount is automatically deducted from your wallet—no manual payment is required. Please ensure you have sufficient funds in your wallet before participating in auctions.</p>
            <h2 className="text-xl font-semibold text-purple-300 mt-6 mb-2">4. Wallet Deposits and Withdrawals</h2>
            <p>You may deposit funds into your wallet and withdraw them at any time, subject to our platform’s policies and any applicable limits. Withdrawals are processed securely to your original payment method. Seller and admin earnings can be withdrawn from their respective dashboards.</p>
            <h2 className="text-xl font-semibold text-purple-300 mt-6 mb-2">5. Prohibited Conduct</h2>
            <p>You agree not to use JustBet for any unlawful purpose or in violation of any applicable laws. Harassment, abuse, cheating, or fraudulent activity will not be tolerated and may result in account suspension or termination.</p>
            <h2 className="text-xl font-semibold text-purple-300 mt-6 mb-2">6. Changes to Terms</h2>
            <p>We reserve the right to update these Terms of Service at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
            <h2 className="text-xl font-semibold text-purple-300 mt-6 mb-2">7. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at support@justbet.com.</p>
            <p className="text-xs text-gray-400 mt-8">Last updated: July 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
} 
import React, { useState, useEffect } from 'react';

function SellerStatus({ user, onCheckStatus, isLoading }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (user.role === 'seller') {
      setStatus({
        role: user.role,
        isApproved: user.isApproved || user.is_approved || false,
        status: (user.isApproved || user.is_approved) ? 'approved' : 'pending',
        businessDetails: user.businessDetails || null
      });
    }
  }, [user]);

  async function handleCheckStatus() {
    try {
      const result = await onCheckStatus();
      if (result) {
        setStatus({
          role: result.role,
          isApproved: result.isApproved,
          status: result.status,
          businessDetails: result.businessDetails
        });
      }
    } catch (error) {
      console.error('Error checking status:', error);
      // Don't throw error, just log it
    }
  }

  function getStatusColor(status) {
    if (status === 'approved') {
      return 'text-green-600 bg-green-100 border-green-200';
    } else if (status === 'pending') {
      return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    } else {
      return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  }

  function getStatusIcon(status) {
    if (status === 'approved') {
      return 'fas fa-check-circle';
    } else if (status === 'pending') {
      return 'fas fa-clock';
    } else {
      return 'fas fa-info-circle';
    }
  }

  function getStatusMessage(status) {
    if (status === 'approved') {
      return 'Your seller account has been approved!';
    } else if (status === 'pending') {
      return 'Your seller request is under review';
    } else {
      return 'You have not submitted a seller request yet';
    }
  }

  if (!status && user.role !== 'seller') {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-600 to-blue-600 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <i className="fas fa-store text-white text-lg"></i>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Seller Status</h2>
                <p className="text-green-100 text-sm">Check your seller account status</p>
              </div>
            </div>
            <button
              onClick={handleCheckStatus}
              disabled={isLoading}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-sync-alt"></i>
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {status ? (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${getStatusColor(status.status)}`}>
                <i className={`${getStatusIcon(status.status)}`}></i>
                <span className="font-medium capitalize">{status.status}</span>
              </div>

              {/* Status Message */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-800 font-medium">{getStatusMessage(status.status)}</p>
                {status.status === 'pending' && (
                  <p className="text-gray-600 text-sm mt-1">
                    Our admin team will review your application within 1-3 business days.
                  </p>
                )}
              </div>

              {/* Business Details */}
              {status.businessDetails && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <i className="fas fa-building text-blue-600"></i>
                    Business Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 font-medium">Business Name</p>
                      <p className="text-gray-800">{status.businessDetails.businessName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium">Phone</p>
                      <p className="text-gray-800">{status.businessDetails.businessPhone}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-gray-600 font-medium">Description</p>
                      <p className="text-gray-800">{status.businessDetails.businessDescription}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-gray-600 font-medium">Address</p>
                      <p className="text-gray-800">{status.businessDetails.businessAddress}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Specific Messages */}
              {status.status === 'approved' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-check-circle text-green-600 text-xl"></i>
                    <div>
                      <p className="font-medium text-green-800">Congratulations!</p>
                      <p className="text-green-700 text-sm">
                        You can now start selling on our platform. Access your seller dashboard to manage your listings.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {status.status === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-clock text-yellow-600 text-xl"></i>
                    <div>
                      <p className="font-medium text-yellow-800">Request Under Review</p>
                      <p className="text-yellow-700 text-sm">
                        We'll notify you via email once your application has been reviewed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-4"></i>
              <p className="text-gray-600">Loading status...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SellerStatus; 
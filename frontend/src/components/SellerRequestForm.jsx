import React, { useState } from 'react';

function SellerRequestForm({ onSubmit, onCancel, isLoading }) {
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [errors, setErrors] = useState({});

  function handleSubmit(e) {
    e.preventDefault();
    
    // Simple validation
    const newErrors = {};
    
    if (!businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    
    if (!businessDescription.trim()) {
      newErrors.businessDescription = 'Business description is required';
    }
    
    if (!businessAddress.trim()) {
      newErrors.businessAddress = 'Business address is required';
    }
    
    if (!businessPhone.trim()) {
      newErrors.businessPhone = 'Business phone is required';
    }

    setErrors(newErrors);

    // If no errors, submit the form
    if (Object.keys(newErrors).length === 0) {
      const formData = {
        businessName: businessName.trim(),
        businessDescription: businessDescription.trim(),
        businessAddress: businessAddress.trim(),
        businessPhone: businessPhone.trim()
      };
      onSubmit(formData);
    }
  }

  function clearError(fieldName) {
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <i className="fas fa-store text-white text-lg"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Become a Seller</h2>
              <p className="text-blue-100 text-sm">Submit your business information for approval</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Name *
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                clearError('businessName');
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.businessName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your business name"
            />
            {errors.businessName && (
              <p className="mt-1 text-sm text-red-600">{errors.businessName}</p>
            )}
          </div>

          {/* Business Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Description *
            </label>
            <textarea
              value={businessDescription}
              onChange={(e) => {
                setBusinessDescription(e.target.value);
                clearError('businessDescription');
              }}
              rows="4"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                errors.businessDescription ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe what your business does"
            />
            {errors.businessDescription && (
              <p className="mt-1 text-sm text-red-600">{errors.businessDescription}</p>
            )}
          </div>

          {/* Business Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Address *
            </label>
            <textarea
              value={businessAddress}
              onChange={(e) => {
                setBusinessAddress(e.target.value);
                clearError('businessAddress');
              }}
              rows="3"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                errors.businessAddress ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your business address"
            />
            {errors.businessAddress && (
              <p className="mt-1 text-sm text-red-600">{errors.businessAddress}</p>
            )}
          </div>

          {/* Business Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Phone Number *
            </label>
            <input
              type="tel"
              value={businessPhone}
              onChange={(e) => {
                setBusinessPhone(e.target.value);
                clearError('businessPhone');
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.businessPhone ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your business phone number"
            />
            {errors.businessPhone && (
              <p className="mt-1 text-sm text-red-600">{errors.businessPhone}</p>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="fas fa-info-circle text-blue-600 mt-0.5"></i>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">What happens next?</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• Your request will be reviewed by our admin team</li>
                  <li>• You'll receive an email notification once approved</li>
                  <li>• You can check your approval status anytime</li>
                  <li>• This process typically takes 1-3 business days</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Submitting...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane"></i>
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SellerRequestForm; 
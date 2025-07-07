// Utility to get consistent status badge classes
export function getStatusBadgeClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return 'bg-[#ffc300] text-black';
    case 'approved':
      return 'bg-[#99d98c] text-black';
    case 'closed':
      return 'bg-[#5e548e] text-white';
    case 'rejected':
      return 'bg-[#dd2d4a] text-white';
    default:
      return 'bg-blue-900/60 text-blue-200';
  }
} 
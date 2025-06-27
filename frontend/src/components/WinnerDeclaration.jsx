import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { UserContext } from '../context/UserContext';

function WinnerDeclaration({ winnerAnnouncement, onClose, auctionType = 'live' }) {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);

  console.log('WinnerDeclaration: Rendering with props:', {
    winnerAnnouncement,
    auctionType,
    hasWinner: !!winnerAnnouncement?.winner
  });

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  if (!winnerAnnouncement) {
    console.log('WinnerDeclaration: No winner announcement, returning null');
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6 max-w-md mx-4 text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-xl font-bold text-white mb-2">Auction Ended!</h2>
        
        {winnerAnnouncement.winner ? (
          <div>
            <p className="text-green-400 font-semibold mb-2">
              Winner: {winnerAnnouncement.winner.first_name && winnerAnnouncement.winner.last_name
                ? `${winnerAnnouncement.winner.first_name} ${winnerAnnouncement.winner.last_name}`
                : winnerAnnouncement.winner.email
                  ? winnerAnnouncement.winner.email
                  : winnerAnnouncement.winner.id
                    ? `User ${winnerAnnouncement.winner.id?.slice(0, 8)}`
                    : 'Unknown'}
            </p>
            <p className="text-white mb-4">
              Final Bid: <span className="text-green-400 font-bold">{formatPrice(winnerAnnouncement.winner.amount)}</span>
            </p>
            {winnerAnnouncement.winner.id === user?.id && (
              <div className="bg-green-900/20 border border-green-500/30 rounded p-3 mb-4">
                <p className="text-green-400 font-semibold">🎉 Congratulations! You won this auction!</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-300 mb-4">
            {winnerAnnouncement.status === 'reserve_not_met' ? 'Reserve price was not met' : 'No bids were placed'}
          </p>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              navigate(auctionType === 'live' ? '/live-auctions' : '/auctions');
            }}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
          >
            View All {auctionType === 'live' ? 'Live' : ''} Auctions
          </button>
        </div>
      </div>
    </div>
  );
}

export default WinnerDeclaration; 
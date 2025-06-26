function getAuctionCountdown(auction) {
  const now = new Date();
  const start = new Date(auction.start_time);
  const end = new Date(auction.end_time);

  if (now < start) {
    return {
      status: 'pre',
      countdown: Math.max(0, Math.floor((start - now) / 1000)), // seconds until start
    };
  } else if (now >= start && now < end) {
    return {
      status: 'ongoing',
      countdown: Math.max(0, Math.floor((end - now) / 1000)), // seconds until end
    };
  } else {
    return {
      status: 'ended',
      countdown: 0,
    };
  }
}

module.exports = { getAuctionCountdown }; 
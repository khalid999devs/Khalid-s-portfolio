const notFound = (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(404).json({
    succeed: false,
    msg: 'Route does not exist',
  });
};

module.exports = notFound;

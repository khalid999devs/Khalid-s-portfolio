const { verify } = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors');
const env = require('../config/env');

const adminValidate = (req, res, next) => {
  const { token } = req.signedCookies;
  if (!token) {
    throw new UnauthorizedError('admin not logged in');
  }

  let validAdmin;
  try {
    // Pinning the algorithm stops a token from selecting its own verification
    // scheme, which is the class of bug the jsonwebtoken 8 advisory covers.
    validAdmin = verify(token, env.adminSecret, { algorithms: ['HS256'] });
  } catch {
    // `verify` throws on an expired or tampered token. That throw used to
    // escape unhandled: the error handler saw no statusCode and answered 500
    // with the library's own text, so a simply expired session reported
    // `{"msg":"jwt expired"}` as a server error. Treat it as what it is.
    throw new UnauthorizedError('admin not logged in');
  }

  if (!validAdmin || validAdmin.role !== 'admin') {
    throw new UnauthorizedError(
      'you do not have permission to access this route'
    );
  }

  req.admin = validAdmin;
  next();
};

module.exports = adminValidate;

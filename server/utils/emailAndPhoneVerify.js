const deleteFile = require('./deleteFile');
const { toStoredUploadPath } = require('./uploadPaths');
const { UnauthenticatedError } = require('../errors');

const emailVerify = async (req, model, emailP) => {
  const targetClient = await model.findOne(
    { attributes: ['email'] },
    {
      where: {
        email: emailP,
      },
    }
  )

  if (targetClient) {
    if (req.file?.path) {
      deleteFile(toStoredUploadPath(req.file.path));
    }
    throw new UnauthenticatedError(
      `Already registered with ${targetClient.email}`
    );
  }
};

module.exports = emailVerify;

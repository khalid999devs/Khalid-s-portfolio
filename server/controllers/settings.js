const { settings } = require('../models');
const { BadRequestError } = require('../errors');
const path = require('path');

const addSettings = async (req, res) => {
  let data = req.body;
  if (!data.technologies)
    throw new BadRequestError('Please add technologies data of yours');

  data.technologies = JSON.stringify(data.technologies);
  let result = await settings.create(data);

  result.dataValues.technologies = JSON.parse(result.dataValues.technologies);

  res.json({
    succeed: true,
    msg: 'Successfully added settings',
    settings: result,
  });
};

const editSettings = async (req, res) => {
  let data = req.body;
  const id = req.params.id;
  data.technologies = JSON.stringify(data.technologies);

  await settings.update({ ...data }, { where: { id } });

  res.json({
    succeed: true,
    msg: 'Successfully updated settings',
  });
};

const getSettings = async (req, res) => {
  let result = await settings.findAll();
  let settingsRes = undefined;

  if (result[0]) {
    settingsRes = result[0];
    settingsRes.dataValues.technologies = JSON.parse(
      settingsRes.dataValues.technologies
    );
  }

  res.json({
    succeed: true,
    result: settingsRes,
    msg: 'Successfully fetched settings!',
  });
};

const downloadResume = async (req, res, next) => {
  const filePath = path.join(
    __dirname,
    '../uploads/assets/Resume_Khalid_Ahammed.pdf'
  );

  res.download(filePath, 'Resume_Khalid_Ahammed.pdf', (err) => {
    if (!err) return;

    // This callback runs asynchronously, outside the request chain whose
    // rejections Express forwards. Throwing here does not produce a 400 —
    // it escapes Express entirely and terminates the process, so a single
    // unauthenticated GET took the whole API down whenever this file was
    // missing. Hand the error to Express instead.
    if (res.headersSent) {
      // The response already started streaming, so no status can be sent.
      // Abort the connection rather than leaving the client hanging.
      res.destroy(err);
      return;
    }

    next(new BadRequestError('Failed to download resume'));
  });
};

module.exports = { addSettings, editSettings, getSettings, downloadResume };

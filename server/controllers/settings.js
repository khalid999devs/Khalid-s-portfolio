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

const downloadResume = async (req, res) => {
  const filePath = path.join(
    __dirname,
    '../uploads/assets/Resume_Khalid_Ahammed.pdf'
  );
  res.download(filePath, 'Resume_Khalid_Ahammed.pdf', (err) => {
    if (err) {
      throw new BadRequestError('Failed to download resume');
    }
  });
};

module.exports = { addSettings, editSettings, getSettings, downloadResume };

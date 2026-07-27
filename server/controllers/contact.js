const { BadRequestError } = require('../errors');
const mailer = require('../utils/sendMail');
const sendSMS = require('../utils/sendSMS');

const sendEmailToClient = async (req, res) => {
  const mode = req.params.mode;
  const { text, subject, email, name } = req.body;
  if (!text) {
    throw new Error(`you didn't give any reply`);
  }

  try {
    const response = await mailer(
      {
        info: {
          subject: subject,
          body: text,
        },
        client: {
          fullName: name,
          email: email,
        },
      },
      mode || 'custom'
    );
    res.json({ succeed: true, msg: 'email sent', text });
  } catch (error) {
    throw new BadRequestError(error);
  }
};

const smsToClient = async (req, res) => {
  const mode = req.params.mode;
  const { phone, message } = req.body;
  if (!phone || !message) {
    throw new BadRequestError('Fields must not be empty');
  }

  try {
    const response = await sendSMS(phone, message);
    if (response.type == '1101') res.json({ succeed: true, msg: response.msg });
    else res.json({ succeed: false, msg: response.msg });
  } catch (error) {
    throw new BadRequestError(error);
  }
};

module.exports = { sendEmailToClient, smsToClient };

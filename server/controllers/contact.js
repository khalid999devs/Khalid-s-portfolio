const mailer = require('../utils/sendMail');
const sendSMS = require('../utils/sendSMS');
const {
  normalizeEmailDeliveryRequest,
  normalizeSmsDeliveryRequest,
} = require('../utils/contactValidation');

const sendEmailToClient = async (req, res) => {
  const mode = req.params.mode || 'custom';
  const delivery = normalizeEmailDeliveryRequest(mode, req.body);

  await mailer(
    {
      info: {
        subject: delivery.subject,
        body: delivery.text,
      },
      client: {
        fullName: delivery.name || '',
        email: delivery.email,
      },
    },
    mode
  );

  res.json({ succeed: true, msg: 'Email accepted for delivery.' });
};

const smsToClient = async (req, res) => {
  const { phone, message } = normalizeSmsDeliveryRequest(
    req.params.mode,
    req.body
  );

  const response = await sendSMS(phone, message);
  if (response.type === '1101') {
    res.json({ succeed: true, msg: response.msg });
    return;
  }

  res.status(400).json({ succeed: false, msg: response.msg });
};

module.exports = {
  sendEmailToClient,
  smsToClient,
};

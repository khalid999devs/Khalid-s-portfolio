const { Contact } = require('../models');
const { BadRequestError } = require('../errors');
const mailer = require('../utils/sendMail');
const sendSMS = require('../utils/sendSMS');
const {
  normalizeContactMessage,
  normalizeEmailDeliveryRequest,
  normalizeSmsDeliveryRequest,
  parseMessageListQuery,
} = require('../utils/contactValidation');

const sendMessage = async (req, res) => {
  const contact = normalizeContactMessage(req.body);
  await Contact.create(contact);
  res.json({ succeed: true, msg: 'Thank you. We have got your message' });
};

const getAllMessage = async (req, res) => {
  const { page, limit, offset } = parseMessageListQuery(req.query);
  const { count, rows } = await Contact.findAndCountAll({
    order: [['id', 'DESC']],
    limit,
    offset,
  });

  res.json({
    succeed: true,
    result: rows,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  });
};

const sendEmailToClient = async (req, res) => {
  const mode = req.params.mode || 'custom';
  const delivery = normalizeEmailDeliveryRequest(mode, req.body);
  let contact;

  if (mode === 'contact') {
    contact = await Contact.findByPk(delivery.contactId);
    if (!contact) {
      throw new BadRequestError('The requested contact does not exist.');
    }
  }

  await mailer(
    {
      info: {
        subject: delivery.subject,
        body: delivery.text,
      },
      client: {
        fullName: contact?.name || delivery.name || '',
        email: contact ? contact.email : delivery.email,
      },
    },
    mode
  );

  if (mode === 'contact') {
    await contact.update({ replied: 1, replyMsg: delivery.text });
  }

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
  sendMessage,
  getAllMessage,
  sendEmailToClient,
  smsToClient,
};

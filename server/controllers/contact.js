const { Contact } = require('../models');
const { BadRequestError } = require('../errors');
const mailer = require('../utils/sendMail');
const sendSMS = require('../utils/sendSMS');
const {
  normalizeContactMessage,
  normalizeMessage,
  parseMessageListQuery,
} = require('../utils/contactValidation');

const allowedEmailModes = new Set(['contact', 'custom', 'newsletter']);

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
  const { text, subject, email, name, id } = req.body;
  let contact;

  if (!allowedEmailModes.has(mode)) {
    throw new BadRequestError('Unsupported email delivery mode.');
  }

  const normalizedText = normalizeMessage(text);

  if (mode === 'contact') {
    let contactId = Number.NaN;
    if (typeof id === 'number' && Number.isSafeInteger(id)) {
      contactId = id;
    } else if (typeof id === 'string' && /^[1-9]\d*$/.test(id)) {
      contactId = Number(id);
    }

    if (!Number.isSafeInteger(contactId) || contactId < 1) {
      throw new BadRequestError('A valid contact ID is required.');
    }

    contact = await Contact.findByPk(contactId);
    if (!contact) {
      throw new BadRequestError('The requested contact does not exist.');
    }
  }

  await mailer(
    {
      info: {
        subject,
        body: normalizedText,
      },
      client: {
        fullName: contact?.name || (typeof name === 'string' ? name : ''),
        email: contact ? contact.email : email,
      },
    },
    mode
  );

  if (mode === 'contact') {
    await contact.update({ replied: 1, replyMsg: normalizedText });
  }

  res.json({ succeed: true, msg: 'Email accepted for delivery.' });
};

const smsToClient = async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    throw new BadRequestError('Fields must not be empty');
  }

  const response = await sendSMS(phone, message);
  if (response.type === '1101') {
    res.json({ succeed: true, msg: response.msg });
    return;
  }

  res.json({ succeed: false, msg: response.msg });
};

module.exports = {
  sendMessage,
  getAllMessage,
  sendEmailToClient,
  smsToClient,
};

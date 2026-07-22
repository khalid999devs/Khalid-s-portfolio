const { BadRequestError } = require('../errors');
const { emailResExp, mobileResExp } = require('./regex');

const CONTACT_FIELDS = new Set([
  'name',
  'phone',
  'email',
  'address',
  'message',
]);
const MESSAGE_QUERY_FIELDS = new Set(['page', 'limit']);
const CONTACT_REPLY_FIELDS = new Set(['id', 'text']);
const CUSTOM_EMAIL_FIELDS = new Set(['email', 'name', 'subject', 'text']);
const CUSTOM_SMS_FIELDS = new Set(['message', 'phone']);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MESSAGE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const assertObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestError(`${label} must be an object.`);
  }
};

const rejectUnknownFields = (value, allowedFields) => {
  const unknownField = Object.keys(value).find(
    (field) => !allowedFields.has(field)
  );

  if (unknownField) {
    throw new BadRequestError(`Unexpected field: ${unknownField}`);
  }
};

const normalizeSingleLine = (value, field, { max, min = 0, optional = false }) => {
  if (optional && (value === undefined || value === null || value === '')) {
    return null;
  }

  if (typeof value !== 'string' || CONTROL_CHARACTERS.test(value)) {
    throw new BadRequestError(`${field} must be valid text.`);
  }

  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (optional && !normalized) return null;

  if (normalized.length < min || normalized.length > max) {
    throw new BadRequestError(
      `${field} must be between ${min || 1} and ${max} characters.`
    );
  }

  return normalized;
};

const normalizeEmail = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || CONTROL_CHARACTERS.test(value)) {
    throw new BadRequestError('email must be a valid email address.');
  }

  const normalized = value.trim();
  if (!normalized) return null;

  if (
    normalized.length > 254 ||
    !emailResExp.test(normalized)
  ) {
    throw new BadRequestError('email must be a valid email address.');
  }

  const separator = normalized.lastIndexOf('@');
  return `${normalized.slice(0, separator)}${normalized
    .slice(separator)
    .toLowerCase()}`;
};

const normalizePhone = (value) => {
  if (typeof value !== 'string' || CONTROL_CHARACTERS.test(value)) {
    throw new BadRequestError('phone must be a valid Bangladeshi mobile number.');
  }

  const compact = value.trim().replace(/[\s().-]/g, '');
  let normalized = compact;

  if (/^\+?8801[3-9]\d{8}$/.test(compact)) {
    normalized = `0${compact.replace(/^\+?880/, '')}`;
  }

  if (!mobileResExp.test(normalized)) {
    throw new BadRequestError('phone must be a valid Bangladeshi mobile number.');
  }

  return normalized;
};

const normalizeMessage = (value) => {
  if (typeof value !== 'string' || MESSAGE_CONTROL_CHARACTERS.test(value)) {
    throw new BadRequestError('message must be valid text.');
  }

  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!normalized || normalized.length > 5_000) {
    throw new BadRequestError('message must be between 1 and 5000 characters.');
  }

  return normalized;
};

const parseContactId = (value) => {
  let contactId = Number.NaN;

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    contactId = value;
  } else if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    contactId = Number(value);
  }

  if (!Number.isSafeInteger(contactId) || contactId < 1) {
    throw new BadRequestError('A valid contact ID is required.');
  }

  return contactId;
};

const normalizeEmailDeliveryRequest = (mode, body) => {
  assertObject(body, 'Request body');

  if (mode === 'contact') {
    rejectUnknownFields(body, CONTACT_REPLY_FIELDS);
    return {
      contactId: parseContactId(body.id),
      email: null,
      name: null,
      subject: null,
      text: normalizeMessage(body.text),
    };
  }

  if (mode !== 'custom' && mode !== 'newsletter') {
    throw new BadRequestError('Unsupported email delivery mode.');
  }

  rejectUnknownFields(body, CUSTOM_EMAIL_FIELDS);
  const email = normalizeEmail(body.email);
  if (!email) {
    throw new BadRequestError('email must be a valid email address.');
  }

  return {
    contactId: null,
    email,
    name: normalizeSingleLine(body.name, 'name', {
      max: 100,
      optional: true,
    }),
    subject: normalizeSingleLine(body.subject, 'subject', {
      min: 1,
      max: 200,
    }),
    text: normalizeMessage(body.text),
  };
};

const normalizeSmsDeliveryRequest = (mode, body) => {
  if (mode !== 'custom') {
    throw new BadRequestError('Unsupported SMS delivery mode.');
  }

  assertObject(body, 'Request body');
  rejectUnknownFields(body, CUSTOM_SMS_FIELDS);
  const message = normalizeMessage(body.message);
  if (message.length > 1_000) {
    throw new BadRequestError('message must be between 1 and 1000 characters.');
  }

  return {
    message,
    phone: normalizePhone(body.phone),
  };
};

const normalizeContactMessage = (body) => {
  assertObject(body, 'Request body');
  rejectUnknownFields(body, CONTACT_FIELDS);

  return {
    name: normalizeSingleLine(body.name, 'name', { min: 2, max: 100 }),
    phone: normalizePhone(body.phone),
    email: normalizeEmail(body.email),
    address: normalizeSingleLine(body.address, 'address', {
      max: 255,
      optional: true,
    }),
    message: normalizeMessage(body.message),
  };
};

const parsePositiveInteger = (value, field, fallback, max) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new BadRequestError(`${field} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max) {
    throw new BadRequestError(`${field} must not exceed ${max}.`);
  }

  return parsed;
};

const parseMessageListQuery = (query = {}) => {
  assertObject(query, 'Query');
  rejectUnknownFields(query, MESSAGE_QUERY_FIELDS);

  const page = parsePositiveInteger(query.page, 'page', 1, 100_000);
  const limit = parsePositiveInteger(query.limit, 'limit', 50, 100);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

module.exports = {
  normalizeContactMessage,
  normalizeEmailDeliveryRequest,
  normalizeEmail,
  normalizeMessage,
  normalizePhone,
  normalizeSmsDeliveryRequest,
  parseMessageListQuery,
};

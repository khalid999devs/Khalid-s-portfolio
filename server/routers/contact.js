const router = require('express').Router();
const {
  sendEmailToClient,
  sendBulkEmail,
  smsToClient,
  sendBulkSms,
  smsBalance,
} = require('../controllers/contact');
const adminValidate = require('../middlewares/adminTokenVerify');

// Outbound only. The inbound contact form and its message store are gone;
// nothing ever posted to them and the delivery log is the wanted history.
router.post('/emailToClient/:mode', adminValidate, sendEmailToClient);
router.post('/smsToClient/:mode', adminValidate, smsToClient);

// Separate routes, not a flag: different body, counts instead of one result.
router.post('/bulkEmail', adminValidate, sendBulkEmail);
router.post('/bulkSms', adminValidate, sendBulkSms);

router.get('/sms-balance', adminValidate, smsBalance);

module.exports = router;

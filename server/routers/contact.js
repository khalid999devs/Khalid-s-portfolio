const router = require('express').Router();
const { sendEmailToClient, smsToClient } = require('../controllers/contact');
const adminValidate = require('../middlewares/adminTokenVerify');

// The inbound contact form and its message store are gone. There was never a
// form in the client that posted to them, and the delivery log is the history
// that was actually wanted: what went out, to whom, and whether it arrived.
//
// What remains is outbound only, used by the admin Mail & SMS page.
router.post('/emailToClient/:mode', adminValidate, sendEmailToClient);
router.post('/smsToClient/:mode', adminValidate, smsToClient);

module.exports = router;

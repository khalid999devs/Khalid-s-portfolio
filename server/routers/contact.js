const router = require('express').Router()
const { sendEmailToClient, smsToClient } = require('../controllers/contact')
const adminValidate = require('../middlewares/adminTokenVerify')

const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

// Outbound only. Every route here is administrator-initiated; there is no
// public intake endpoint and no stored message inbox.
router.post('/emailToClient/:mode', adminValidate, noStore, sendEmailToClient)
router.post('/smsToClient/:mode', adminValidate, noStore, smsToClient)

module.exports = router

const router = require('express').Router()
const {
  sendMessage,
  getAllMessage,
  sendEmailToClient,
  smsToClient,
} = require('../controllers/contact')
const adminValidate = require('../middlewares/adminTokenVerify')

const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

router.get('/messages', adminValidate, noStore, getAllMessage)
router.post('/sendMessage', sendMessage)
router.post('/emailToClient/:mode', adminValidate, noStore, sendEmailToClient)
router.post('/smsToClient/:mode', adminValidate, noStore, smsToClient)

module.exports = router

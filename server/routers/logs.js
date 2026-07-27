const router = require('express').Router();
const { listLogs, deleteLogs } = require('../controllers/logs');
const adminValidate = require('../middlewares/adminTokenVerify');

// Admin only, with no public counterpart. A delivery log names everyone the
// site has contacted, which is exactly the kind of list that should never be
// readable without authentication.
router.get('/', adminValidate, listLogs);

// DELETE with a body: the id list and the filter both belong in one, and a URL
// carrying them would be logged by every proxy in the path.
router.delete('/', adminValidate, deleteLogs);

module.exports = router;

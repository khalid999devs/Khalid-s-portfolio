'use strict';

const { Op } = require('sequelize');
const { existsSync, readdirSync } = require('fs');
const { join } = require('path');
const { DeliveryLog, settings, Admin, projects } = require('../models');
const { resolveStoredUploadPath } = require('../utils/uploadPaths');
const { getRetentionDays } = require('../utils/visitTracker');
const { readLast, INTERVAL_DAYS } = require('../utils/scheduledAudit');

/**
 * Things that actually want the administrator's attention.
 *
 * Every item below is derived from real state: a configuration value that is
 * missing, a file that is referenced but absent, deliveries that failed. None
 * of it is decorative, and nothing is raised unless it is true right now, so an
 * empty list genuinely means there is nothing to do.
 *
 * Severity is about consequence, not volume:
 *   critical  something is broken or will break the next deploy
 *   warning   a feature is silently unavailable, or has started failing
 *   info      worth knowing, no action strictly required
 */

const FAILURE_WINDOW_DAYS = 7;
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

const isProduction = () => process.env.NODE_ENV === 'production';

const appliedMigrations = async (sequelize) => {
  try {
    const [rows] = await sequelize.query('SELECT name FROM schema_migrations');
    return new Set(rows.map((r) => r.name));
  } catch {
    // The table does not exist yet, which is itself the "nothing applied" case.
    return new Set();
  }
};

const getNotifications = async (req, res) => {
  const items = [];
  const add = (severity, title, detail, action) =>
    items.push({ id: `${severity}:${title}`, severity, title, detail, action });

  const [settingsRow, adminCount, projectList] = await Promise.all([
    settings.findOne(),
    Admin.count(),
    projects.findAll({ attributes: ['id', 'title', 'bannerImg', 'thumbnailContents'], raw: true }),
  ]);

  // --- deploy blockers ------------------------------------------------------
  const applied = await appliedMigrations(settings.sequelize);
  const onDisk = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.js'))
    : [];
  const pending = onDisk.filter((f) => !applied.has(f));
  if (pending.length > 0) {
    add(
      'critical',
      `${pending.length} migration${pending.length === 1 ? '' : 's'} not applied`,
      `The database schema is behind the code. Run "npm run migrate" on the server. Pending: ${pending.join(', ')}`,
      'migrate'
    );
  }

  if (isProduction() && !process.env.UPLOADS_DIR) {
    add(
      'critical',
      'Uploads are inside the application directory',
      'UPLOADS_DIR is not set, so the next deploy will delete every uploaded image, video and the resume. Point it at a mounted volume.',
      'env'
    );
  }

  // --- features that are silently off --------------------------------------
  const mailConfigured =
    process.env.MAIL_HOST && process.env.SERVER_EMAIL && process.env.MAIL_PASS;
  if (!mailConfigured) {
    add(
      'warning',
      'Email is not configured',
      'MAIL_HOST, SERVER_EMAIL and MAIL_PASS are not all set, so sending an email will fail. The composer will report it rather than pretend it worked.',
      'env'
    );
  }

  if (!process.env.SMS_USERNAME || !process.env.SMS_PASS) {
    add(
      'info',
      'SMS gateway is not configured',
      'SMS_USERNAME and SMS_PASS are not set. Sending an SMS will fail until they are.',
      'env'
    );
  } else if ((process.env.SMS_API_BASE || '').startsWith('http://')) {
    add(
      'warning',
      'SMS gateway is on plain HTTP',
      'Credentials and message text cross the network in the clear, and the provider puts them in the query string where proxies log them. Point SMS_API_BASE at HTTPS as soon as they support it.',
      'env'
    );
  }

  // --- content -------------------------------------------------------------
  if (!settingsRow?.resume) {
    add(
      'warning',
      'No resume published',
      'The "My Resume" button is hidden on the public site until a PDF is uploaded.',
      'resume'
    );
  } else {
    const onDiskPath = resolveStoredUploadPath(settingsRow.resume);
    if (!onDiskPath || !existsSync(onDiskPath)) {
      add(
        'critical',
        'The published resume file is missing',
        `Settings point at ${settingsRow.resume}, but that file is not on disk. The download link is returning an error.`,
        'resume'
      );
    }
  }

  const withoutThumbnail = projectList.filter((p) => {
    try {
      const parsed = JSON.parse(p.thumbnailContents || '[]');
      return !Array.isArray(parsed) || parsed.length === 0;
    } catch {
      return true;
    }
  });
  if (withoutThumbnail.length > 0) {
    add(
      'info',
      `${withoutThumbnail.length} project${withoutThumbnail.length === 1 ? '' : 's'} without a thumbnail`,
      `They will render with a placeholder: ${withoutThumbnail.map((p) => p.title).join(', ')}`,
      'projects'
    );
  }

  // --- delivery ------------------------------------------------------------
  const since = new Date(Date.now() - FAILURE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentFailures = await DeliveryLog.count({
    where: { status: 'failed', createdAt: { [Op.gte]: since } },
  });
  if (recentFailures > 0) {
    add(
      'warning',
      `${recentFailures} delivery failure${recentFailures === 1 ? '' : 's'} this week`,
      'Messages did not reach their recipient. The provider error is recorded against each one.',
      'messaging'
    );
  }

  // --- accounts ------------------------------------------------------------
  if (adminCount <= 1) {
    add(
      'info',
      'Only one administrator account',
      'Losing this password means shell access to the database server is the only way back in. A second account is a cheap insurance policy.',
      'accounts'
    );
  }

  // --- retention -----------------------------------------------------------
  const retentionDays = await getRetentionDays();
  if (retentionDays > 365) {
    add(
      'info',
      `Visit records are kept for ${retentionDays} days`,
      'Longer than most sites need. Shortening it reduces how much history a database leak would expose.',
      'visits'
    );
  }

  // --- dependency audit, refreshed on a background schedule ----------------
  const audit = await readLast();
  if (audit?.vulnerabilities) {
    const { critical = 0, high = 0, moderate = 0, low = 0 } = audit.vulnerabilities;
    const serious = critical + high;
    const checked = new Date(audit.checkedAt).toLocaleDateString();

    if (serious > 0) {
      add(
        critical > 0 ? 'critical' : 'warning',
        `${serious} serious dependency advisor${serious === 1 ? 'y' : 'ies'}`,
        `${critical} critical and ${high} high severity in production dependencies, as of ${checked}. Run "npm audit --omit=dev" in server/ to see them.`,
        'audit'
      );
    } else if (moderate + low > 0) {
      add(
        'info',
        `${moderate + low} low severity dependency advisor${moderate + low === 1 ? 'y' : 'ies'}`,
        `Nothing critical or high as of ${checked}. Documented in DEPLOYMENT.md where a fix would itself be a regression.`,
        'audit'
      );
    }
  } else if (audit === null) {
    add(
      'info',
      'Dependencies have not been audited yet',
      `The first automatic audit runs shortly after startup, then every ${INTERVAL_DAYS} days.`,
      'audit'
    );
  }

  const counts = {
    critical: items.filter((i) => i.severity === 'critical').length,
    warning: items.filter((i) => i.severity === 'warning').length,
    info: items.filter((i) => i.severity === 'info').length,
  };

  res.json({
    succeed: true,
    result: items,
    counts,
    // What the badge shows. Info is deliberately excluded: a badge that is
    // never zero is a badge people stop reading.
    total: counts.critical + counts.warning,
    msg: 'Successfully fetched notifications!',
  });
};

module.exports = { getNotifications };

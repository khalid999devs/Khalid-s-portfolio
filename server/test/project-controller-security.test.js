const assert = require('node:assert/strict');
const { existsSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const { projects, sequelize } = require('../models');
const {
  editProjectContents,
  editProjectInfos,
  reorderProjects,
  updateProjectContents,
} = require('../controllers/projects');
const { UPLOADS_ROOT } = require('../utils/uploadPaths');

test('update-content rejects client-controlled stored media paths', async () => {
  await assert.rejects(
    updateProjectContents(
      {
        body: { bannerImg: '/etc/passwd' },
        files: {},
        params: { id: '1' },
      },
      {}
    ),
    (error) =>
      error.statusCode === 400 && error.message === 'Unexpected field: bannerImg'
  );
});

test('edit-infos rejects media and model-control fields', async () => {
  await assert.rejects(
    editProjectInfos(
      {
        body: { videos: '[{"url":"/etc/passwd"}]' },
        params: { id: '1' },
      },
      {}
    ),
    (error) => error.statusCode === 403
  );

  await assert.rejects(
    editProjectInfos(
      {
        body: { displayOrder: 0 },
        params: { id: '1' },
      },
      {}
    ),
    (error) =>
      error.statusCode === 400 &&
      error.message === 'Unexpected field: displayOrder'
  );
});

test('edit-contents rejects extra body fields before persistence', async () => {
  await assert.rejects(
    editProjectContents(
      {
        body: {
          mode: 'videos',
          replaceItem: 'false',
          videos: '[{"url":"uploads/../../outside"}]',
        },
        files: {},
        params: { id: '1' },
      },
      {}
    ),
    (error) =>
      error.statusCode === 400 && error.message === 'Unexpected field: videos'
  );
});

test('a controller failure removes newly written uploads', async () => {
  const originalFindByPk = projects.findByPk;
  const testDirectory = resolve(
    UPLOADS_ROOT,
    `controller-cleanup-test-${process.pid}-${Date.now()}`
  );
  const testFile = resolve(testDirectory, 'bannerImg-test.webp');

  mkdirSync(testDirectory, { recursive: true });
  writeFileSync(testFile, 'test');
  projects.findByPk = async () => null;

  try {
    await assert.rejects(
      updateProjectContents(
        {
          body: {},
          files: {
            bannerImg: [
              {
                fieldname: 'bannerImg',
                filename: 'bannerImg-test.webp',
                mimetype: 'image/webp',
                path: testFile,
                size: 4,
              },
            ],
          },
          params: { id: '999999' },
        },
        {}
      ),
      (error) => error.statusCode === 400
    );

    assert.equal(existsSync(testFile), false);
  } finally {
    projects.findByPk = originalFindByPk;
    rmSync(testDirectory, { recursive: true, force: true });
  }
});

test('project reorder rejects duplicate or non-contiguous positions', async () => {
  await assert.rejects(
    reorderProjects(
      {
        body: {
          projectOrders: [
            { id: 1, displayOrder: 0 },
            { id: 2, displayOrder: 0 },
          ],
        },
      },
      {}
    ),
    /Project orders contain invalid values/
  );

  await assert.rejects(
    reorderProjects(
      {
        body: {
          projectOrders: [
            { id: 1, displayOrder: 0 },
            { id: 2, displayOrder: 2 },
          ],
        },
      },
      {}
    ),
    /Project orders contain invalid values/
  );
});

test('project reorder updates all positions in one transaction', async () => {
  const originalTransaction = sequelize.transaction;
  const originalUpdate = projects.update;
  const transaction = { id: 'test-transaction' };
  const updates = [];
  let responseBody;

  sequelize.transaction = async (callback) => callback(transaction);
  projects.update = async (values, options) => {
    updates.push({ values, options });
    return [1];
  };

  try {
    await reorderProjects(
      {
        body: {
          projectOrders: [
            { id: 8, displayOrder: 0 },
            { id: 5, displayOrder: 1 },
          ],
        },
      },
      {
        json(value) {
          responseBody = value;
        },
      }
    );

    assert.equal(responseBody.succeed, true);
    assert.deepEqual(updates, [
      {
        values: { displayOrder: 0 },
        options: { transaction, where: { id: 8 } },
      },
      {
        values: { displayOrder: 1 },
        options: { transaction, where: { id: 5 } },
      },
    ]);
  } finally {
    sequelize.transaction = originalTransaction;
    projects.update = originalUpdate;
  }
});

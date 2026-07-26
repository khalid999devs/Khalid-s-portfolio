'use strict';

const TABLE_NAME = 'contacts';
const INDEX_NAME = 'contacts_reply_attempt_id_unique';

const columnDefinitions = (Sequelize) => ({
  replyStatus: {
    allowNull: false,
    defaultValue: 'idle',
    type: Sequelize.STRING(16),
  },
  replyAttemptId: {
    allowNull: true,
    type: Sequelize.STRING(36),
  },
  replyRequestedAt: {
    allowNull: true,
    type: Sequelize.DATE,
  },
  replyAcceptedAt: {
    allowNull: true,
    type: Sequelize.DATE,
  },
});

const deliveryColumnContract = Object.freeze({
  replyStatus: Object.freeze({
    allowNull: false,
    defaultValue: 'idle',
    typeLabel: 'VARCHAR(16)',
    type: /^VARCHAR\(16\)$/u,
  }),
  replyAttemptId: Object.freeze({
    allowNull: true,
    defaultValue: null,
    typeLabel: 'VARCHAR(36)',
    type: /^VARCHAR\(36\)$/u,
  }),
  replyRequestedAt: Object.freeze({
    allowNull: true,
    defaultValue: null,
    typeLabel: 'DATETIME',
    type: /^DATETIME$/u,
  }),
  replyAcceptedAt: Object.freeze({
    allowNull: true,
    defaultValue: null,
    typeLabel: 'DATETIME',
    type: /^DATETIME$/u,
  }),
});

const schemaDrift = (invariant) => {
  throw new Error(
    `Contact delivery schema verification failed: ${invariant}`
  );
};

const normalizeColumnType = (type) =>
  String(
    type && typeof type.toString === 'function' ? type.toString() : type || ''
  )
    .trim()
    .toUpperCase();

const assertDeliveryColumns = (description) => {
  for (const [columnName, expected] of Object.entries(
    deliveryColumnContract
  )) {
    const actual = description[columnName];
    if (!actual) schemaDrift(`${columnName} is missing`);

    const actualType = normalizeColumnType(actual.type);
    if (!expected.type.test(actualType)) {
      schemaDrift(`${columnName} must use ${expected.typeLabel}`);
    }
    if (actual.allowNull !== expected.allowNull) {
      schemaDrift(
        `${columnName} must ${
          expected.allowNull ? 'allow NULL' : 'be NOT NULL'
        }`
      );
    }

    const actualDefault =
      actual.defaultValue === undefined ? null : actual.defaultValue;
    if (actualDefault !== expected.defaultValue) {
      schemaDrift(
        `${columnName} must default to ${
          expected.defaultValue === null
            ? 'NULL'
            : JSON.stringify(expected.defaultValue)
        }`
      );
    }
  }
};

const assertAttemptIndex = (indexes) => {
  const namedIndexes = indexes.filter((index) => index.name === INDEX_NAME);
  if (namedIndexes.length !== 1) {
    schemaDrift(`${INDEX_NAME} must exist exactly once`);
  }

  const [index] = namedIndexes;
  const fields = index.fields || [];
  const isUnique = index.unique === true || Number(index.unique) === 1;
  if (
    !isUnique ||
    index.primary === true ||
    String(index.type || '').toUpperCase() !== 'BTREE' ||
    fields.length !== 1 ||
    (fields[0].attribute || fields[0].name) !== 'replyAttemptId' ||
    (fields[0].length !== undefined && fields[0].length !== null)
  ) {
    schemaDrift(
      `${INDEX_NAME} must be UNIQUE on exactly replyAttemptId`
    );
  }
};

const assertDeliverySchema = async (queryInterface) => {
  const [description, indexes] = await Promise.all([
    queryInterface.describeTable(TABLE_NAME),
    queryInterface.showIndex(TABLE_NAME),
  ]);
  assertDeliveryColumns(description);
  assertAttemptIndex(indexes);
};

const addMissingColumns = async (queryInterface, Sequelize) => {
  let description = await queryInterface.describeTable(TABLE_NAME);

  for (const [columnName, definition] of Object.entries(
    columnDefinitions(Sequelize)
  )) {
    if (!Object.hasOwn(description, columnName)) {
      await queryInterface.addColumn(TABLE_NAME, columnName, definition);
      description = {
        ...description,
        [columnName]: definition,
      };
    }
  }
};

const ensureAttemptIndex = async (queryInterface) => {
  const indexes = await queryInterface.showIndex(TABLE_NAME);
  if (indexes.some((index) => index.name === INDEX_NAME)) return;

  await queryInterface.addIndex(TABLE_NAME, ['replyAttemptId'], {
    name: INDEX_NAME,
    unique: true,
  });
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await addMissingColumns(queryInterface, Sequelize);
    assertDeliveryColumns(await queryInterface.describeTable(TABLE_NAME));
    await ensureAttemptIndex(queryInterface);
    assertAttemptIndex(await queryInterface.showIndex(TABLE_NAME));

    // Adopt legacy reply history without sending or rewriting any message.
    // Re-running this statement is safe and preserves every non-idle state.
    await queryInterface.sequelize.query(
      `UPDATE \`${TABLE_NAME}\`
       SET \`replyStatus\` = CASE
             WHEN \`replied\` = 1 THEN 'accepted'
             ELSE 'idle'
           END,
           \`replyAcceptedAt\` = CASE
             WHEN \`replied\` = 1 THEN COALESCE(\`replyAcceptedAt\`, \`updatedAt\`)
             ELSE NULL
           END
       WHERE \`replyStatus\` IS NULL
          OR \`replyStatus\` = ''
          OR (\`replyStatus\` = 'idle' AND \`replied\` = 1)`
    );

    await assertDeliverySchema(queryInterface);
  },

  async down() {
    throw new Error(
      'Contact delivery state is an irreversible safety migration.'
    );
  },

  _private: {
    INDEX_NAME,
    TABLE_NAME,
    addMissingColumns,
    assertAttemptIndex,
    assertDeliveryColumns,
    assertDeliverySchema,
    columnDefinitions,
    deliveryColumnContract,
    ensureAttemptIndex,
  },
};

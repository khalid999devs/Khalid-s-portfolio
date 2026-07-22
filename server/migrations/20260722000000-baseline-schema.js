'use strict';

const TABLES = Object.freeze({
  admins: 'admins',
  contacts: 'contacts',
  projects: 'projects',
  settings: 'settings',
});

const timestamps = (Sequelize) => ({
  createdAt: {
    allowNull: false,
    type: Sequelize.DATE,
  },
  updatedAt: {
    allowNull: false,
    type: Sequelize.DATE,
  },
});

const primaryKey = (Sequelize) => ({
  id: {
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: Sequelize.INTEGER,
  },
});

const schemas = (Sequelize) => ({
  [TABLES.admins]: {
    ...primaryKey(Sequelize),
    userName: {
      allowNull: false,
      type: Sequelize.STRING(255),
    },
    password: {
      allowNull: false,
      type: Sequelize.STRING(255),
    },
    sessionVersion: {
      allowNull: false,
      defaultValue: 0,
      type: Sequelize.INTEGER,
    },
    ...timestamps(Sequelize),
  },
  [TABLES.contacts]: {
    ...primaryKey(Sequelize),
    name: {
      allowNull: false,
      type: Sequelize.STRING(255),
    },
    phone: {
      allowNull: false,
      type: Sequelize.STRING(255),
    },
    email: {
      allowNull: true,
      type: Sequelize.STRING(255),
    },
    address: {
      allowNull: true,
      type: Sequelize.STRING(255),
    },
    message: {
      allowNull: false,
      type: Sequelize.TEXT,
    },
    replyMsg: {
      allowNull: true,
      type: Sequelize.TEXT,
    },
    replied: {
      allowNull: true,
      defaultValue: false,
      type: Sequelize.BOOLEAN,
    },
    ...timestamps(Sequelize),
  },
  [TABLES.projects]: {
    ...primaryKey(Sequelize),
    title: {
      allowNull: false,
      type: Sequelize.STRING(255),
    },
    value: {
      allowNull: false,
      type: Sequelize.STRING(255),
    },
    category: {
      allowNull: true,
      defaultValue: 'all',
      type: Sequelize.STRING(255),
    },
    subtitle: {
      allowNull: false,
      type: Sequelize.STRING(255),
    },
    overview: {
      allowNull: false,
      type: Sequelize.TEXT,
    },
    role: {
      allowNull: false,
      defaultValue: '[]',
      type: Sequelize.TEXT,
    },
    siteLink: {
      allowNull: true,
      type: Sequelize.STRING(255),
    },
    designLink: {
      allowNull: true,
      type: Sequelize.STRING(255),
    },
    codeLink: {
      allowNull: true,
      type: Sequelize.STRING(255),
    },
    date: {
      allowNull: false,
      type: Sequelize.STRING(255),
    },
    locationYear: {
      allowNull: false,
      type: Sequelize.STRING(255),
    },
    techStack: {
      allowNull: true,
      defaultValue: '[]',
      type: Sequelize.TEXT,
    },
    bannerImg: {
      allowNull: true,
      type: Sequelize.STRING(255),
    },
    videos: {
      allowNull: true,
      defaultValue: '[]',
      type: Sequelize.TEXT,
    },
    thumbnailContents: {
      allowNull: true,
      defaultValue: '[]',
      type: Sequelize.TEXT,
    },
    sliderContents: {
      allowNull: true,
      defaultValue: '[]',
      type: Sequelize.TEXT,
    },
    displayOrder: {
      allowNull: false,
      defaultValue: 0,
      type: Sequelize.INTEGER,
    },
    ...timestamps(Sequelize),
  },
  [TABLES.settings]: {
    ...primaryKey(Sequelize),
    technologies: {
      allowNull: true,
      defaultValue: '{}',
      type: Sequelize.TEXT,
    },
    ...timestamps(Sequelize),
  },
});

const requiredLegacyColumns = Object.freeze({
  [TABLES.admins]: ['id', 'userName', 'password', 'createdAt', 'updatedAt'],
  [TABLES.contacts]: [
    'id',
    'name',
    'phone',
    'email',
    'address',
    'message',
    'replyMsg',
    'replied',
    'createdAt',
    'updatedAt',
  ],
  [TABLES.projects]: [
    'id',
    'title',
    'value',
    'subtitle',
    'overview',
    'role',
    'siteLink',
    'codeLink',
    'date',
    'locationYear',
    'techStack',
    'bannerImg',
    'videos',
    'thumbnailContents',
    'sliderContents',
    'createdAt',
    'updatedAt',
  ],
  [TABLES.settings]: ['id', 'technologies', 'createdAt', 'updatedAt'],
});

const safeLegacyAdditions = Object.freeze({
  [TABLES.admins]: ['sessionVersion'],
  [TABLES.projects]: ['category', 'designLink', 'displayOrder'],
});

const typePatterns = Object.freeze({
  boolean:
    /^(?:BOOL(?:EAN)?|TINYINT(?:\s*\(\s*1\s*\))?)(?:\s|$)/u,
  character:
    /^(?:CHAR|VARCHAR)(?:\s*\(|\s|$)/u,
  characterOrText:
    /^(?:(?:CHAR|VARCHAR)(?:\s*\(|\s|$)|(?:TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT)(?:\s|$))/u,
  date: /^(?:DATE|DATETIME|TIMESTAMP)(?:\s*\(|\s|$)/u,
  integer:
    /^(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER)(?:\s*\(|\s|$)/u,
  text: /^(?:TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT)(?:\s|$)/u,
});

const legacyColumnCompatibility = Object.freeze({
  [TABLES.admins]: {
    id: { allowNull: false, primaryKey: true, type: 'integer' },
    userName: { allowNull: false, type: 'character' },
    password: { allowNull: false, type: 'character' },
    sessionVersion: { allowNull: false, type: 'integer' },
    createdAt: { allowNull: false, type: 'date' },
    updatedAt: { allowNull: false, type: 'date' },
  },
  [TABLES.contacts]: {
    id: { allowNull: false, primaryKey: true, type: 'integer' },
    name: { allowNull: false, type: 'character' },
    phone: { allowNull: false, type: 'character' },
    email: { type: 'character' },
    address: { type: 'character' },
    message: { allowNull: false, type: 'text' },
    replyMsg: { type: 'text' },
    replied: { type: 'boolean' },
    createdAt: { allowNull: false, type: 'date' },
    updatedAt: { allowNull: false, type: 'date' },
  },
  [TABLES.projects]: {
    id: { allowNull: false, primaryKey: true, type: 'integer' },
    title: { allowNull: false, type: 'character' },
    value: { allowNull: false, type: 'character' },
    category: { type: 'character' },
    subtitle: { allowNull: false, type: 'character' },
    overview: { allowNull: false, type: 'text' },
    // The oldest supported schema stored role in VARCHAR. The migration
    // widens it to TEXT after this compatibility gate.
    role: { allowNull: false, type: 'characterOrText' },
    siteLink: { type: 'character' },
    designLink: { type: 'character' },
    codeLink: { type: 'character' },
    date: { allowNull: false, type: 'character' },
    locationYear: { allowNull: false, type: 'character' },
    techStack: { type: 'text' },
    bannerImg: { type: 'character' },
    videos: { type: 'text' },
    thumbnailContents: { type: 'text' },
    sliderContents: { type: 'text' },
    displayOrder: { allowNull: false, type: 'integer' },
    createdAt: { allowNull: false, type: 'date' },
    updatedAt: { allowNull: false, type: 'date' },
  },
  [TABLES.settings]: {
    id: { allowNull: false, primaryKey: true, type: 'integer' },
    technologies: { type: 'text' },
    createdAt: { allowNull: false, type: 'date' },
    updatedAt: { allowNull: false, type: 'date' },
  },
});

const normalizeTableName = (table) => {
  if (typeof table === 'string') return table;
  return table?.tableName || table?.table_name || table?.name;
};

const assertCompatibleExistingTable = (tableName, description) => {
  const missingColumns = requiredLegacyColumns[tableName].filter(
    (columnName) => !Object.hasOwn(description, columnName)
  );

  if (missingColumns.length) {
    throw new Error(
      `Existing table ${tableName} is not a supported portfolio schema; ` +
        `missing columns: ${missingColumns.join(', ')}`
    );
  }

  const incompatibleColumns = [];
  for (const [columnName, requirements] of Object.entries(
    legacyColumnCompatibility[tableName]
  )) {
    const column = description[columnName] || {};
    if (
      Object.hasOwn(column, 'type') &&
      column.type !== undefined &&
      column.type !== null &&
      String(column.type).trim() &&
      !typePatterns[requirements.type].test(
        String(column.type).trim().toUpperCase()
      )
    ) {
      incompatibleColumns.push(
        `${columnName} has incompatible type ${String(column.type).trim()}`
      );
    }
    if (requirements.allowNull === false && column.allowNull === true) {
      incompatibleColumns.push(`${columnName} must be NOT NULL`);
    }
    if (requirements.primaryKey === true && column.primaryKey === false) {
      incompatibleColumns.push(`${columnName} must be the primary key`);
    }
  }

  if (incompatibleColumns.length) {
    throw new Error(
      `Existing table ${tableName} is not a supported portfolio schema; ` +
        incompatibleColumns.join(', ')
    );
  }
};

const ensureSafeLegacyColumns = async (
  queryInterface,
  Sequelize,
  tableName,
  description
) => {
  const additions = safeLegacyAdditions[tableName] || [];
  const tableSchema = schemas(Sequelize)[tableName];
  const addedColumns = new Set();

  for (const columnName of additions) {
    if (!Object.hasOwn(description, columnName)) {
      await queryInterface.addColumn(
        tableName,
        columnName,
        tableSchema[columnName]
      );
      addedColumns.add(columnName);
    }
  }

  return addedColumns;
};

const indexColumns = (index) =>
  (index.fields || []).map((field) => field.attribute || field.name);

const ensureIndexes = async (queryInterface) => {
  const adminIndexes = await queryInterface.showIndex(TABLES.admins);
  const hasUniqueUserName = adminIndexes.some(
    (index) =>
      index.unique &&
      indexColumns(index).length === 1 &&
      indexColumns(index)[0] === 'userName'
  );
  if (!hasUniqueUserName) {
    await queryInterface.addIndex(TABLES.admins, ['userName'], {
      name: 'admins_user_name_unique',
      unique: true,
    });
  }

  const projectIndexes = await queryInterface.showIndex(TABLES.projects);
  const hasUniqueProjectValue = projectIndexes.some(
    (index) =>
      index.unique &&
      indexColumns(index).length === 1 &&
      indexColumns(index)[0] === 'value'
  );
  if (!hasUniqueProjectValue) {
    // Do not silently rewrite public project URLs. If a legacy database has
    // duplicate slugs, index creation fails so an operator can reconcile them
    // deliberately before rerunning this idempotent baseline.
    await queryInterface.addIndex(TABLES.projects, ['value'], {
      name: 'projects_value_unique',
      unique: true,
    });
  }

  const hasDisplayOrderIndex = projectIndexes.some(
    (index) => indexColumns(index)[0] === 'displayOrder'
  );
  if (!hasDisplayOrderIndex) {
    await queryInterface.addIndex(TABLES.projects, ['displayOrder'], {
      name: 'projects_display_order',
    });
  }
};

const normalizeDisplayOrder = async (queryInterface, Sequelize) => {
  const rows = await queryInterface.sequelize.query(
    'SELECT `id`, `displayOrder` FROM `projects` ' +
      'ORDER BY `displayOrder` ASC, `id` ASC',
    { type: Sequelize.QueryTypes.SELECT }
  );
  const observedOrders = new Set();
  const isAlreadyContiguous = rows.every((row, index) => {
    const displayOrder =
      typeof row.displayOrder === 'number'
        ? row.displayOrder
        : typeof row.displayOrder === 'string' &&
            /^\d+$/u.test(row.displayOrder)
          ? Number(row.displayOrder)
          : Number.NaN;
    if (
      !Number.isSafeInteger(displayOrder) ||
      displayOrder !== index ||
      observedOrders.has(displayOrder)
    ) {
      return false;
    }
    observedOrders.add(displayOrder);
    return true;
  });

  if (isAlreadyContiguous) return;

  for (const [displayOrder, row] of rows.entries()) {
    await queryInterface.bulkUpdate(
      TABLES.projects,
      { displayOrder },
      { id: row.id }
    );
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const existingTables = new Set(
      (await queryInterface.showAllTables()).map(normalizeTableName)
    );
    const tableSchemas = schemas(Sequelize);

    for (const tableName of Object.values(TABLES)) {
      if (!existingTables.has(tableName)) {
        await queryInterface.createTable(tableName, tableSchemas[tableName], {
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci',
          engine: 'InnoDB',
        });
        continue;
      }

      const description = await queryInterface.describeTable(tableName);
      assertCompatibleExistingTable(tableName, description);
      await ensureSafeLegacyColumns(
        queryInterface,
        Sequelize,
        tableName,
        description
      );
    }

    // The first project model used VARCHAR for role. Widening to TEXT is
    // non-destructive and aligns adopted databases with the current model.
    await queryInterface.changeColumn(
      TABLES.projects,
      'role',
      tableSchemas[TABLES.projects].role
    );
    await normalizeDisplayOrder(queryInterface, Sequelize);
    await queryInterface.changeColumn(
      TABLES.projects,
      'displayOrder',
      tableSchemas[TABLES.projects].displayOrder
    );
    await ensureIndexes(queryInterface);
  },

  async down() {
    throw new Error(
      'The schema baseline is intentionally irreversible because it may have ' +
        'adopted pre-existing production tables. Restore a verified backup ' +
        'instead of dropping the baseline.'
    );
  },

  _private: {
    assertCompatibleExistingTable,
    ensureIndexes,
    ensureSafeLegacyColumns,
    normalizeDisplayOrder,
    normalizeTableName,
    schemas,
    typePatterns,
  },
};

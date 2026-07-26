'use strict';

const TARGET_CHARSET = 'utf8mb4';
const TARGET_COLLATION = 'utf8mb4_unicode_ci';
const MAX_DATABASE_ID = 2_147_483_647n;
const PROJECT_BATCH_SIZE = 100;
const MAX_TEXT_BYTES = 60_000;

const column = (dataType, nullable, options = {}) =>
  Object.freeze({
    dataType,
    nullable,
    ...options,
  });

const idColumn = () =>
  column('int', false, {
    autoIncrement: true,
    columnType: /^int(?:\(\d+\))?$/iu,
  });

const stringColumn = (nullable) =>
  column('varchar', nullable, {
    characterLength: 255,
    charset: TARGET_CHARSET,
    collation: TARGET_COLLATION,
  });

const textColumn = (nullable) =>
  column('text', nullable, {
    charset: TARGET_CHARSET,
    collation: TARGET_COLLATION,
  });

const dateColumn = () =>
  column('datetime', false, {
    columnType: /^datetime$/iu,
  });

const SCHEMA_CONTRACT = Object.freeze({
  SequelizeMeta: Object.freeze({
    name: stringColumn(false),
  }),
  admins: Object.freeze({
    id: idColumn(),
    userName: stringColumn(false),
    password: stringColumn(false),
    sessionVersion: column('int', false, {
      columnType: /^int(?:\(\d+\))?$/iu,
      defaultValue: '0',
    }),
    createdAt: dateColumn(),
    updatedAt: dateColumn(),
  }),
  contacts: Object.freeze({
    id: idColumn(),
    name: stringColumn(false),
    phone: stringColumn(false),
    email: stringColumn(true),
    address: stringColumn(true),
    message: textColumn(false),
    replyMsg: textColumn(true),
    replied: column('tinyint', true, {
      columnType: /^tinyint\(1\)$/iu,
      defaultValue: '0',
    }),
    createdAt: dateColumn(),
    updatedAt: dateColumn(),
  }),
  projects: Object.freeze({
    id: idColumn(),
    title: stringColumn(false),
    value: stringColumn(false),
    category: column('varchar', true, {
      characterLength: 255,
      charset: TARGET_CHARSET,
      collation: TARGET_COLLATION,
      defaultValue: 'all',
    }),
    subtitle: stringColumn(false),
    overview: textColumn(false),
    role: textColumn(false),
    siteLink: stringColumn(true),
    designLink: stringColumn(true),
    codeLink: stringColumn(true),
    date: stringColumn(false),
    locationYear: stringColumn(false),
    techStack: textColumn(true),
    bannerImg: stringColumn(true),
    videos: textColumn(true),
    thumbnailContents: textColumn(true),
    sliderContents: textColumn(true),
    displayOrder: column('int', false, {
      columnType: /^int(?:\(\d+\))?$/iu,
      defaultValue: '0',
    }),
    createdAt: dateColumn(),
    updatedAt: dateColumn(),
  }),
  settings: Object.freeze({
    id: idColumn(),
    technologies: textColumn(true),
    createdAt: dateColumn(),
    updatedAt: dateColumn(),
  }),
});

const REQUIRED_INDEXES = Object.freeze({
  SequelizeMeta: Object.freeze([
    Object.freeze({ columns: Object.freeze(['name']), primary: true }),
  ]),
  admins: Object.freeze([
    Object.freeze({ columns: Object.freeze(['id']), primary: true }),
    Object.freeze({ columns: Object.freeze(['userName']), unique: true }),
  ]),
  contacts: Object.freeze([
    Object.freeze({ columns: Object.freeze(['id']), primary: true }),
  ]),
  projects: Object.freeze([
    Object.freeze({ columns: Object.freeze(['id']), primary: true }),
    Object.freeze({ columns: Object.freeze(['value']), unique: true }),
    Object.freeze({ columns: Object.freeze(['displayOrder']) }),
  ]),
  settings: Object.freeze([
    Object.freeze({ columns: Object.freeze(['id']), primary: true }),
  ]),
});

const ID_TABLES = Object.freeze([
  'admins',
  'contacts',
  'projects',
  'settings',
]);
const TABLE_NAMES = Object.freeze(Object.keys(SCHEMA_CONTRACT));

const COLUMN_INVENTORY_SQL =
  'SELECT `TABLE_NAME` AS `tableName`, `COLUMN_NAME` AS `columnName`, ' +
  '`DATA_TYPE` AS `dataType`, `COLUMN_TYPE` AS `columnType`, ' +
  '`IS_NULLABLE` AS `isNullable`, `COLUMN_DEFAULT` AS `columnDefault`, ' +
  '`EXTRA` AS `extra`, `CHARACTER_SET_NAME` AS `characterSet`, ' +
  '`COLLATION_NAME` AS `collation`, ' +
  '`CHARACTER_MAXIMUM_LENGTH` AS `characterMaximumLength` ' +
  'FROM `information_schema`.`COLUMNS` ' +
  'WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` IN (:tableNames) ' +
  'ORDER BY `TABLE_NAME`, `ORDINAL_POSITION`';

const TABLE_INVENTORY_SQL =
  'SELECT `TABLE_NAME` AS `tableName`, `ENGINE` AS `engine`, ' +
  '`TABLE_COLLATION` AS `tableCollation`, ' +
  'CAST(`AUTO_INCREMENT` AS CHAR) AS `nextId` ' +
  'FROM `information_schema`.`TABLES` ' +
  'WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` IN (:tableNames)';

const INDEX_INVENTORY_SQL =
  'SELECT `TABLE_NAME` AS `tableName`, `INDEX_NAME` AS `indexName`, ' +
  '`NON_UNIQUE` AS `nonUnique`, `SEQ_IN_INDEX` AS `sequence`, ' +
  '`COLUMN_NAME` AS `columnName`, `SUB_PART` AS `subPart`, ' +
  '`INDEX_TYPE` AS `indexType` ' +
  'FROM `information_schema`.`STATISTICS` ' +
  'WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` IN (:tableNames) ' +
  'ORDER BY `TABLE_NAME`, `INDEX_NAME`, `SEQ_IN_INDEX`';

const FOREIGN_KEY_INVENTORY_SQL =
  'SELECT `TABLE_NAME` AS `tableName`, ' +
  '`CONSTRAINT_NAME` AS `constraintName`, `COLUMN_NAME` AS `columnName` ' +
  'FROM `information_schema`.`KEY_COLUMN_USAGE` ' +
  'WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` IN (:tableNames) ' +
  'AND `REFERENCED_TABLE_NAME` IS NOT NULL';

const ID_RANGE_SQL = ID_TABLES.map(
  (tableName) =>
    `SELECT '${tableName}' AS \`tableName\`, ` +
    'CAST(MIN(`id`) AS CHAR) AS `minimumId`, ' +
    'CAST(MAX(`id`) AS CHAR) AS `maximumId` ' +
    `FROM \`${tableName}\``
).join(' UNION ALL ');

const PROJECT_FIELDS = Object.freeze([
  'id',
  'title',
  'value',
  'category',
  'subtitle',
  'overview',
  'role',
  'siteLink',
  'designLink',
  'codeLink',
  'date',
  'locationYear',
  'techStack',
  'bannerImg',
  'videos',
  'thumbnailContents',
  'sliderContents',
  'displayOrder',
]);

const PROJECT_BATCH_SQL =
  `SELECT ${PROJECT_FIELDS.map((field) => `\`${field}\``).join(', ')} ` +
  'FROM `projects` ' +
  'WHERE (`displayOrder` > :afterDisplayOrder OR ' +
  '(`displayOrder` = :afterDisplayOrder AND `id` > :afterId)) ' +
  'ORDER BY `displayOrder` ASC, `id` ASC ' +
  `LIMIT ${PROJECT_BATCH_SIZE}`;

const normalizeMetadataString = (value) =>
  value === null || value === undefined ? null : String(value);

const schemaError = (location, invariant) => {
  throw new Error(
    `Database schema preflight failed at ${location}: ${invariant}`
  );
};

const projectDataError = (projectId, fieldName) => {
  throw new Error(
    `Project data preflight failed for id ${String(projectId)} field ${fieldName}`
  );
};

const groupRows = (rows, groupKey) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = String(row[groupKey]);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });
  return grouped;
};

const assertTableContract = (tableRows) => {
  const rowsByTable = new Map(
    tableRows.map((row) => [String(row.tableName), row])
  );

  for (const tableName of TABLE_NAMES) {
    const table = rowsByTable.get(tableName);
    if (!table) schemaError(tableName, 'table is missing');
    if (String(table.engine || '').toLowerCase() !== 'innodb') {
      schemaError(tableName, 'storage engine must be InnoDB');
    }
    if (
      String(table.tableCollation || '').toLowerCase() !== TARGET_COLLATION
    ) {
      schemaError(
        tableName,
        `table collation must be ${TARGET_COLLATION}`
      );
    }

    if (ID_TABLES.includes(tableName) && table.nextId !== null) {
      let nextId;
      try {
        nextId = BigInt(String(table.nextId));
      } catch (_error) {
        schemaError(tableName, 'AUTO_INCREMENT counter is invalid');
      }
      if (nextId < 1n || nextId >= MAX_DATABASE_ID) {
        schemaError(tableName, 'AUTO_INCREMENT counter is out of range');
      }
    }
  }
};

const assertColumnContract = (columnRows) => {
  const rowsByTable = groupRows(columnRows, 'tableName');

  for (const [tableName, expectedColumns] of Object.entries(
    SCHEMA_CONTRACT
  )) {
    const rows = rowsByTable.get(tableName) || [];
    const actualColumns = new Map(
      rows.map((row) => [String(row.columnName), row])
    );
    const expectedNames = Object.keys(expectedColumns);
    const unexpectedNames = [...actualColumns.keys()].filter(
      (columnName) => !Object.hasOwn(expectedColumns, columnName)
    );
    if (unexpectedNames.length) {
      schemaError(
        tableName,
        `unexpected columns: ${unexpectedNames.join(', ')}`
      );
    }

    for (const columnName of expectedNames) {
      const location = `${tableName}.${columnName}`;
      const expected = expectedColumns[columnName];
      const actual = actualColumns.get(columnName);
      if (!actual) schemaError(location, 'column is missing');

      if (
        String(actual.dataType || '').toLowerCase() !== expected.dataType
      ) {
        schemaError(location, `type must be ${expected.dataType}`);
      }
      if (
        expected.columnType &&
        !expected.columnType.test(String(actual.columnType || ''))
      ) {
        schemaError(location, 'column type modifiers are incompatible');
      }
      const isNullable =
        String(actual.isNullable || '').toUpperCase() === 'YES';
      if (isNullable !== expected.nullable) {
        schemaError(
          location,
          expected.nullable ? 'column must be nullable' : 'column must be NOT NULL'
        );
      }
      if (
        expected.characterLength !== undefined &&
        Number(actual.characterMaximumLength) !== expected.characterLength
      ) {
        schemaError(
          location,
          `character capacity must be ${expected.characterLength}`
        );
      }
      if (
        expected.charset &&
        String(actual.characterSet || '').toLowerCase() !== expected.charset
      ) {
        schemaError(
          location,
          `character set must be ${expected.charset}`
        );
      }
      if (
        expected.collation &&
        String(actual.collation || '').toLowerCase() !== expected.collation
      ) {
        schemaError(location, `collation must be ${expected.collation}`);
      }
      if (
        Object.hasOwn(expected, 'defaultValue') &&
        normalizeMetadataString(actual.columnDefault) !==
          expected.defaultValue
      ) {
        schemaError(
          location,
          `default must be ${expected.defaultValue}`
        );
      }

      const extra = String(actual.extra || '').trim().toLowerCase();
      if (expected.autoIncrement) {
        if (extra !== 'auto_increment') {
          schemaError(location, 'column must be AUTO_INCREMENT');
        }
      } else if (extra) {
        schemaError(location, 'unexpected generated column attributes');
      }
    }
  }
};

const normalizeIndex = (indexName, rows) => {
  const orderedRows = [...rows].sort(
    (left, right) => Number(left.sequence) - Number(right.sequence)
  );
  const first = orderedRows[0] || {};

  return {
    columns: orderedRows.map((row) => String(row.columnName)),
    fullColumns: orderedRows.every(
      (row) => row.subPart === null || row.subPart === undefined
    ),
    indexName,
    indexType: String(first.indexType || '').toUpperCase(),
    primary: indexName === 'PRIMARY',
    unique: Number(first.nonUnique) === 0,
  };
};

const indexMatches = (actual, expected) =>
  actual.fullColumns &&
  actual.indexType === 'BTREE' &&
  actual.primary === Boolean(expected.primary) &&
  actual.unique === Boolean(expected.primary || expected.unique) &&
  actual.columns.length === expected.columns.length &&
  actual.columns.every(
    (columnName, index) => columnName === expected.columns[index]
  );

const assertIndexContract = (indexRows) => {
  const rowsByTable = groupRows(indexRows, 'tableName');

  for (const [tableName, expectedIndexes] of Object.entries(
    REQUIRED_INDEXES
  )) {
    const rows = rowsByTable.get(tableName) || [];
    const actualIndexes = [...groupRows(rows, 'indexName')].map(
      ([indexName, groupedRows]) => normalizeIndex(indexName, groupedRows)
    );
    const unmatched = new Set(actualIndexes.map((_index, index) => index));

    for (const expected of expectedIndexes) {
      const matchingIndexes = [...unmatched].filter((index) =>
        indexMatches(actualIndexes[index], expected)
      );
      if (matchingIndexes.length !== 1) {
        schemaError(
          tableName,
          `required index on (${expected.columns.join(', ')}) is missing or ambiguous`
        );
      }
      unmatched.delete(matchingIndexes[0]);
    }

    if (unmatched.size) {
      const unexpectedNames = [...unmatched].map(
        (index) => actualIndexes[index].indexName
      );
      schemaError(
        tableName,
        `unexpected indexes: ${unexpectedNames.join(', ')}`
      );
    }
  }
};

const assertNoForeignKeys = (foreignKeyRows) => {
  if (!foreignKeyRows.length) return;
  const first = foreignKeyRows[0];
  schemaError(
    `${String(first.tableName)}.${String(first.columnName)}`,
    `unexpected foreign key ${String(first.constraintName)}`
  );
};

const parseBoundedDatabaseId = (value, location) => {
  let id;
  try {
    id = BigInt(String(value));
  } catch (_error) {
    schemaError(location, 'id range is invalid');
  }
  if (id < 1n || id >= MAX_DATABASE_ID) {
    schemaError(location, 'id range is exhausted or invalid');
  }
  return id;
};

const assertIdRanges = (rangeRows) => {
  const rowsByTable = new Map(
    rangeRows.map((row) => [String(row.tableName), row])
  );

  for (const tableName of ID_TABLES) {
    const row = rowsByTable.get(tableName);
    if (!row) schemaError(tableName, 'id range could not be inspected');
    if (row.minimumId === null && row.maximumId === null) continue;
    if (row.minimumId === null || row.maximumId === null) {
      schemaError(tableName, 'id range is inconsistent');
    }
    parseBoundedDatabaseId(row.minimumId, `${tableName}.id`);
    parseBoundedDatabaseId(row.maximumId, `${tableName}.id`);
  }
};

const hasForbiddenControlCharacter = (value, allowFormatting) => {
  const candidate = allowFormatting
    ? value.replace(/[\t\n]/gu, '')
    : value;
  return /\p{Cc}/u.test(candidate);
};

const validateBoundedText = (
  value,
  {
    allowFormatting = false,
    maxBytes,
    maxLength,
    required = false,
    singleLine = false,
  }
) => {
  if (typeof value !== 'string') return false;
  let normalized = value.normalize('NFKC').replace(/\r\n?/gu, '\n');
  if (
    hasForbiddenControlCharacter(normalized, allowFormatting) ||
    (singleLine && /[\n\u2028\u2029]/u.test(normalized))
  ) {
    return false;
  }
  normalized = normalized.trim();
  if (singleLine) normalized = normalized.replace(/[\t ]+/gu, ' ');
  if (required && normalized.length === 0) return false;
  if (
    maxLength !== undefined &&
    [...normalized].length > maxLength
  ) {
    return false;
  }
  if (
    maxBytes !== undefined &&
    Buffer.byteLength(normalized, 'utf8') > maxBytes
  ) {
    return false;
  }
  return true;
};

const normalizeListItem = (value) => {
  if (
    !validateBoundedText(value, {
      maxLength: 120,
      required: true,
      singleLine: true,
    })
  ) {
    return null;
  }

  const normalized = value
    .normalize('NFKC')
    .replace(/\r\n?/gu, '\n')
    .trim()
    .replace(/[\t ]+/gu, ' ');
  return [...normalized].length <= 120 ? normalized : null;
};

const parseJson = (value) => {
  if (
    typeof value !== 'string' ||
    Buffer.byteLength(value, 'utf8') > MAX_TEXT_BYTES
  ) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const validateStringList = (value, { maxItems, required }) => {
  const parsed = parseJson(value);
  if (
    !Array.isArray(parsed) ||
    parsed.length > maxItems ||
    (required && parsed.length === 0)
  ) {
    return false;
  }

  const seen = new Set();
  for (const item of parsed) {
    const normalized = normalizeListItem(item);
    if (normalized === null || seen.has(normalized)) return false;
    seen.add(normalized);
  }
  return true;
};

const validateHttpUrl = (value) => {
  if (value === null || value === '') return true;
  if (
    !validateBoundedText(value, {
      maxLength: 255,
      singleLine: true,
    })
  ) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    return false;
  }

  return (
    ['http:', 'https:'].includes(parsed.protocol) &&
    Boolean(parsed.hostname) &&
    !parsed.username &&
    !parsed.password &&
    [...parsed.toString()].length <= 255
  );
};

const MEDIA_POLICIES = Object.freeze({
  bannerImg: Object.freeze({
    extensions: /\.(?:jpe?g|png|webp)$/iu,
    metadataKey: null,
    mimeTypes: Object.freeze([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ]),
  }),
  videos: Object.freeze({
    extensions: /\.mp4$/iu,
    maxItems: 32,
    metadataKey: 'serverVid',
    mimeTypes: Object.freeze(['video/mp4']),
  }),
  thumbnailContents: Object.freeze({
    extensions: /\.(?:jpe?g|png|webp)$/iu,
    maxItems: 64,
    metadataKey: 'serverThumb',
    mimeTypes: Object.freeze([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ]),
  }),
  sliderContents: Object.freeze({
    extensions: /\.(?:jpe?g|png|webp)$/iu,
    maxItems: 64,
    metadataKey: 'serverContent',
    mimeTypes: Object.freeze([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ]),
  }),
});

const isPlainObject = (value) =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

const validateStoredMediaPath = (value, fieldName, maximumLength) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    value.includes('\0') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    [...value].length > maximumLength
  ) {
    return false;
  }

  const segments = value.split('/');
  return (
    segments.length === 5 &&
    segments[0] === 'uploads' &&
    segments[1] === 'projects' &&
    segments[2].length > 0 &&
    segments[3] === fieldName &&
    segments[4].length > 0 &&
    segments.every(
      (segment) => segment !== '.' && segment !== '..' && segment !== ''
    ) &&
    MEDIA_POLICIES[fieldName].extensions.test(segments[4])
  );
};

const normalizeContentId = (value) => {
  if (Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value !== 'string') return null;

  const normalized = value
    .normalize('NFKC')
    .replace(/\r\n?/gu, '\n')
    .trim()
    .replace(/[\t ]+/gu, ' ');
  if (
    normalized !== value ||
    normalized.toLowerCase() === 'null' ||
    !validateBoundedText(normalized, {
      maxLength: 128,
      required: true,
      singleLine: true,
    })
  ) {
    return null;
  }
  return normalized;
};

const validateMediaMetadata = (metadata, item, fieldName, policy) => {
  if (metadata === undefined) return true;
  if (!isPlainObject(metadata)) return false;
  const filename = item.url.split('/').at(-1);

  if (
    metadata.fieldname !== undefined &&
    metadata.fieldname !== fieldName
  ) {
    return false;
  }
  if (metadata.path !== undefined && metadata.path !== item.url) return false;
  if (metadata.filename !== undefined && metadata.filename !== filename) {
    return false;
  }
  if (
    metadata.mimetype !== undefined &&
    !policy.mimeTypes.includes(String(metadata.mimetype).toLowerCase())
  ) {
    return false;
  }
  if (
    metadata.size !== undefined &&
    (!Number.isSafeInteger(metadata.size) ||
      metadata.size < 0 ||
      metadata.size > 50 * 1024 * 1024)
  ) {
    return false;
  }
  return true;
};

const validateMediaList = (value, fieldName) => {
  const policy = MEDIA_POLICIES[fieldName];
  const parsed = parseJson(value);
  if (!Array.isArray(parsed) || parsed.length > policy.maxItems) return false;

  const contentIds = new Set();
  for (const item of parsed) {
    if (!isPlainObject(item)) return false;
    const contentId = normalizeContentId(item.id);
    if (contentId === null || contentIds.has(contentId)) return false;
    contentIds.add(contentId);

    if (!validateStoredMediaPath(item.url, fieldName, 1_024)) return false;
    if (
      !validateMediaMetadata(
        item[policy.metadataKey],
        item,
        fieldName,
        policy
      )
    ) {
      return false;
    }
  }
  return true;
};

const registerMediaUrl = (
  mediaUrl,
  projectId,
  fieldName,
  observedMediaUrls
) => {
  if (observedMediaUrls.has(mediaUrl)) {
    // Identify only the affected row/field. A stored URL may contain historical
    // filenames or other sensitive material and must not enter migration logs.
    projectDataError(projectId, fieldName);
  }
  observedMediaUrls.add(mediaUrl);
};

const validateProjectRow = (
  project,
  expectedDisplayOrder,
  observedMediaUrls = new Set()
) => {
  const projectId = project?.id;
  if (
    !Number.isInteger(projectId) ||
    projectId < 1 ||
    projectId >= Number(MAX_DATABASE_ID)
  ) {
    projectDataError(projectId, 'id');
  }
  if (project.displayOrder !== expectedDisplayOrder) {
    projectDataError(projectId, 'displayOrder');
  }

  const textRules = {
    title: { maxLength: 160, required: true, singleLine: true },
    category: { maxLength: 80, required: true, singleLine: true },
    subtitle: { maxLength: 255, required: true, singleLine: true },
    overview: {
      allowFormatting: true,
      maxBytes: MAX_TEXT_BYTES,
      maxLength: 20_000,
      required: true,
    },
    date: { maxLength: 80, required: true, singleLine: true },
    locationYear: {
      maxLength: 160,
      required: true,
      singleLine: true,
    },
  };
  for (const [fieldName, rules] of Object.entries(textRules)) {
    if (!validateBoundedText(project[fieldName], rules)) {
      projectDataError(projectId, fieldName);
    }
  }

  if (
    typeof project.value !== 'string' ||
    project.value.length > 160 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(project.value)
  ) {
    projectDataError(projectId, 'value');
  }

  for (const fieldName of ['siteLink', 'designLink', 'codeLink']) {
    if (!validateHttpUrl(project[fieldName])) {
      projectDataError(projectId, fieldName);
    }
  }
  if (!validateStringList(project.role, { maxItems: 32, required: true })) {
    projectDataError(projectId, 'role');
  }
  if (
    !validateStringList(project.techStack, {
      maxItems: 64,
      required: false,
    })
  ) {
    projectDataError(projectId, 'techStack');
  }
  if (
    project.bannerImg !== null &&
    project.bannerImg !== '' &&
    !validateStoredMediaPath(project.bannerImg, 'bannerImg', 255)
  ) {
    projectDataError(projectId, 'bannerImg');
  }
  if (project.bannerImg !== null && project.bannerImg !== '') {
    registerMediaUrl(
      project.bannerImg,
      projectId,
      'bannerImg',
      observedMediaUrls
    );
  }
  for (const fieldName of [
    'videos',
    'thumbnailContents',
    'sliderContents',
  ]) {
    if (!validateMediaList(project[fieldName], fieldName)) {
      projectDataError(projectId, fieldName);
    }
    for (const item of parseJson(project[fieldName])) {
      registerMediaUrl(item.url, projectId, fieldName, observedMediaUrls);
    }
  }
};

const validateProjectsInBatches = async (sequelize, Sequelize) => {
  let afterDisplayOrder = -2_147_483_649;
  let afterId = 0;
  let expectedDisplayOrder = 0;
  const observedMediaUrls = new Set();

  while (true) {
    const rows = await sequelize.query(PROJECT_BATCH_SQL, {
      replacements: { afterDisplayOrder, afterId },
      type: Sequelize.QueryTypes.SELECT,
    });
    if (rows.length === 0) return expectedDisplayOrder;

    for (const project of rows) {
      validateProjectRow(
        project,
        expectedDisplayOrder,
        observedMediaUrls
      );
      expectedDisplayOrder += 1;
    }

    const last = rows.at(-1);
    afterDisplayOrder = last.displayOrder;
    afterId = last.id;
    if (rows.length < PROJECT_BATCH_SIZE) return expectedDisplayOrder;
  }
};

const readSchemaSnapshot = async (sequelize, Sequelize) => {
  const queryOptions = {
    replacements: { tableNames: TABLE_NAMES },
    type: Sequelize.QueryTypes.SELECT,
  };
  const [tables, columns, indexes, foreignKeys] = await Promise.all([
    sequelize.query(TABLE_INVENTORY_SQL, queryOptions),
    sequelize.query(COLUMN_INVENTORY_SQL, queryOptions),
    sequelize.query(INDEX_INVENTORY_SQL, queryOptions),
    sequelize.query(FOREIGN_KEY_INVENTORY_SQL, queryOptions),
  ]);

  return { columns, foreignKeys, indexes, tables };
};

const validateSchemaSnapshot = (snapshot) => {
  assertTableContract(snapshot.tables);
  assertColumnContract(snapshot.columns);
  assertIndexContract(snapshot.indexes);
  assertNoForeignKeys(snapshot.foreignKeys);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const snapshot = await readSchemaSnapshot(
      queryInterface.sequelize,
      Sequelize
    );
    validateSchemaSnapshot(snapshot);
    const idRanges = await queryInterface.sequelize.query(ID_RANGE_SQL, {
      type: Sequelize.QueryTypes.SELECT,
    });
    assertIdRanges(idRanges);
    await validateProjectsInBatches(queryInterface.sequelize, Sequelize);
  },

  async down() {
    throw new Error(
      'The schema and project-data preflight is an immutable release ' +
        'checkpoint and is intentionally irreversible.'
    );
  },

  _private: {
    COLUMN_INVENTORY_SQL,
    FOREIGN_KEY_INVENTORY_SQL,
    ID_RANGE_SQL,
    INDEX_INVENTORY_SQL,
    MEDIA_POLICIES,
    PROJECT_BATCH_SIZE,
    PROJECT_BATCH_SQL,
    REQUIRED_INDEXES,
    SCHEMA_CONTRACT,
    TABLE_INVENTORY_SQL,
    TABLE_NAMES,
    assertColumnContract,
    assertIdRanges,
    assertIndexContract,
    assertNoForeignKeys,
    assertTableContract,
    readSchemaSnapshot,
    validateHttpUrl,
    validateMediaList,
    validateProjectRow,
    validateProjectsInBatches,
    validateSchemaSnapshot,
    validateStoredMediaPath,
    validateStringList,
  },
};

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Sequelize = require('sequelize');

const migration = require(
  '../migrations/20260726010000-schema-and-project-data-preflight'
);

const {
  COLUMN_INVENTORY_SQL,
  FOREIGN_KEY_INVENTORY_SQL,
  ID_RANGE_SQL,
  INDEX_INVENTORY_SQL,
  PROJECT_BATCH_SQL,
  REQUIRED_INDEXES,
  SCHEMA_CONTRACT,
  TABLE_INVENTORY_SQL,
  TABLE_NAMES,
} = migration._private;

const columnTypeFor = (definition) => {
  if (definition.dataType === 'varchar') {
    return `varchar(${definition.characterLength})`;
  }
  if (definition.dataType === 'tinyint') return 'tinyint(1)';
  return definition.dataType;
};

const createValidColumns = () =>
  Object.entries(SCHEMA_CONTRACT).flatMap(
    ([tableName, expectedColumns]) =>
      Object.entries(expectedColumns).map(([columnName, definition]) => ({
        characterMaximumLength:
          definition.characterLength === undefined
            ? null
            : String(definition.characterLength),
        characterSet: definition.charset || null,
        collation: definition.collation || null,
        columnDefault: Object.hasOwn(definition, 'defaultValue')
          ? definition.defaultValue
          : null,
        columnName,
        columnType: columnTypeFor(definition),
        dataType: definition.dataType,
        extra: definition.autoIncrement ? 'auto_increment' : '',
        isNullable: definition.nullable ? 'YES' : 'NO',
        tableName,
      }))
  );

const indexNameFor = (tableName, expected, index) => {
  if (expected.primary) return 'PRIMARY';
  return `${tableName}_contract_${index}`;
};

const createValidIndexes = () =>
  Object.entries(REQUIRED_INDEXES).flatMap(([tableName, expectedIndexes]) =>
    expectedIndexes.flatMap((expected, index) => {
      const indexName = indexNameFor(tableName, expected, index);
      return expected.columns.map((columnName, columnIndex) => ({
        columnName,
        indexName,
        indexType: 'BTREE',
        nonUnique: expected.primary || expected.unique ? 0 : 1,
        sequence: columnIndex + 1,
        subPart: null,
        tableName,
      }));
    })
  );

const createValidTables = () =>
  TABLE_NAMES.map((tableName) => ({
    engine: 'InnoDB',
    nextId: tableName === 'SequelizeMeta' ? null : '2',
    tableCollation: 'utf8mb4_unicode_ci',
    tableName,
  }));

const createValidIdRanges = () =>
  ['admins', 'contacts', 'projects', 'settings'].map((tableName) => ({
    maximumId: null,
    minimumId: null,
    tableName,
  }));

const createProject = (displayOrder = 0) => {
  const id = displayOrder + 1;
  return {
    bannerImg: null,
    category: 'all',
    codeLink: 'https://github.com/example/project',
    date: '2026',
    designLink: null,
    displayOrder,
    id,
    locationYear: 'Dhaka — 2026',
    overview: 'A bounded project overview.',
    role: '["Developer"]',
    siteLink: 'https://example.com/project',
    sliderContents: '[]',
    subtitle: 'A project subtitle',
    techStack: '["Node.js"]',
    thumbnailContents: '[]',
    title: `Project ${id}`,
    value: `project-${id}`,
    videos: '[]',
  };
};

const createFixture = ({ projects = [] } = {}) => ({
  columns: createValidColumns(),
  foreignKeys: [],
  idRanges: createValidIdRanges(),
  indexes: createValidIndexes(),
  projects,
  tables: createValidTables(),
});

const createQueryInterface = (fixture) => {
  const calls = [];
  return {
    calls,
    sequelize: {
      async query(sql, options = {}) {
        calls.push({ options, sql });
        if (sql === TABLE_INVENTORY_SQL) return fixture.tables;
        if (sql === COLUMN_INVENTORY_SQL) return fixture.columns;
        if (sql === INDEX_INVENTORY_SQL) return fixture.indexes;
        if (sql === FOREIGN_KEY_INVENTORY_SQL) return fixture.foreignKeys;
        if (sql === ID_RANGE_SQL) return fixture.idRanges;
        if (sql === PROJECT_BATCH_SQL) {
          const { afterDisplayOrder, afterId } = options.replacements;
          return fixture.projects
            .filter(
              (project) =>
                project.displayOrder > afterDisplayOrder ||
                (project.displayOrder === afterDisplayOrder &&
                  project.id > afterId)
            )
            .sort(
              (left, right) =>
                left.displayOrder - right.displayOrder ||
                left.id - right.id
            )
            .slice(0, migration._private.PROJECT_BATCH_SIZE);
        }
        throw new Error(`Unexpected migration query: ${sql}`);
      },
    },
  };
};

test('preflight accepts the exact schema and scans projects in bounded keyset batches', async () => {
  const fixture = createFixture({
    projects: Array.from({ length: 101 }, (_value, index) =>
      createProject(index)
    ),
  });
  fixture.idRanges.find(
    ({ tableName }) => tableName === 'projects'
  ).minimumId = '1';
  fixture.idRanges.find(
    ({ tableName }) => tableName === 'projects'
  ).maximumId = '101';
  const queryInterface = createQueryInterface(fixture);

  await migration.up(queryInterface, Sequelize);

  assert.equal(
    queryInterface.calls.filter(({ sql }) => sql === PROJECT_BATCH_SQL)
      .length,
    2
  );
  assert.equal(
    queryInterface.calls.every(({ sql }) =>
      sql.trimStart().startsWith('SELECT')
    ),
    true
  );
});

test('schema preflight rejects width, auto-increment, charset, and extra-column drift', () => {
  const scenarios = [
    {
      expected: /projects\.title: character capacity must be 255/u,
      mutate(columns) {
        columns.find(
          ({ columnName, tableName }) =>
            tableName === 'projects' && columnName === 'title'
        ).characterMaximumLength = '80';
      },
    },
    {
      expected: /projects\.id: column must be AUTO_INCREMENT/u,
      mutate(columns) {
        columns.find(
          ({ columnName, tableName }) =>
            tableName === 'projects' && columnName === 'id'
        ).extra = '';
      },
    },
    {
      expected: /projects\.overview: character set must be utf8mb4/u,
      mutate(columns) {
        columns.find(
          ({ columnName, tableName }) =>
            tableName === 'projects' && columnName === 'overview'
        ).characterSet = 'utf8mb3';
      },
    },
    {
      expected: /projects: unexpected columns: legacySecret/u,
      mutate(columns) {
        columns.push({
          ...columns.find(
            ({ columnName, tableName }) =>
              tableName === 'projects' && columnName === 'title'
          ),
          columnName: 'legacySecret',
        });
      },
    },
  ];

  for (const scenario of scenarios) {
    const columns = createValidColumns();
    scenario.mutate(columns);
    assert.throws(
      () => migration._private.assertColumnContract(columns),
      scenario.expected
    );
  }
});

test('schema failure stops before any table-data query', async () => {
  const fixture = createFixture({ projects: [createProject()] });
  fixture.columns.find(
    ({ columnName, tableName }) =>
      tableName === 'projects' && columnName === 'title'
  ).characterMaximumLength = '80';
  const queryInterface = createQueryInterface(fixture);

  await assert.rejects(
    () => migration.up(queryInterface, Sequelize),
    /projects\.title: character capacity must be 255/u
  );
  assert.equal(
    queryInterface.calls.some(
      ({ sql }) => sql === ID_RANGE_SQL || sql === PROJECT_BATCH_SQL
    ),
    false
  );
});

test('schema preflight rejects partial, duplicate, and unexpected indexes', () => {
  const partialIndexes = createValidIndexes();
  partialIndexes.find(
    ({ columnName, tableName }) =>
      tableName === 'projects' && columnName === 'value'
  ).subPart = 32;
  assert.throws(
    () => migration._private.assertIndexContract(partialIndexes),
    /projects: required index on \(value\) is missing or ambiguous/u
  );

  const duplicateIndexes = createValidIndexes();
  duplicateIndexes.push({
    ...duplicateIndexes.find(
      ({ columnName, tableName }) =>
        tableName === 'projects' && columnName === 'displayOrder'
    ),
    indexName: 'projects_duplicate_order',
  });
  assert.throws(
    () => migration._private.assertIndexContract(duplicateIndexes),
    /projects: required index on \(displayOrder\) is missing or ambiguous/u
  );

  const unexpectedIndexes = createValidIndexes();
  unexpectedIndexes.push({
    columnName: 'title',
    indexName: 'projects_legacy_title',
    indexType: 'BTREE',
    nonUnique: 1,
    sequence: 1,
    subPart: null,
    tableName: 'projects',
  });
  assert.throws(
    () => migration._private.assertIndexContract(unexpectedIndexes),
    /projects: unexpected indexes: projects_legacy_title/u
  );
});

test('schema preflight rejects foreign keys and unsafe integer ranges', () => {
  assert.throws(
    () =>
      migration._private.assertNoForeignKeys([
        {
          columnName: 'projectId',
          constraintName: 'legacy_project_fk',
          tableName: 'contacts',
        },
      ]),
    /contacts\.projectId: unexpected foreign key legacy_project_fk/u
  );

  const ranges = createValidIdRanges();
  const projects = ranges.find(({ tableName }) => tableName === 'projects');
  projects.minimumId = '1';
  projects.maximumId = '2147483647';
  assert.throws(
    () => migration._private.assertIdRanges(ranges),
    /projects\.id: id range is exhausted or invalid/u
  );
});

test('legacy and current media metadata remain valid when paths are contained', () => {
  const videoPath =
    'uploads/projects/legacy-project/videos/videos_legacy@1700000000000.mp4';
  const videos = JSON.stringify([
    {
      id: '1@1700000000000',
      serverVid: {
        destination: 'uploads/projects/legacy-project/videos',
        fieldname: 'videos',
        filename: 'videos_legacy@1700000000000.mp4',
        mimetype: 'video/mp4',
        originalname: 'demo.mp4',
        path: videoPath,
        size: 1_024,
      },
      url: videoPath,
    },
  ]);

  assert.equal(
    migration._private.validateMediaList(videos, 'videos'),
    true
  );
});

test('project preflight rejects duplicate media URLs within and across projects without exposing them', async () => {
  const duplicateWithinProject =
    'uploads/projects/legacy/thumbnailContents/private-duplicate.webp';
  const projectWithDuplicateItems = createProject(0);
  projectWithDuplicateItems.thumbnailContents = JSON.stringify([
    { id: 'thumbnail-1', url: duplicateWithinProject },
    { id: 'thumbnail-2', url: duplicateWithinProject },
  ]);

  await assert.rejects(
    () =>
      migration.up(
        createQueryInterface(
          createFixture({ projects: [projectWithDuplicateItems] })
        ),
        Sequelize
      ),
    (error) => {
      assert.equal(
        error.message,
        'Project data preflight failed for id 1 field thumbnailContents'
      );
      assert.equal(error.message.includes(duplicateWithinProject), false);
      return true;
    }
  );

  const duplicateAcrossProjects =
    'uploads/projects/legacy/videos/private-shared.mp4';
  const firstProject = createProject(0);
  const secondProject = createProject(1);
  firstProject.videos = JSON.stringify([
    { id: 'first-video', url: duplicateAcrossProjects },
  ]);
  secondProject.videos = JSON.stringify([
    { id: 'second-video', url: duplicateAcrossProjects },
  ]);

  await assert.rejects(
    () =>
      migration.up(
        createQueryInterface(
          createFixture({ projects: [firstProject, secondProject] })
        ),
        Sequelize
      ),
    (error) => {
      assert.equal(
        error.message,
        'Project data preflight failed for id 2 field videos'
      );
      assert.equal(error.message.includes(duplicateAcrossProjects), false);
      return true;
    }
  );
});

test('project preflight fails closed with project id and field only', () => {
  const scenarios = [
    {
      field: 'value',
      secret: 'Invalid Public Slug',
      mutate(project) {
        project.value = this.secret;
      },
    },
    {
      field: 'siteLink',
      secret: 'ftp://user:password@example.com/private',
      mutate(project) {
        project.siteLink = this.secret;
      },
    },
    {
      field: 'overview',
      secret: '🙂'.repeat(15_001),
      mutate(project) {
        project.overview = this.secret;
      },
    },
    {
      field: 'role',
      secret: '[{"legacy":true}]',
      mutate(project) {
        project.role = this.secret;
      },
    },
    {
      field: 'techStack',
      secret: '["Node.js"," Node.js "]',
      mutate(project) {
        project.techStack = this.secret;
      },
    },
    {
      field: 'videos',
      secret:
        'uploads/projects/legacy/videos/demo.mp4?access_token=do-not-log',
      mutate(project) {
        project.videos = JSON.stringify([
          { id: 'video-1', url: this.secret },
        ]);
      },
    },
    {
      field: 'thumbnailContents',
      secret: 'duplicate-thumbnail-id',
      mutate(project) {
        project.thumbnailContents = JSON.stringify([
          {
            id: this.secret,
            url: 'uploads/projects/legacy/thumbnailContents/one.webp',
          },
          {
            id: this.secret,
            url: 'uploads/projects/legacy/thumbnailContents/two.webp',
          },
        ]);
      },
    },
    {
      field: 'bannerImg',
      secret: 'uploads/projects/legacy/bannerImg/cover.webp#fragment',
      mutate(project) {
        project.bannerImg = this.secret;
      },
    },
  ];

  for (const scenario of scenarios) {
    const project = { ...createProject(0), id: 7 };
    scenario.mutate(project);
    assert.throws(
      () => migration._private.validateProjectRow(project, 0),
      (error) => {
        assert.equal(
          error.message,
          `Project data preflight failed for id 7 field ${scenario.field}`
        );
        assert.equal(error.message.includes(scenario.secret), false);
        return true;
      }
    );
  }
});

test('project preflight requires a contiguous deterministic display order', () => {
  const project = { ...createProject(0), displayOrder: 2, id: 9 };
  assert.throws(
    () => migration._private.validateProjectRow(project, 0),
    /Project data preflight failed for id 9 field displayOrder/u
  );
});

test('preflight checkpoint cannot be reversed', async () => {
  await assert.rejects(
    () => migration.down(),
    /immutable release checkpoint.*intentionally irreversible/u
  );
});

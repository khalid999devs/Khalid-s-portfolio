/**
 * Migration script to add displayOrder column to projects table
 * Run this script once to update your existing database
 */

const { Sequelize, QueryTypes } = require('sequelize');
const config = require('../config/config');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: false,
  }
);

async function migrate() {
  try {
    console.log('Starting migration: Adding displayOrder column...');

    // Test connection
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Check if column already exists
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM projects LIKE 'displayOrder'",
      { type: QueryTypes.SELECT }
    );

    if (columns) {
      console.log('displayOrder column already exists. Skipping...');
      return;
    }

    // Add the displayOrder column
    await sequelize.query(
      'ALTER TABLE projects ADD COLUMN displayOrder INT NOT NULL DEFAULT 0'
    );

    console.log('displayOrder column added successfully.');

    // Update existing projects to have sequential displayOrder based on their id
    await sequelize.query('SET @row_number = -1');
    await sequelize.query(`
      UPDATE projects 
      SET displayOrder = (@row_number:=@row_number + 1) 
      ORDER BY id ASC
    `);

    console.log(
      'Existing projects updated with sequential displayOrder values.'
    );

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run migration
migrate();

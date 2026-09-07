'use strict';

/** Ensure communication_attachments.id auto-generates (legacy schema had PK without serial). */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'S' AND c.relname = 'communication_attachments_id_seq'
          ) THEN
            CREATE SEQUENCE communication_attachments_id_seq;
          END IF;
        END $$;
      `);
      await queryInterface.sequelize.query(`
        SELECT setval(
          'communication_attachments_id_seq',
          GREATEST(COALESCE((SELECT MAX(id) FROM communication_attachments), 0), 1)
        );
      `);
      await queryInterface.sequelize.query(`
        ALTER TABLE communication_attachments
          ALTER COLUMN id SET DEFAULT nextval('communication_attachments_id_seq');
      `);
      await queryInterface.sequelize.query(`
        ALTER SEQUENCE communication_attachments_id_seq OWNED BY communication_attachments.id;
      `);
      return;
    }

    if (dialect === 'mysql' || dialect === 'mariadb') {
      await queryInterface.sequelize.query(`
        ALTER TABLE communication_attachments
        MODIFY id INT NOT NULL AUTO_INCREMENT;
      `);
    }
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        ALTER TABLE communication_attachments ALTER COLUMN id DROP DEFAULT;
      `);
    }
  },
};

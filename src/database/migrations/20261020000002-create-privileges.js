"use strict";

const {
  PRIVILEGE_DEFINITIONS,
  DEFAULT_ROLE_PRIVILEGES,
} = require("../privilegeCatalog");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("privileges", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: "capability",
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.createTable("role_privileges", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      role_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "roles", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      privilege_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "privileges", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("role_privileges", ["role_id", "privilege_id"], {
      unique: true,
      name: "role_privileges_role_privilege_unique",
    });

    const now = new Date();
    await queryInterface.bulkInsert(
      "privileges",
      PRIVILEGE_DEFINITIONS.map((item) => ({
        code: item.code,
        name: item.name,
        description: item.description,
        category: item.category,
        sort_order: item.sort_order,
        created_at: now,
        updated_at: now,
      }))
    );

    const [privRows] = await queryInterface.sequelize.query(
      "SELECT id, code FROM privileges"
    );
    const privilegeIdByCode = {};
    for (const row of privRows) privilegeIdByCode[row.code] = row.id;

    const ensureRole = async (roleName) => {
      const [existing] = await queryInterface.sequelize.query(
        "SELECT id, role_name FROM roles WHERE LOWER(role_name) = LOWER(:name) LIMIT 1",
        { replacements: { name: roleName } }
      );
      if (existing && existing[0]) return existing[0].id;
      await queryInterface.bulkInsert("roles", [
        {
          role_name: roleName,
          description: `Seeded for privilege defaults (${roleName})`,
          created_at: now,
        },
      ]);
      const [created] = await queryInterface.sequelize.query(
        "SELECT id FROM roles WHERE LOWER(role_name) = LOWER(:name) LIMIT 1",
        { replacements: { name: roleName } }
      );
      return created[0].id;
    };

    const rolePrivilegeRows = [];
    for (const [roleName, codes] of Object.entries(DEFAULT_ROLE_PRIVILEGES)) {
      const roleId = await ensureRole(roleName);
      const seen = new Set();
      for (const code of codes) {
        const privilegeId = privilegeIdByCode[code];
        if (!privilegeId || seen.has(privilegeId)) continue;
        seen.add(privilegeId);
        rolePrivilegeRows.push({
          role_id: roleId,
          privilege_id: privilegeId,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (rolePrivilegeRows.length) {
      const chunk = 200;
      for (let i = 0; i < rolePrivilegeRows.length; i += chunk) {
        await queryInterface.bulkInsert(
          "role_privileges",
          rolePrivilegeRows.slice(i, i + chunk)
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("role_privileges");
    await queryInterface.dropTable("privileges");
  },
};

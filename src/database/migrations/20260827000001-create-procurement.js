'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("procurements", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      reference_no: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      supplier_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
        defaultValue: 0,
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: "RWF",
      },
      status: {
        type: Sequelize.ENUM("draft", "recorded", "in_progress", "completed", "cancelled"),
        allowNull: false,
        defaultValue: "recorded",
      },
      requested_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      expected_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      completed_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
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

    await queryInterface.createTable("procurement_documents", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      procurement_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "procurements", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      file_path: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      mime_type: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
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

    await queryInterface.createTable("procurement_notes", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      procurement_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "procurements", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
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

    await queryInterface.addIndex("procurements", ["status"], { name: "procurements_status" });
    await queryInterface.addIndex("procurements", ["created_by"], { name: "procurements_created_by" });
    await queryInterface.addIndex("procurements", ["category"], { name: "procurements_category" });
    await queryInterface.addIndex("procurement_documents", ["procurement_id"], {
      name: "procurement_documents_procurement_id",
    });
    await queryInterface.addIndex("procurement_notes", ["procurement_id"], {
      name: "procurement_notes_procurement_id",
    });

    // Ensure role exists for assignment in Users Management
    try {
      const [rows] = await queryInterface.sequelize.query(
        "SELECT id FROM roles WHERE LOWER(role_name) IN ('procurement officer', 'procurement') LIMIT 1"
      );
      if (!rows?.length) {
        await queryInterface.bulkInsert("roles", [
          {
            role_name: "Procurement Officer",
            description: "Records and manages procurement dashboard data and documents",
            created_at: new Date(),
          },
        ]);
      }
    } catch {
      // roles table may differ in some environments — ignore seed failure
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("procurement_notes");
    await queryInterface.dropTable("procurement_documents");
    await queryInterface.dropTable("procurements");
  },
};

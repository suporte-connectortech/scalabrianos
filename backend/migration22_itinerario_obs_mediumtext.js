const pool = require('./db');

async function poolMigration22() {
  try {
    console.log("Starting Migration 22: itinerary observacoes without length limit (MEDIUMTEXT)...");

    const [cols] = await pool.query(`
      SELECT DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'tb_itinerario_formativo' 
        AND COLUMN_NAME = 'observacoes'
    `);

    if (cols.length === 0) {
      await pool.query("ALTER TABLE tb_itinerario_formativo ADD COLUMN observacoes MEDIUMTEXT DEFAULT NULL");
      console.log("observacoes column created as MEDIUMTEXT.");
    } else if (!['mediumtext', 'longtext'].includes(String(cols[0].DATA_TYPE).toLowerCase())) {
      await pool.query("ALTER TABLE tb_itinerario_formativo MODIFY COLUMN observacoes MEDIUMTEXT DEFAULT NULL");
      console.log("observacoes column changed to MEDIUMTEXT.");
    } else {
      console.log("observacoes column already supports long text.");
    }

    console.log("Migration 22 completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration 22 failed:", error);
    process.exit(1);
  }
}

poolMigration22();

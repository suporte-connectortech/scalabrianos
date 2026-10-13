const pool = require('./db');

const TRANSFERIDO_COLUMNS = [
  { name: 'transferido_data_inicio', sql: 'ALTER TABLE tb_dados_situacao ADD COLUMN transferido_data_inicio DATE DEFAULT NULL' },
  { name: 'transferido_data_fim', sql: 'ALTER TABLE tb_dados_situacao ADD COLUMN transferido_data_fim DATE DEFAULT NULL' },
  { name: 'transferido_origem', sql: 'ALTER TABLE tb_dados_situacao ADD COLUMN transferido_origem VARCHAR(255) DEFAULT NULL' },
  { name: 'transferido_destino', sql: 'ALTER TABLE tb_dados_situacao ADD COLUMN transferido_destino VARCHAR(255) DEFAULT NULL' },
  { name: 'transferido_doc_path', sql: 'ALTER TABLE tb_dados_situacao ADD COLUMN transferido_doc_path TEXT DEFAULT NULL' },
  { name: 'transferido_observacao', sql: 'ALTER TABLE tb_dados_situacao ADD COLUMN transferido_observacao TEXT DEFAULT NULL' },
];

async function poolMigration21() {
  try {
    console.log("Starting Migration 21: adding 'Transferido' situation...");

    // 1. Add TRANSFERIDO to tb_usuarios.situacao ENUM (keeping existing values)
    const [sitCols] = await pool.query(`SHOW COLUMNS FROM tb_usuarios LIKE 'situacao'`);
    const type = sitCols[0]?.Type || '';
    if (type.toLowerCase().startsWith('enum(') && !type.toUpperCase().includes("'TRANSFERIDO'")) {
      const values = (type.match(/'([^']*)'/g) || []).map(v => v.slice(1, -1));
      values.push('TRANSFERIDO');
      const enumSql = values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
      await pool.query(`ALTER TABLE tb_usuarios MODIFY COLUMN situacao ENUM(${enumSql}) DEFAULT 'ATIVO'`);
      console.log('TRANSFERIDO added to tb_usuarios.situacao.');
    } else {
      console.log('tb_usuarios.situacao already accepts TRANSFERIDO.');
    }

    // 2. Add transfer columns to tb_dados_situacao
    for (const column of TRANSFERIDO_COLUMNS) {
      const [cols] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'tb_dados_situacao'
          AND COLUMN_NAME = ?
      `, [column.name]);

      if (cols.length === 0) {
        await pool.query(column.sql);
        console.log(`Added ${column.name}.`);
      } else {
        console.log(`${column.name} already exists.`);
      }
    }

    console.log('Migration 21 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration 21 failed:', error);
    process.exit(1);
  }
}

poolMigration21();

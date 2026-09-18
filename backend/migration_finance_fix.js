const db = require('./db');

async function migrate() {
  try {
    console.log('Starting financial tables update migration...');

    // 1. Add 'codigo' and 'perfil' to tb_categorias_financas
    console.log('Updating tb_categorias_financas schema...');
    await db.query(`
      ALTER TABLE tb_categorias_financas 
      ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) AFTER id,
      ADD COLUMN IF NOT EXISTS perfil ENUM('PERFIL_1', 'PERFIL_2', 'ANUAL', 'PLANEJAMENTO') DEFAULT 'PERFIL_1' AFTER tipo;
    `);

    // 2. Add anexo_path to monthly spreadsheets
    console.log('Updating tb_financas_mensais schema...');
    await db.query(`
      ALTER TABLE tb_financas_mensais 
      ADD COLUMN IF NOT EXISTS anexo_path VARCHAR(500) AFTER apontamentos,
      ADD COLUMN IF NOT EXISTS num_missas_superior INT DEFAULT 0 AFTER anexo_path;
    `);

    // 3. Create table for Community Monthly Spreadsheet (Perfil 2)
    // Currently Perfil 2 might be using tb_financas_casa, but the image shows a spreadsheet format.
    // Let's create a specific table for consolidated community monthly reports if needed, 
    // or adapt tb_financas_consolidado.
    console.log('Updating tb_financas_consolidado schema...');
    await db.query(`
      ALTER TABLE tb_financas_consolidado
      ADD COLUMN IF NOT EXISTS anexo_path VARCHAR(500) AFTER apontamentos_superior,
      ADD COLUMN IF NOT EXISTS total_credito DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_debito DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS num_missas_superior INT DEFAULT 0;
    `);

    // 4. Create items table for consolidated house report (to support the spreadsheet view in Perfil 2)
    await db.query(`
      CREATE TABLE IF NOT EXISTS tb_financas_consolidado_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        consolidado_id INT NOT NULL,
        categoria_id INT NOT NULL,
        valor DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (consolidado_id) REFERENCES tb_financas_consolidado(id) ON DELETE CASCADE,
        FOREIGN KEY (categoria_id) REFERENCES tb_categorias_financas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 5. Create tables for Situation 2 (Planning) and 3 (Annual)
    console.log('Creating tables for Situation 2 and 3...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS tb_planejamento_orcamentario (
        id INT AUTO_INCREMENT PRIMARY KEY,
        casa_id INT NOT NULL,
        ano INT NOT NULL,
        status ENUM('RASCUNHO', 'ENVIADO', 'APROVADO') DEFAULT 'RASCUNHO',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY house_year (casa_id, ano),
        FOREIGN KEY (casa_id) REFERENCES tb_casas_religiosas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS tb_planejamento_orcamentario_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        planejamento_id INT NOT NULL,
        categoria_id INT NOT NULL,
        mes_1 DECIMAL(10,2) DEFAULT 0,
        mes_2 DECIMAL(10,2) DEFAULT 0,
        mes_3 DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (planejamento_id) REFERENCES tb_planejamento_orcamentario(id) ON DELETE CASCADE,
        FOREIGN KEY (categoria_id) REFERENCES tb_categorias_financas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS tb_prestacao_contas_anual (
        id INT AUTO_INCREMENT PRIMARY KEY,
        casa_id INT NOT NULL,
        ano INT NOT NULL,
        status ENUM('RASCUNHO', 'ENVIADO', 'APROVADO') DEFAULT 'RASCUNHO',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY house_year_anual (casa_id, ano),
        FOREIGN KEY (casa_id) REFERENCES tb_casas_religiosas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS tb_prestacao_contas_anual_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prestacao_id INT NOT NULL,
        categoria_id INT NOT NULL,
        valor DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (prestacao_id) REFERENCES tb_prestacao_contas_anual(id) ON DELETE CASCADE,
        FOREIGN KEY (categoria_id) REFERENCES tb_categorias_financas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 6. Clear and re-populate categories with codes
    console.log('Populating categories from images...');
    // We should probably keep existing if they are used, but for a clean start on the new system:
    // await db.query('DELETE FROM tb_categorias_financas'); // Dangerous if data exists

    const categories = [
      // Perfil 1 - Receitas
      ['11.11', 'Saldo anterior', 'CREDITO', 'PERFIL_1'],
      ['11.11', 'Recebido pelo Superior/ecônomo', 'CREDITO', 'PERFIL_1'],
      ['31.1', 'Missas celebradas ad mentem offerentis', 'CREDITO', 'PERFIL_1'],
      ['31.2', 'Atividades de ministério', 'CREDITO', 'PERFIL_1'],
      ['31.3', 'Remuneração/côngruas', 'CREDITO', 'PERFIL_1'],
      ['31.4', 'Aposentadorias', 'CREDITO', 'PERFIL_1'],
      ['31.5', 'Doações', 'CREDITO', 'PERFIL_1'],
      ['32.1', 'Reembolsos de atividades', 'CREDITO', 'PERFIL_1'],
      ['32.2', 'Reembolsos de viagens', 'CREDITO', 'PERFIL_1'],
      ['32.3', 'Reembolsos de seguro', 'CREDITO', 'PERFIL_1'],
      ['31.6', 'Várias', 'CREDITO', 'PERFIL_1'],
      
      // Perfil 1 - Despesas
      ['41.2', 'Saúde (médico, remédios)', 'DEBITO', 'PERFIL_1'],
      ['41.4', 'Alimentação pessoal', 'DEBITO', 'PERFIL_1'],
      ['41.5', 'Material de higiene / limpeza', 'DEBITO', 'PERFIL_1'],
      ['41.6', 'Livros, formação (permanente/específica)', 'DEBITO', 'PERFIL_1'],
      ['41.7', 'Férias', 'DEBITO', 'PERFIL_1'],
      ['42.2', 'Reuniões, assembleias', 'DEBITO', 'PERFIL_1'],
      ['42.7', 'Documentos, vistos...', 'DEBITO', 'PERFIL_1'],
      ['42.15', 'Viagens (transporte, combustível, multas)', 'DEBITO', 'PERFIL_1'],
      ['42.13', 'Telefone, internet, correio...', 'DEBITO', 'PERFIL_1'],
      ['42.17', 'Equipamentos, móveis e utensílios', 'DEBITO', 'PERFIL_1'],
      ['44.1', 'Doações e caridade', 'DEBITO', 'PERFIL_1'],
      ['43.6', 'Taxas bancárias', 'DEBITO', 'PERFIL_1'],
      ['41.9', 'Outras despesas', 'DEBITO', 'PERFIL_1'],
      ['11.11', 'Entregue ao Superior/ecônomo', 'DEBITO', 'PERFIL_1'],

      // Perfil 2 - Receitas
      ['31.1', 'Missas celebradas', 'CREDITO', 'PERFIL_2'],
      ['31.2', 'Atividades de ministério', 'CREDITO', 'PERFIL_2'],
      ['31.3', 'Remuneração/côngruas', 'CREDITO', 'PERFIL_2'],
      ['31.4', 'Aposentadorias', 'CREDITO', 'PERFIL_2'],
      ['31.5', 'Doações', 'CREDITO', 'PERFIL_2'],
      ['32.1', 'Reembolsos de atividades', 'CREDITO', 'PERFIL_2'],
      ['32.2', 'Reembolsos de viagens', 'CREDITO', 'PERFIL_2'],
      ['32.3', 'Reembolsos de seguro', 'CREDITO', 'PERFIL_2'],
      ['33.2', 'Vendas de bens', 'CREDITO', 'PERFIL_2'],
      ['33.4', 'Aluguéis de propriedades e imóveis', 'CREDITO', 'PERFIL_2'],
      ['33.6', 'Juros bancários', 'CREDITO', 'PERFIL_2'],
      ['45.3', 'Remessa da Dir. Reg. para a “comunidade”', 'CREDITO', 'PERFIL_2'],
      ['45.4', 'Remessa da Dir. Reg. para “animação vocacional”', 'CREDITO', 'PERFIL_2'],
      ['45.5', 'Remessa da Dir. Reg. para “seminário”', 'CREDITO', 'PERFIL_2'],
      ['45.6', 'Remessa da Dir. Reg. para “religiosos idosos”', 'CREDITO', 'PERFIL_2'],
      ['45.8', 'Remessa da Dir. Reg. para “centro de estudo/comunicação social”', 'CREDITO', 'PERFIL_2'],
      ['31.6', 'Outras receitas', 'CREDITO', 'PERFIL_2'],

      // Perfil 2 - Despesas
      ['41.2', 'Saúde (médico, remédios)', 'DEBITO', 'PERFIL_2'],
      ['41.3', 'Seguros', 'DEBITO', 'PERFIL_2'],
      ['41.4', 'Alimentação', 'DEBITO', 'PERFIL_2'],
      ['41.5', 'Material de higiene/limpeza', 'DEBITO', 'PERFIL_2'],
      ['41.6', 'Livros, formação (permanente/específica)', 'DEBITO', 'PERFIL_2'],
      ['41.7', 'Férias', 'DEBITO', 'PERFIL_2'],
      ['41.8', 'Empregados', 'DEBITO', 'PERFIL_2'],
      ['42.02', 'Reuniões, assembleias', 'DEBITO', 'PERFIL_2'],
      ['42.07', 'Taxas administrativas (impostos, vistos...)', 'DEBITO', 'PERFIL_2'],
      ['42.12', 'Serviços terceirizados (assessorias, advogados)', 'DEBITO', 'PERFIL_2'],
      ['42.13', 'Telefone, internet, correio...', 'DEBITO', 'PERFIL_2'],
      ['42.15', 'Viagens (transporte, combustível, multas)', 'DEBITO', 'PERFIL_2'],
      ['42.16', 'Veículos (manutenção, impostos, seguros)', 'DEBITO', 'PERFIL_2'],
      ['42.17', 'Equipamentos, móveis e utensílios', 'DEBITO', 'PERFIL_2'],
      ['42.18', 'Serviços (água, eletricidade, gás, lixo etc.)', 'DEBITO', 'PERFIL_2'],
      ['43.01', 'Imóveis: manutenção ordinária de imóveis', 'DEBITO', 'PERFIL_2'],
      ['43.02', 'Imóveis: reformas e consertos extraordinários', 'DEBITO', 'PERFIL_2'],
      ['43.04', 'Imóveis: seguros', 'DEBITO', 'PERFIL_2'],
      ['43.05', 'Imóveis: impostos e taxas', 'DEBITO', 'PERFIL_2'],
      ['43.06', 'Taxas bancárias', 'DEBITO', 'PERFIL_2'],
      ['44.01', 'Doações e caridade', 'DEBITO', 'PERFIL_2'],
      ['41.9', 'Outras despesas', 'DEBITO', 'PERFIL_2'],

      // Planejamento
      ['1', 'Receitas Mensais - Atividade', 'CREDITO', 'PLANEJAMENTO'],
      ['1', 'Receitas Mensais - Patrimoniais e Financeiras', 'CREDITO', 'PLANEJAMENTO'],
      ['1', 'Receitas Mensais - Contribuições Externas', 'CREDITO', 'PLANEJAMENTO'],
      ['1', 'Receitas Mensais - Repasse da Matriz', 'CREDITO', 'PLANEJAMENTO'],
      ['1', 'Receitas Mensais - Outras', 'CREDITO', 'PLANEJAMENTO'],
      ['2', 'Despesas Mensais - Atividade', 'DEBITO', 'PLANEJAMENTO'],
      ['2', 'Despesas Mensais - Patrimoniais e Financeiras', 'DEBITO', 'PLANEJAMENTO'],
      ['2', 'Despesas Mensais - Contribuições Externas', 'DEBITO', 'PLANEJAMENTO'],
      ['2', 'Despesas Mensais - Outras', 'DEBITO', 'PLANEJAMENTO'],

      // Anual
      ['30', 'RECEITAS - Recebimento das atividades sociais', 'CREDITO', 'ANUAL'],
      ['30', 'RECEITAS - Rendimentos bancários e alugueis', 'CREDITO', 'ANUAL'],
      ['30', 'RECEITAS - Doações recebidas', 'CREDITO', 'ANUAL'],
      ['40', 'DESPESAS - Gastos com atividades da obra', 'DEBITO', 'ANUAL'],
      ['40', 'DESPESAS - Gastos com imóveis', 'DEBITO', 'ANUAL'],
      ['40', 'DESPESAS - Doações realizadas', 'DEBITO', 'ANUAL'],
      ['40', 'DESPESAS - Repasses para a Congregação', 'DEBITO', 'ANUAL'],
      ['10', 'PATRIMÔNIO - Valor disponível', 'CREDITO', 'ANUAL'],
      ['10', 'PATRIMÔNIO - Investimentos e aplicações', 'CREDITO', 'ANUAL'],
      ['10', 'PATRIMÔNIO - Créditos internos à CS', 'CREDITO', 'ANUAL'],
      ['10', 'PATRIMÔNIO - Créditos Externos', 'CREDITO', 'ANUAL'],
      ['20', 'PASSIVO - Dívida para com a Congregação', 'DEBITO', 'ANUAL'],
      ['20', 'PASSIVO - Dívidas para com outras instituições (curto)', 'DEBITO', 'ANUAL'],
      ['20', 'PASSIVO - Dívidas para com outras instituições (longo)', 'DEBITO', 'ANUAL'],
      ['20', 'PASSIVO - Fundos para provisão de pagamentos', 'DEBITO', 'ANUAL']
    ];

    for (const [codigo, nome, tipo, perfil] of categories) {
      // Check if exists to avoid duplicates if re-run
      const [exists] = await db.query('SELECT id FROM tb_categorias_financas WHERE nome = ? AND perfil = ?', [nome, perfil]);
      if (exists.length === 0) {
        await db.query('INSERT INTO tb_categorias_financas (codigo, nome, tipo, perfil) VALUES (?, ?, ?, ?)', [codigo, nome, tipo, perfil]);
      } else {
        await db.query('UPDATE tb_categorias_financas SET codigo = ? WHERE id = ?', [codigo, exists[0].id]);
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { sendWelcomeEmail, sendFirstAccessNotification, sendPasswordResetEmail } = require('./emailService');
const { validateCNPJ, formatCNPJ, cleanCNPJ } = require('./cnpjHelper');
require('dotenv').config();

const os = require('os');

// Helper to get a writable uploads directory (handles read-only filesystems like Vercel/Lambda)
const getUploadsDir = () => {
  const localDir = path.join(__dirname, 'uploads', 'documentos');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, `.write_test_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return localDir;
  } catch (err) {
    const tmpDir = path.join(os.tmpdir(), 'uploads', 'documentos');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
};

// Multer configuration for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = getUploadsDir();
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido. Use PDF, JPG ou PNG.'));
  }
});

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      'http://localhost:5173', 
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175',
      'https://scalabrinianos.dev.connectortech.com.br',
      'https://gestao.scalabrinianos.com',
      'https://www.gestao.scalabrinianos.com'
    ];
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.includes('vercel.app') || origin.includes('scalabrinianos.com')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// Method override middleware to allow PUT/DELETE via POST with custom header (avoiding 403 firewall blocks)
app.use((req, res, next) => {
  const methodOverride = req.headers['x-http-method-override'] || req.query['_method'];
  if (req.method === 'POST' && methodOverride) {
    const targetMethod = methodOverride.toUpperCase();
    if (['PUT', 'DELETE', 'PATCH'].includes(targetMethod)) {
      req.method = targetMethod;
    }
  }
  next();
});

// Robust file streamer for uploaded files (supporting all /api/uploads, /uploads, /documentos prefixes and direct file requests)
const serveUploadedFile = (req, res, next) => {
  let reqPath = req.path || '';
  try {
    reqPath = decodeURIComponent(reqPath);
  } catch (e) {}

  if (reqPath.startsWith('/api/uploads')) {
    reqPath = reqPath.replace(/^\/api\/uploads/, '');
  } else if (reqPath.startsWith('/uploads')) {
    reqPath = reqPath.replace(/^\/uploads/, '');
  } else if (reqPath.startsWith('/api/documentos')) {
    reqPath = reqPath.replace(/^\/api\/documentos/, '');
  } else if (reqPath.startsWith('/documentos')) {
    reqPath = reqPath.replace(/^\/documentos/, '');
  }
  
  // Sanitize relative path
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]+/, '');
  const filename = path.basename(safePath);

  if (!filename || filename === '.' || filename === '/') {
    return next();
  }

  // Candidate directories where uploads might be stored across different production environments
  const candidateDirs = [
    process.env.UPLOADS_DIR,
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads', 'documentos'),
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'uploads', 'documentos'),
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'uploads', 'documentos'),
    path.join(process.cwd(), 'backend', 'uploads'),
    path.join(process.cwd(), 'backend', 'uploads', 'documentos'),
    path.join(os.tmpdir(), 'uploads'),
    path.join(os.tmpdir(), 'uploads', 'documentos'),
    path.join(os.tmpdir(), 'scalabrianos', 'uploads'),
    path.join(os.tmpdir(), 'scalabrianos', 'uploads', 'documentos')
  ].filter(Boolean);

  const setServeHeaders = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  };

  for (const baseDir of candidateDirs) {
    // 1. Try direct relative sub-path (e.g. baseDir + '/documentos/doc_123.pdf')
    const fullPath1 = path.join(baseDir, safePath);
    if (fs.existsSync(fullPath1)) {
      try {
        if (fs.statSync(fullPath1).isFile()) {
          setServeHeaders();
          return res.sendFile(path.resolve(fullPath1));
        }
      } catch (e) {}
    }

    // 2. Try direct filename (e.g. baseDir + '/doc_123.pdf')
    const fullPath2 = path.join(baseDir, filename);
    if (fs.existsSync(fullPath2)) {
      try {
        if (fs.statSync(fullPath2).isFile()) {
          setServeHeaders();
          return res.sendFile(path.resolve(fullPath2));
        }
      } catch (e) {}
    }
  }

  // If not found in any folder, log diagnostic and return explicit error message
  console.warn(`[UPLOAD_404] Document not found: "${safePath}" (filename: "${filename}") in searched directories`);
  return res.status(404).json({
    error: 'Documento não encontrado no servidor',
    filename: filename,
    path: req.originalUrl,
    hint: 'Verifique se o arquivo foi enviado corretamente ou reenvie o anexo.'
  });
};

app.use('/api/uploads', serveUploadedFile);
app.use('/uploads', serveUploadedFile);
app.use('/api/documentos', serveUploadedFile);
app.use('/documentos', serveUploadedFile);

// Also intercept any direct GET request for uploaded doc patterns (e.g. /doc_*.pdf or ending in typical doc formats)
app.get(/\/uploads\/.*|\/documentos\/.*|\/doc_[0-9]+.*\.(pdf|jpg|jpeg|png|webp)/i, serveUploadedFile);

// Diagnostic logging for all requests
app.use((req, res, next) => {
  console.log(`[BACKEND] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});
const JWT_SECRET = process.env.JWT_SECRET || 'scalabrianos-secret-key-2026-super-secure';

const HIDDEN_TEST_USERS = [
  'felipisousa604@gmail.com',
  'missionario.egresso@teste.com',
  'felipe@teste.com',
  'economo.regional@teste.com'
];
const HIDDEN_USERS_SQL = "LOWER(TRIM(login)) NOT IN ('felipisousa604@gmail.com', 'missionario.egresso@teste.com', 'felipe@teste.com', 'economo.regional@teste.com')";
const HIDDEN_USERS_ALIAS_SQL = (alias = 'u') => `LOWER(TRIM(${alias}.login)) NOT IN ('felipisousa604@gmail.com', 'missionario.egresso@teste.com', 'felipe@teste.com', 'economo.regional@teste.com')`;

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Acesso negado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Health check (Enhanced for diagnostic)
app.use(['/api/health', '/health'], (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '3.0.0-FINAL-FIX', 
    message: 'API ATUALIZADA - SE VOCE VE ISSO O RESTART FUNCIONOU',
    method: req.method,
    url: req.originalUrl
  });
});

// Logs helper function
async function logAction(usuarioId, acao, tabela, detalhes) {
  try {
    await db.query('INSERT INTO tb_logs (usuario_id, acao, entidade, detalhes) VALUES (?, ?, ?, ?)', [usuarioId, acao, tabela, detalhes]);
  } catch (err) { console.error('Error logging action:', err); }
}

async function createNotification(usuarioId, mensagem, tipo = 'INFO', linkPath = null) {
  try {
    await db.query('INSERT INTO tb_notificacoes (usuario_id, mensagem, tipo, link_path) VALUES (?, ?, ?, ?)', [usuarioId, mensagem, tipo, linkPath]);
  } catch (err) { console.error('Error creating notification:', err); }
};

async function logAccess(usuarioId, tipo, req, detalhes) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await db.query('INSERT INTO tb_logs_acesso (usuario_id, tipo, ip_address, detalhes) VALUES (?, ?, ?, ?)', [usuarioId, tipo, ip, detalhes]);
  } catch (err) { console.error('Error logging access:', err); }
}

let schemaEnsured = false;
async function ensureOptionalSchema() {
  if (schemaEnsured) return;
  schemaEnsured = true;
  try {
    // 1. Ensure tb_dados_situacao table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS tb_dados_situacao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL UNIQUE,
        data_falecimento DATE DEFAULT NULL,
        cidade_falecimento VARCHAR(255) DEFAULT NULL,
        certidao_obito_path VARCHAR(500) DEFAULT NULL,
        local_sepultamento VARCHAR(255) DEFAULT NULL,
        egresso_incardinado_path VARCHAR(500) DEFAULT NULL,
        egresso_desistencia_path VARCHAR(500) DEFAULT NULL,
        egresso_laicizado_path VARCHAR(500) DEFAULT NULL,
        egresso_transf_sacerdotes_path VARCHAR(500) DEFAULT NULL,
        egresso_transf_para_regiao_path VARCHAR(500) DEFAULT NULL,
        egresso_transf_da_regiao_path VARCHAR(500) DEFAULT NULL,
        exclaustrado_data DATE DEFAULT NULL,
        exclaustrado_processo VARCHAR(255) DEFAULT NULL,
        exclaustrado_doc_path VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => console.error('[BACKEND] Error creating tb_dados_situacao:', err?.message));

    // 1.1 Ensure tb_historico_perfil table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS tb_historico_perfil (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        perfil_anterior VARCHAR(100) NOT NULL,
        perfil_novo VARCHAR(100) NOT NULL,
        motivo TEXT DEFAULT NULL,
        alterado_por_id INT DEFAULT NULL,
        alterado_por_nome VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => console.error('[BACKEND] Error creating tb_historico_perfil:', err?.message));

    // 1.2 Ensure tb_historico_situacao table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS tb_historico_situacao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        situacao_anterior VARCHAR(50) NOT NULL,
        situacao_nova VARCHAR(50) NOT NULL,
        motivo TEXT DEFAULT NULL,
        alterado_por_id INT DEFAULT NULL,
        alterado_por_nome VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => console.error('[BACKEND] Error creating tb_historico_situacao:', err?.message));

    // 2. Ensure optional columns
    const schemas = [
      {
        table: 'tb_usuarios',
        columns: [
          { name: 'foto_perfil', sql: "ALTER TABLE tb_usuarios ADD COLUMN foto_perfil VARCHAR(500) DEFAULT NULL" },
          { name: 'created_at', sql: "ALTER TABLE tb_usuarios ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" }
        ]
      },
      {
        table: 'tb_casas_religiosas',
        columns: [
          { name: 'regional', sql: "ALTER TABLE tb_casas_religiosas ADD COLUMN regional VARCHAR(255)" },
          { name: 'data_referencia_casa', sql: "ALTER TABLE tb_casas_religiosas ADD COLUMN data_referencia_casa DATE" },
          { name: 'tipo', sql: "ALTER TABLE tb_casas_religiosas ADD COLUMN tipo ENUM('CR', 'CI', 'M', 'P', 'PV', 'CS') DEFAULT 'CR'" },
          { name: 'pm_code', sql: "ALTER TABLE tb_casas_religiosas ADD COLUMN pm_code VARCHAR(100) DEFAULT NULL" },
        ]
      },
      {
        table: 'tb_missionario_casas',
        columns: [
          { name: 'pm', sql: "ALTER TABLE tb_missionario_casas ADD COLUMN pm VARCHAR(100) DEFAULT NULL" },
          { name: 'tipo', sql: "ALTER TABLE tb_missionario_casas ADD COLUMN tipo VARCHAR(20) DEFAULT NULL" },
          { name: 'pais', sql: "ALTER TABLE tb_missionario_casas ADD COLUMN pais VARCHAR(100) DEFAULT NULL" },
        ]
      },
      {
        table: 'tb_dados_situacao',
        columns: [
          { name: 'egresso_transf_sacerdotes_path', sql: "ALTER TABLE tb_dados_situacao ADD COLUMN egresso_transf_sacerdotes_path VARCHAR(500) DEFAULT NULL" },
          { name: 'exclaustrado_doc_path', sql: "ALTER TABLE tb_dados_situacao ADD COLUMN exclaustrado_doc_path VARCHAR(500) DEFAULT NULL" }
        ]
      }
    ];

    for (const schema of schemas) {
      for (const column of schema.columns) {
        try {
          const [rows] = await db.query(`SHOW COLUMNS FROM ${schema.table} LIKE ?`, [column.name]);
          if (rows.length === 0) {
            await db.query(column.sql);
            console.log(`[BACKEND] Added missing column ${column.name} to ${schema.table}`);
          }
        } catch (colCheckErr) {
          console.error(`[BACKEND] Column check failed for ${schema.table}.${column.name}:`, colCheckErr?.message);
        }
      }
    }

    try {
      const [rows] = await db.query(`SHOW COLUMNS FROM tb_usuarios LIKE 'foto_perfil'`);
      if (rows.length > 0 && rows[0].Type && !rows[0].Type.includes('text')) {
        await db.query("ALTER TABLE tb_usuarios MODIFY COLUMN foto_perfil MEDIUMTEXT DEFAULT NULL");
      }
    } catch (colErr) {
      console.error('[BACKEND] Could not alter foto_perfil to MEDIUMTEXT:', colErr?.message || colErr);
    }
  } catch (err) {
    console.error('[BACKEND] Optional schema ensure failed:', err?.message || err);
  }
}

// Auto ensure schema middleware for incoming requests
app.use(async (req, res, next) => {
  ensureOptionalSchema();
  next();
});

// Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`[LOGIN] ${new Date().toISOString()} - Attempt for: ${email}`);

  try {
    const [rows] = await db.query('SELECT * FROM tb_usuarios WHERE login = ? AND status = ?', [email, 'ATIVO']);
    
    if (rows.length === 0) {
      console.log(`[LOGIN] User not found or inactive: ${email}`);
      return res.status(401).json({ success: false, message: 'Usuário não encontrado ou inativo' });
    }

    const user = rows[0];
    
    // For now, accept both hashed and plain text for the provided admin password
    let isMatch = false;
    if (user.password_hash.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      isMatch = (password === user.password_hash);
    }

    console.log(`[LOGIN] User ID: ${user.id}, Password match: ${isMatch}`);

    if (!isMatch) {
      await logAccess(user.id, 'FALHA', req, 'Senha incorreta');
      return res.status(401).json({ success: false, message: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.login, role: user.role, nome: user.nome },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await logAccess(user.id, 'LOGIN', req, 'Autenticação bem-sucedida');

    const [houseRow] = await db.query('SELECT casa_id FROM tb_missionario_casas WHERE usuario_id = ? AND (data_fim IS NULL OR data_fim >= CURDATE()) LIMIT 1', [user.id]);
    const casaId = houseRow.length > 0 ? houseRow[0].casa_id : null;

    res.json({
      success: true,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.login,
        role: user.role,
        situacao: user.situacao,
        is_superior: !!user.is_superior,
        is_oconomo: !!user.is_oconomo,
        casa_id: casaId,
        foto_perfil: user.foto_perfil
      },
      token
    });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    fs.appendFileSync('debug.log', `${new Date().toISOString()} - Login Error: ${error.stack}\n`);
    res.status(500).json({ 
      success: false, 
      message: 'Erro no servidor durante o login. Por favor, tente novamente mais tarde.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Forgot password (sends password recovery email)
app.post(['/api/auth/forgot-password', '/api/forgot-password'], async (req, res) => {
  const email = (req.body.email || req.body.login || '').trim();
  if (!email) {
    return res.status(400).json({ success: false, message: 'O e-mail é obrigatório.' });
  }

  try {
    const [rows] = await db.query('SELECT id, nome, login FROM tb_usuarios WHERE login = ? AND status = ?', [email, 'ATIVO']);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nenhum usuário ativo foi encontrado com este e-mail.' });
    }

    const user = rows[0];
    await sendPasswordResetEmail(user.login, user.nome);
    res.json({ success: true, message: 'E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.' });
  } catch (error) {
    console.error('[FORGOT-PASSWORD ERROR]', error.code, error.message, error.responseCode);
    res.status(500).json({ 
      success: false, 
      message: `Erro ao enviar o e-mail de recuperação: ${error?.message || 'Falha no servidor SMTP'}`,
      smtpCode: error?.code,
      smtpResponse: error?.response,
    });
  }
});

// Reset password (public — used on first access from welcome email)
app.post('/api/auth/reset-password', async (req, res) => {
  const { login, newPassword } = req.body;
  if (!login || !newPassword) {
    return res.status(400).json({ message: 'E-mail e nova senha são obrigatórios.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
  }
  try {
    const [rows] = await db.query('SELECT id, nome FROM tb_usuarios WHERE login = ?', [login]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE tb_usuarios SET password_hash = ? WHERE login = ?', [hashed, login]);

    // Respond immediately to the missionary
    res.json({ success: true, message: 'Senha redefinida com sucesso.' });

    // Fire-and-forget: notify all REGISTRO_REGIONAL users
    const missionarioNome = rows[0].nome || login;
    const accessedAt = new Date();
    db.query("SELECT login FROM tb_usuarios WHERE role = 'REGISTRO_REGIONAL' AND status = 'ATIVO'").then(([registros]) => {
      if (registros.length === 0) return;
      console.log(`[EMAIL] Sending first-access notification to ${registros.length} Registro Regional user(s) for: ${missionarioNome}`);
      for (const reg of registros) {
        sendFirstAccessNotification(reg.login, missionarioNome, login, accessedAt);
      }
    }).catch(err => {
      console.error('[RESET-PASSWORD] Failed to query REGISTRO_REGIONAL users:', err.message);
    });
  } catch (error) {
    console.error('[RESET-PASSWORD ERROR]', error);
    res.status(500).json({ message: 'Erro ao redefinir senha.' });
  }
});


// Migration: Add cidade + pais columns to tb_casas_religiosas (fixes cidade in production)
app.get('/api/debug/migrate-casas-cidade', async (req, res) => {
  const steps = [];
  try {
    // 1. Add cidade column if not exists
    const [hasCidade] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'cidade'");
    if (hasCidade.length === 0) {
      await db.query("ALTER TABLE tb_casas_religiosas ADD COLUMN cidade VARCHAR(255) AFTER endereco");
      steps.push({ step: 'add_cidade_column', status: 'CREATED' });
    } else {
      steps.push({ step: 'add_cidade_column', status: 'ALREADY_EXISTS' });
    }

    // 2. Add pais column if not exists
    const [hasPais] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'pais'");
    if (hasPais.length === 0) {
      await db.query("ALTER TABLE tb_casas_religiosas ADD COLUMN pais VARCHAR(100) AFTER cidade");
      steps.push({ step: 'add_pais_column', status: 'CREATED' });
    } else {
      steps.push({ step: 'add_pais_column', status: 'ALREADY_EXISTS' });
    }

    // 3. Populate cidade from endereco for rows where cidade is NULL
    // Endereco format: "Rua X, 123, Bairro, Cidade, UF, CEP ..."
    // Try to extract "Cidade, UF" part (typically the 4th and 5th comma-separated segment)
    const [casas] = await db.query("SELECT id, endereco, cidade, pais FROM tb_casas_religiosas WHERE cidade IS NULL OR cidade = ''");
    let populated = 0;
    for (const casa of casas) {
      if (!casa.endereco) continue;
      const parts = casa.endereco.split(',').map(p => p.trim()).filter(Boolean);
      // Try to find a part that looks like a city (not a number, not a CEP, not short abbreviation)
      // Typical format: Rua, Num, Complemento, Bairro, Cidade, UF, CEP País
      let cidade = null;
      let pais = null;
      // Look for a 2-letter UF/state code to anchor the city
      for (let i = 1; i < parts.length; i++) {
        if (/^[A-Z]{2}$/.test(parts[i]) && i > 0) {
          cidade = `${parts[i-1]}/${parts[i]}`;
          break;
        }
      }
      // Look for "Brasil" or country name
      const padroesPais = ['Brasil', 'Brazil', 'Argentina', 'Itália', 'Portugal', 'Paraguai', 'Bolívia', 'Colômbia'];
      for (const p of parts) {
        if (padroesPais.some(pp => p.toLowerCase().includes(pp.toLowerCase()))) {
          pais = p.trim();
          break;
        }
      }
      if (cidade || pais) {
        await db.query(
          "UPDATE tb_casas_religiosas SET cidade = COALESCE(NULLIF(cidade,''), ?), pais = COALESCE(NULLIF(pais,''), ?) WHERE id = ?",
          [cidade || null, pais || null, casa.id]
        );
        populated++;
      }
    }
    steps.push({ step: 'populate_cidade_from_endereco', status: 'DONE', rows_updated: populated });

    res.json({ success: true, message: 'Migration applied successfully', steps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, steps });
  }
});

// Diagnostic endpoint
app.get('/api/debug/db-check', async (req, res) => {
  try {
    const [tables] = await db.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    // Check specific tables reported as failing
    const status = {};
    const tablesToCheck = [
      'tb_usuarios', 'tb_documentos', 'tb_formacao_academica', 
      'tb_atividade_missionaria', 'tb_saude', 'tb_contas_bancarias',
      'tb_obras_realizadas', 'tb_observacoes_gerais', 'tb_dados_situacao'
    ];
    
    for (const table of tablesToCheck) {
      status[table] = tableNames.includes(table) ? 'EXISTS' : 'MISSING';
    }

    res.json({
      db_connected: true,
      tables: tableNames,
      check_status: status
    });
  } catch (err) {
    res.status(500).json({ db_connected: false, error: err.message });
  }
});

app.get('/api/debug/run-migration-10', async (req, res) => {
  const steps = [];
  try {
    console.log("[DEBUG] Running Migration 10 logic...");
    
    const queries = [
      { name: 'nit_col', sql: `ALTER TABLE tb_dados_civis ADD COLUMN IF NOT EXISTS nit VARCHAR(50) AFTER passaporte_doc_path` },
      { name: 'formacao', sql: `CREATE TABLE tb_formacao_academica (id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT NOT NULL, curso VARCHAR(255), faculdade VARCHAR(255), periodo VARCHAR(100), doc_path VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE)` },
      { name: 'atividade', sql: `CREATE TABLE tb_atividade_missionaria (id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT NOT NULL, periodo VARCHAR(255), lugar VARCHAR(255), missao TEXT, doc_path VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE)` },
      { name: 'saude', sql: `CREATE TABLE tb_saude (id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT NOT NULL, sus_card VARCHAR(100), seguradora VARCHAR(255), numero_carteira VARCHAR(100), doc_path VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE)` },
      { name: 'contas', sql: `CREATE TABLE tb_contas_bancarias (id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT NOT NULL, tipo_conta VARCHAR(100), titularidade VARCHAR(255), agencia VARCHAR(50), numero VARCHAR(50), doc_path VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE)` },
      { name: 'obras', sql: `CREATE TABLE tb_obras_realizadas (id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT NOT NULL, periodo VARCHAR(255), lugar VARCHAR(255), obra TEXT, doc_path VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE)` },
      { name: 'obs', sql: `CREATE TABLE tb_observacoes_gerais (id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT NOT NULL, texto TEXT, doc_path VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE)` }
    ];

    for (const q of queries) {
      try {
        await db.query(q.sql);
        steps.push({ name: q.name, status: 'SUCCESS' });
      } catch (err) {
        steps.push({ name: q.name, status: 'ERROR', message: err.message, code: err.code });
      }
    }

    res.json({ success: true, steps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, steps });
  }
});

// Migration: Fix charset of tb_documentos to utf8mb4 (fixes macOS filenames with accents)
app.get('/api/debug/fix-documentos-charset', async (req, res) => {
  const steps = [];
  try {
    const queries = [
      { name: 'alter_table', sql: `ALTER TABLE tb_documentos CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` },
      { name: 'alter_arquivo_nome', sql: `ALTER TABLE tb_documentos MODIFY arquivo_nome VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` },
      { name: 'alter_descricao', sql: `ALTER TABLE tb_documentos MODIFY descricao VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` },
      { name: 'alter_arquivo_path', sql: `ALTER TABLE tb_documentos MODIFY arquivo_path VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` },
    ];
    for (const q of queries) {
      try {
        await db.query(q.sql);
        steps.push({ name: q.name, status: 'SUCCESS' });
      } catch (err) {
        steps.push({ name: q.name, status: 'ERROR', message: err.message });
      }
    }
    res.json({ success: true, message: 'Charset migration applied', steps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper to sanitize dates (convert empty string to null)
const sanitizeDate = (date) => (date === '' || date === undefined || date === null) ? null : (typeof date === 'string' ? date.split('T')[0] : date);
const sanitizeString = (str) => (str === '' || str === undefined || str === null) ? null : str;

// Sanitize file names: normalize Unicode (NFC), remove NFD-decomposed diacritics,
// replace spaces with underscores, strip any non-ASCII-safe characters.
// This prevents ER_TRUNCATED_WRONG_VALUE_FOR_FIELD with macOS NFD filenames.
const sanitizeFilename = (filename) => {
  if (!filename) return 'documento';
  // Normalize to NFC first, then try to decompose and strip combining marks (NFD -> strip Mn category)
  let safe = filename
    .normalize('NFC')          // canonical composition (handles macOS NFD)
    // Transliterate common accented chars to ASCII equivalents
    .replace(/[àáâãäå]/gi, 'a')
    .replace(/[èéêë]/gi, 'e')
    .replace(/[ìíîï]/gi, 'i')
    .replace(/[òóôõö]/gi, 'o')
    .replace(/[ùúûü]/gi, 'u')
    .replace(/[ñ]/gi, 'n')
    .replace(/[ç]/gi, 'c')
    .replace(/[ýÿ]/gi, 'y')
    // Remove remaining non-ASCII characters
    .replace(/[^\x00-\x7F]/g, '')
    // Replace spaces and problematic chars with underscore
    .replace(/[\s]+/g, '_')
    // Remove chars not allowed in filenames
    .replace(/[^a-zA-Z0-9._\-]/g, '')
    .trim();
  // Ensure it still has the extension
  if (!safe) safe = 'documento';
  return safe;
};

// Ensure uploads directory exists
const uploadsDataDir = path.join(__dirname, 'uploads', 'documentos');
if (!fs.existsSync(uploadsDataDir)) {
  fs.mkdirSync(uploadsDataDir, { recursive: true });
  console.log('[BACKEND] Created uploads/documentos directory');
}

// Generic CRUD endpoints for tables
// Users
// --- MEU PERFIL ROUTES ---
app.get('/api/meu-perfil', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const [usuarios] = await db.query('SELECT nome, login, foto_perfil FROM tb_usuarios WHERE id = ?', [userId]);
    const [enderecos] = await db.query('SELECT * FROM tb_enderecos_contatos WHERE usuario_id = ?', [userId]);
    const [contas] = await db.query('SELECT * FROM tb_contas_bancarias WHERE usuario_id = ?', [userId]);
    res.json({
      perfil: usuarios[0],
      endereco: enderecos[0] || null,
      contaBancaria: contas[0] || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/meu-perfil', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { nome } = req.body;
  try {
    if (nome) await db.query('UPDATE tb_usuarios SET nome = ? WHERE id = ?', [nome, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/meu-perfil/foto', authenticateToken, (req, res, next) => {
  upload.single('foto')(req, res, (err) => {
    if (err) {
      console.error('Erro no upload de foto (multer):', err);
      return res.status(400).json({ message: err.message || 'Erro ao processar imagem.' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Nenhuma foto enviada' });
  const userId = req.user.id;
  try {
    // Read file and convert to Base64 Data URI to prevent loss on read-only/serverless containers
    const fileBuffer = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype || 'image/jpeg';
    const fotoDataUri = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

    // Clean up temporary file
    fs.unlink(req.file.path, () => {});

    await db.query('UPDATE tb_usuarios SET foto_perfil = ? WHERE id = ?', [fotoDataUri, userId]);
    res.json({ success: true, foto_perfil: fotoDataUri });
  } catch (error) {
    console.error('Erro ao salvar foto de perfil:', error);
    res.status(500).json({ message: error.message || 'Erro ao salvar a foto de perfil.' });
  }
});

app.delete('/api/meu-perfil/foto', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query('UPDATE tb_usuarios SET foto_perfil = NULL WHERE id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/meu-perfil/endereco', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { logradouro, complemento, bairro, cep, cidade_estado, celular_whatsapp, telefone_fixo, email_pessoal } = req.body;
  try {
    const [existing] = await db.query('SELECT * FROM tb_enderecos_contatos WHERE usuario_id = ?', [userId]);
    if (existing.length > 0) {
      await db.query(`UPDATE tb_enderecos_contatos SET logradouro=?, complemento=?, bairro=?, cep=?, cidade_estado=?, celular_whatsapp=?, telefone_fixo=?, email_pessoal=? WHERE usuario_id=?`, [logradouro, complemento, bairro, cep, cidade_estado, celular_whatsapp, telefone_fixo, email_pessoal, userId]);
    } else {
      await db.query(`INSERT INTO tb_enderecos_contatos (usuario_id, logradouro, complemento, bairro, cep, cidade_estado, celular_whatsapp, telefone_fixo, email_pessoal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, logradouro, complemento, bairro, cep, cidade_estado, celular_whatsapp, telefone_fixo, email_pessoal]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/meu-perfil/conta', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { tipo_conta, titularidade, agencia, numero } = req.body;
  try {
    const [existing] = await db.query('SELECT * FROM tb_contas_bancarias WHERE usuario_id = ?', [userId]);
    if (existing.length > 0) {
      await db.query(`UPDATE tb_contas_bancarias SET tipo_conta=?, titularidade=?, agencia=?, numero=? WHERE id=?`, [tipo_conta, titularidade, agencia, numero, existing[0].id]);
    } else {
      await db.query(`INSERT INTO tb_contas_bancarias (usuario_id, tipo_conta, titularidade, agencia, numero) VALUES (?, ?, ?, ?, ?)`, [userId, tipo_conta, titularidade, agencia, numero]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const handleGetUsuarios = async (req, res) => {
  try {
    // Detect if the houses table contains cidade/pais columns; if not, fallback to civil data
    const [hasCidade] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'cidade'");
    const [hasPais] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'pais'");
    const [hasPmColumn] = await db.query("SHOW COLUMNS FROM tb_missionario_casas LIKE 'pm'");

    const selectCasaCidade = hasCidade.length > 0
      ? `(SELECT c.cidade FROM tb_missionario_casas mc JOIN tb_casas_religiosas c ON c.id = mc.casa_id WHERE mc.usuario_id = u.id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1)`
      : `(SELECT dc.cidade_estado FROM tb_dados_civis dc WHERE dc.usuario_id = u.id LIMIT 1)`;

    const selectCasaPais = hasPais.length > 0
      ? `(SELECT c.pais FROM tb_missionario_casas mc JOIN tb_casas_religiosas c ON c.id = mc.casa_id WHERE mc.usuario_id = u.id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1)`
      : `(SELECT dc.pais FROM tb_dados_civis dc WHERE dc.usuario_id = u.id LIMIT 1)`;

    const sql = `
      SELECT 
        u.id, u.nome, u.login, u.role, u.status, u.situacao, u.is_oconomo, u.is_superior, u.permissoes,
        (SELECT c.nome FROM tb_missionario_casas mc JOIN tb_casas_religiosas c ON c.id = mc.casa_id WHERE mc.usuario_id = u.id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1) as casa_nome,
        (SELECT c.endereco FROM tb_missionario_casas mc JOIN tb_casas_religiosas c ON c.id = mc.casa_id WHERE mc.usuario_id = u.id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1) as casa_endereco,
        ${hasCidade.length > 0 ? `(SELECT c.cidade FROM tb_missionario_casas mc JOIN tb_casas_religiosas c ON c.id = mc.casa_id WHERE mc.usuario_id = u.id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1)` : `NULL`} as casa_cidade,
        ${selectCasaPais} as pais,
        COALESCE(
          (SELECT NULLIF(dc.cidade_estado, '') FROM tb_dados_civis dc WHERE dc.usuario_id = u.id LIMIT 1),
          (SELECT NULLIF(dc.naturalidade, '') FROM tb_dados_civis dc WHERE dc.usuario_id = u.id LIMIT 1)
        ) as cidade_nascimento,
        (SELECT NULLIF(dc.pais, '') FROM tb_dados_civis dc WHERE dc.usuario_id = u.id LIMIT 1) as pais_nascimento,
        ${hasPmColumn.length > 0 ? `(SELECT mc.pm FROM tb_missionario_casas mc WHERE mc.usuario_id = u.id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1)` : `NULL`} as pm,
        ${hasCidade.length > 0 ? `NULL` : `(SELECT dc.cidade_estado FROM tb_dados_civis dc WHERE dc.usuario_id = u.id LIMIT 1)`} as cidade,
        (SELECT COUNT(*) FROM tb_dados_religiosos dr WHERE dr.usuario_id = u.id) as has_3,
        (SELECT COUNT(*) FROM tb_itinerario_formativo it WHERE it.usuario_id = u.id) as has_4,
        (SELECT COUNT(*) FROM tb_formacao_academica fa WHERE fa.usuario_id = u.id) as has_5,
        (SELECT COUNT(*) FROM tb_atividade_missionaria am WHERE am.usuario_id = u.id) as has_6,
        (SELECT COUNT(*) FROM tb_obras_realizadas orr WHERE orr.usuario_id = u.id) as has_11,
        (SELECT COUNT(*) FROM tb_observacoes_gerais og WHERE og.usuario_id = u.id) as has_12
      FROM tb_usuarios u
      WHERE ${HIDDEN_USERS_ALIAS_SQL('u')}
    `;

    const [rows] = await db.query(sql);

    const extractCityFromAddress = (address) => {
      if (!address) return null;
      const normalized = address.replace(/\s+/g, ' ').trim();
      const matches = Array.from(normalized.matchAll(/([A-Za-zÀ-ÿ ]+?)[,\s-]+([A-Z]{2})(?:\b|$)/gu));
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        return `${lastMatch[1].trim().replace(/,\s*$/, '')}/${lastMatch[2]}`;
      }

      const parts = normalized.split(',').map(part => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const secondLast = parts[parts.length - 2];
        if (/^[A-Z]{2}$/.test(last)) {
          return `${secondLast}/${last}`;
        }
      }
      return null;
    };

    const normalizedRows = rows.map(row => {
      let cidade = row.cidade || null;
      const houseCity = row.casa_cidade || null;
      const houseAddress = row.casa_endereco || null;

      if (houseCity) {
        cidade = houseCity;
      } else if (houseAddress) {
        const parsed = extractCityFromAddress(houseAddress);
        if (parsed) cidade = parsed;
      }

      const result = { ...row, cidade };
      delete result.casa_endereco;
      delete result.casa_cidade;
      delete result.cidadedc_pais;
      return result;
    });

    res.json(normalizedRows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

app.get('/api/usuarios', authenticateToken, handleGetUsuarios);

app.get('/api/usuarios/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nome, login, role, status, situacao, is_oconomo, is_superior, proximos_passos, permissoes FROM tb_usuarios WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/get', authenticateToken, handleGetUsuarios);

app.post('/api/usuarios', authenticateToken, async (req, res) => {
  const { nome, login, password, role, status, situacao, is_oconomo, is_superior } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    console.log('Creating user:', { nome, login, role, status, situacao, is_oconomo, is_superior });
    const [result] = await db.query(
      'INSERT INTO tb_usuarios (nome, login, password_hash, role, status, situacao, is_oconomo, is_superior, permissoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nome, login, hashedPassword, role, status, situacao, is_oconomo ? 1 : 0, is_superior ? 1 : 0, JSON.stringify(req.body.permissoes || {})]
    );
    const newId = result.insertId;
    const alteradoPorNome = req.user.nome || req.user.login || `Usuário #${req.user.id}`;
    
    // Register initial profile in history
    try {
      await db.query(
        'INSERT INTO tb_historico_perfil (usuario_id, perfil_anterior, perfil_novo, motivo, alterado_por_id, alterado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
        [newId, 'CADASTRO_INICIAL', role || 'MISSIONARIO', 'Cadastro inicial do usuário no sistema', req.user.id, alteradoPorNome]
      );
    } catch (e) { console.error('Error inserting initial profile history:', e); }

    const autorRole = req.user.role || 'USUARIO';
    const autorNome = req.user.nome || req.user.login || `ID #${req.user.id}`;
    await logAction(
      req.user.id,
      'CRIOU_USUARIO',
      'tb_usuarios',
      `${autorRole} (${autorNome}) criou o usuário "${nome}" (#${newId}) com Login: "${login}" | Perfil: ${role || 'MISSIONARIO'} | Status: ${status || 'ATIVO'}`
    );
    
    // Send welcome email
    await sendWelcomeEmail(login, nome, password);

    res.status(201).json({ id: newId, ...req.body });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: error.message });
  }
});

function getCleanAutorDisplay(role, nome) {
  if (!nome || nome.startsWith('Usuário #') || nome.startsWith('ID #')) {
    if (role === 'ADMIN_GERAL' || role === 'REGISTRO_REGIONAL') return 'Registro Regional';
    return role || 'Sistema';
  }
  let clean = nome.trim();
  if (role === 'ADMIN_GERAL' || clean.toLowerCase() === 'registro regional' || clean === 'ADMIN_GERAL') {
    return 'Registro Regional';
  }
  return clean;
}

app.put('/api/usuarios/:id', authenticateToken, async (req, res) => {
  const { nome, login, password, role, status, situacao, is_oconomo, is_superior, proximos_passos, motivo_perfil, motivo_situacao } = req.body;
  const { id } = req.params;

  try {
    const [currentRows] = await db.query('SELECT role, status, situacao, nome, login, is_oconomo, is_superior FROM tb_usuarios WHERE id = ?', [id]);
    const current = currentRows[0];
    if (current) {
      const autorDisplay = getCleanAutorDisplay(req.user.role, req.user.nome || req.user.login);
      const isSelf = Number(req.user.id) === Number(id);
      const changes = [];

      if (nome && current.nome && nome.trim() !== current.nome.trim()) {
        changes.push(`Nome: Antes ("${current.nome}") ➔ Atualizado ("${nome}")`);
      }
      if (login && current.login && login.trim() !== current.login.trim()) {
        changes.push(`Login/E-mail: Antes ("${current.login}") ➔ Atualizado ("${login}")`);
      }
      if (role && current.role && role !== current.role) {
        changes.push(`Perfil: Antes (${current.role}) ➔ Atualizado (${role})`);
        try {
          await db.query(
            'INSERT INTO tb_historico_perfil (usuario_id, perfil_anterior, perfil_novo, motivo, alterado_por_id, alterado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
            [id, current.role, role, motivo_perfil || null, req.user.id, autorDisplay]
          );
        } catch (e) { console.error('Error logging profile change:', e); }
      }
      if (status && current.status && status !== current.status) {
        changes.push(`Status: Antes (${current.status}) ➔ Atualizado (${status})`);
      }
      if (situacao && current.situacao && situacao !== current.situacao) {
        changes.push(`Situação: Antes (${current.situacao}) ➔ Atualizado (${situacao})`);
        try {
          await db.query(
            'INSERT INTO tb_historico_situacao (usuario_id, situacao_anterior, situacao_nova, motivo, alterado_por_id, alterado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
            [id, current.situacao, situacao, motivo_situacao || null, req.user.id, autorDisplay]
          );
        } catch (e) { console.error('Error logging situacao change:', e); }
      }
      if (password && password.trim() !== '') {
        changes.push('Senha de acesso: Redefinida com nova senha');
      }
      if (req.body.permissoes) {
        changes.push('Permissões de visualização: Permissões atualizadas');
      }
      if (motivo_perfil) {
        changes.push(`Motivo do Perfil: ${motivo_perfil}`);
      }
      if (motivo_situacao) {
        changes.push(`Motivo da Situação: ${motivo_situacao}`);
      }

      const diffSummary = changes.length > 0 ? changes.join(' | ') : 'Dados de cadastro confirmados';
      let detalheLog = '';
      if (isSelf) {
        detalheLog = `Editou o próprio cadastro (${current.nome} #${id}): ${diffSummary}`;
      } else {
        detalheLog = `${autorDisplay} editou o usuário ${current.nome} (#${id}): ${diffSummary}`;
      }

      await logAction(req.user.id, 'EDITOU_USUARIO', 'tb_usuarios', detalheLog);
    }

    let query = 'UPDATE tb_usuarios SET nome = ?, login = ?, role = ?, status = ?, situacao = ?, is_oconomo = ?, is_superior = ?, proximos_passos = ?, permissoes = ?';
    let params = [nome, login, role, status, situacao, is_oconomo ? 1 : 0, is_superior ? 1 : 0, proximos_passos || null, JSON.stringify(req.body.permissoes || {})];

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.query(query, params);
    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Alias for PUT to avoid 403 Forbidden issues on some servers
app.post('/api/usuarios/:id/update', authenticateToken, async (req, res) => {
  const { nome, login, password, role, status, situacao, is_oconomo, is_superior, proximos_passos, motivo_perfil, motivo_situacao } = req.body;
  const { id } = req.params;

  try {
    const [currentRows] = await db.query('SELECT role, status, situacao, nome, login, is_oconomo, is_superior FROM tb_usuarios WHERE id = ?', [id]);
    const current = currentRows[0];
    if (current) {
      const autorDisplay = getCleanAutorDisplay(req.user.role, req.user.nome || req.user.login);
      const isSelf = Number(req.user.id) === Number(id);
      const changes = [];

      if (nome && current.nome && nome.trim() !== current.nome.trim()) {
        changes.push(`Nome: Antes ("${current.nome}") ➔ Atualizado ("${nome}")`);
      }
      if (login && current.login && login.trim() !== current.login.trim()) {
        changes.push(`Login/E-mail: Antes ("${current.login}") ➔ Atualizado ("${login}")`);
      }
      if (role && current.role && role !== current.role) {
        changes.push(`Perfil: Antes (${current.role}) ➔ Atualizado (${role})`);
        try {
          await db.query(
            'INSERT INTO tb_historico_perfil (usuario_id, perfil_anterior, perfil_novo, motivo, alterado_por_id, alterado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
            [id, current.role, role, motivo_perfil || null, req.user.id, autorDisplay]
          );
        } catch (e) { console.error('Error logging profile change:', e); }
      }
      if (status && current.status && status !== current.status) {
        changes.push(`Status: Antes (${current.status}) ➔ Atualizado (${status})`);
      }
      if (situacao && current.situacao && situacao !== current.situacao) {
        changes.push(`Situação: Antes (${current.situacao}) ➔ Atualizado (${situacao})`);
        try {
          await db.query(
            'INSERT INTO tb_historico_situacao (usuario_id, situacao_anterior, situacao_nova, motivo, alterado_por_id, alterado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
            [id, current.situacao, situacao, motivo_situacao || null, req.user.id, autorDisplay]
          );
        } catch (e) { console.error('Error logging situacao change:', e); }
      }
      if (password && password.trim() !== '') {
        changes.push('Senha de acesso: Redefinida com nova senha');
      }
      if (req.body.permissoes) {
        changes.push('Permissões de visualização: Permissões atualizadas');
      }
      if (motivo_perfil) {
        changes.push(`Motivo do Perfil: ${motivo_perfil}`);
      }
      if (motivo_situacao) {
        changes.push(`Motivo da Situação: ${motivo_situacao}`);
      }

      const diffSummary = changes.length > 0 ? changes.join(' | ') : 'Dados de cadastro confirmados';
      let detalheLog = '';
      if (isSelf) {
        detalheLog = `Editou o próprio cadastro (${current.nome} #${id}): ${diffSummary}`;
      } else {
        detalheLog = `${autorDisplay} editou o usuário ${current.nome} (#${id}): ${diffSummary}`;
      }

      await logAction(req.user.id, 'EDITOU_USUARIO', 'tb_usuarios', detalheLog);
    }

    let query = 'UPDATE tb_usuarios SET nome = ?, login = ?, role = ?, status = ?, situacao = ?, is_oconomo = ?, is_superior = ?, proximos_passos = ?, permissoes = ?';
    let params = [nome, login, role, status, situacao, is_oconomo ? 1 : 0, is_superior ? 1 : 0, proximos_passos || null, JSON.stringify(req.body.permissoes || {})];

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.query(query, params);
    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Histórico Completo do Usuário (Perfil, Situação, Ações/Logs e Cadastro) ---
app.get('/api/usuarios/:id/historico-completo', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const [userRows] = await db.query('SELECT id, nome, login, role, status, situacao, created_at FROM tb_usuarios WHERE id = ?', [userId]);
    if (userRows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    const user = userRows[0];

    let [perfilHist] = await db.query('SELECT * FROM tb_historico_perfil WHERE usuario_id = ? ORDER BY created_at DESC', [userId]);
    let [situacaoHist] = await db.query('SELECT * FROM tb_historico_situacao WHERE usuario_id = ? ORDER BY created_at DESC', [userId]);

    // Logs: actions performed BY this user or ON this user
    const [logs] = await db.query(`
      SELECT l.*, u.nome as autor_nome, u.role as autor_role 
      FROM tb_logs l 
      LEFT JOIN tb_usuarios u ON l.usuario_id = u.id 
      WHERE l.usuario_id = ? 
         OR l.detalhes LIKE ? 
         OR l.detalhes LIKE ? 
         OR l.detalhes LIKE ? 
         OR l.detalhes LIKE ? 
      ORDER BY l.created_at DESC 
      LIMIT 100
    `, [
      userId, 
      `%#${userId}%`, 
      `%ID ${userId}%`, 
      `%usuario ID ${userId}%`, 
      `%${user.nome}%`
    ]);

    // Backfill / Synthesize tb_historico_perfil if empty or missing role changes
    if (perfilHist.length === 0) {
      const editLogs = logs.filter(l => l.acao === 'EDITOU_USUARIO' || (l.detalhes && l.detalhes.includes('Perfil:')));
      if (editLogs.length > 0) {
        for (const eLog of editLogs) {
          const autorDisplay = getCleanAutorDisplay(eLog.autor_role, eLog.autor_nome);
          try {
            await db.query(
              'INSERT INTO tb_historico_perfil (usuario_id, perfil_anterior, perfil_novo, motivo, alterado_por_id, alterado_por_nome, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [userId, 'PADRE', user.role, 'Alteração de perfil de acesso', eLog.usuario_id || 1, autorDisplay, eLog.created_at]
            );
          } catch (e) {}
        }
        const [reloaded] = await db.query('SELECT * FROM tb_historico_perfil WHERE usuario_id = ? ORDER BY created_at DESC', [userId]);
        perfilHist = reloaded;
      } else if (user.role && user.role !== 'PADRE' && user.role !== 'CADASTRO_INICIAL') {
        const autorDisplay = 'Registro Regional';
        try {
          await db.query(
            'INSERT INTO tb_historico_perfil (usuario_id, perfil_anterior, perfil_novo, motivo, alterado_por_id, alterado_por_nome, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'PADRE', user.role, 'Alteração de perfil de acesso', 1, autorDisplay, user.created_at || new Date()]
          );
          const [reloaded] = await db.query('SELECT * FROM tb_historico_perfil WHERE usuario_id = ? ORDER BY created_at DESC', [userId]);
          perfilHist = reloaded;
        } catch (e) {}
      }
    }

    const enrichedLogs = logs.map(l => {
      let detalhes = l.detalhes || '';
      const autorDisplay = getCleanAutorDisplay(l.autor_role, l.autor_nome);

      const isUserEdit = detalhes.startsWith('Editou usuario ID') ||
                         detalhes.startsWith('Editou usuário ID') ||
                         detalhes.includes('editou usuário') ||
                         detalhes.includes('editou o usuário') ||
                         detalhes.includes('Editou o próprio cadastro');

      if (isUserEdit) {
        // Legacy format "Editou usuario ID 40"
        if (detalhes.startsWith('Editou usuario ID') || detalhes.startsWith('Editou usuário ID')) {
          const pMatch = perfilHist.find(p => Math.abs(new Date(p.created_at) - new Date(l.created_at)) < 300000);
          const sMatch = situacaoHist.find(s => Math.abs(new Date(s.created_at) - new Date(l.created_at)) < 300000);

          let changesList = [];
          if (pMatch) {
            changesList.push(`Perfil: Antes (${pMatch.perfil_anterior}) ➔ Atualizado (${pMatch.perfil_novo})`);
            if (pMatch.motivo) changesList.push(`Motivo do Perfil: ${pMatch.motivo}`);
          } else if (perfilHist.length > 0) {
            const latestP = perfilHist[0];
            changesList.push(`Perfil: Antes (${latestP.perfil_anterior || 'PADRE'}) ➔ Atualizado (${latestP.perfil_novo || user.role})`);
            if (latestP.motivo) changesList.push(`Motivo do Perfil: ${latestP.motivo}`);
          } else {
            const prevRole = (user.role === 'PADRE' || user.role === 'MISSIONARIO') ? 'CADASTRO_INICIAL' : 'PADRE';
            changesList.push(`Perfil: Antes (${prevRole}) ➔ Atualizado (${user.role})`);
          }

          if (sMatch) {
            changesList.push(`Situação: Antes (${sMatch.situacao_anterior}) ➔ Atualizado (${sMatch.situacao_nova})`);
            if (sMatch.motivo) changesList.push(`Motivo da Situação: ${sMatch.motivo}`);
          }

          if (user.status) {
            const prevStatus = user.status === 'INATIVO' ? 'ATIVO' : 'INATIVO';
            changesList.push(`Status: Antes (${prevStatus}) ➔ Atualizado (${user.status})`);
          }

          return {
            ...l,
            detalhes: `${autorDisplay} editou o usuário ${user.nome} (#${userId}): ${changesList.join(' | ')}`
          };
        }

        // Clean raw ADMIN_GERAL and ensure clean prefix
        detalhes = detalhes.replace(/ADMIN_GERAL\s*\(([^)]+)\)/g, '$1');
        detalhes = detalhes.replace(/ADMIN_GERAL\s*/g, 'Registro Regional ');
        detalhes = detalhes.replace(/editou usuário/g, 'editou o usuário');

        // If existing log has "Perfil: ECONOMO_REGIONAL" or "Status: INATIVO" without "Antes" or "➔"
        if (detalhes.includes(': ') && (!detalhes.includes('Antes') && !detalhes.includes('➔'))) {
          const colonIdx = detalhes.indexOf(': ');
          const prefix = detalhes.substring(0, colonIdx);
          const diffContent = detalhes.substring(colonIdx + 2);
          const items = diffContent.split(' | ');

          const updatedItems = items.map(item => {
            const t = item.trim();
            if (t.startsWith('Perfil:') && !t.includes('➔')) {
              const val = t.replace('Perfil:', '').trim();
              const pMatch = perfilHist.find(p => p.perfil_novo === val) || perfilHist[0];
              const prev = pMatch ? pMatch.perfil_anterior : (val === 'PADRE' || val === 'MISSIONARIO' ? 'CADASTRO_INICIAL' : 'PADRE');
              return `Perfil: Antes (${prev}) ➔ Atualizado (${val})`;
            }
            if (t.startsWith('Status:') && !t.includes('➔')) {
              const val = t.replace('Status:', '').trim();
              const prev = val === 'INATIVO' ? 'ATIVO' : 'INATIVO';
              return `Status: Antes (${prev}) ➔ Atualizado (${val})`;
            }
            if (t.startsWith('Situação:') && !t.includes('➔')) {
              const val = t.replace('Situação:', '').trim();
              const sMatch = situacaoHist.find(s => s.situacao_nova === val) || situacaoHist[0];
              const prev = sMatch ? sMatch.situacao_anterior : 'EM_ATIVIDADE';
              return `Situação: Antes (${prev}) ➔ Atualizado (${val})`;
            }
            return item;
          });

          return {
            ...l,
            detalhes: `${prefix}: ${updatedItems.join(' | ')}`
          };
        }
      }

      return {
        ...l,
        detalhes
      };
    });

    res.json({
      usuario: user,
      historico_perfil: perfilHist,
      historico_situacao: situacaoHist,
      logs: enrichedLogs
    });
  } catch (error) {
    console.error('Error fetching historico-completo:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/usuarios/:id/historico-perfil', authenticateToken, async (req, res) => {
  try {
    let [rows] = await db.query('SELECT * FROM tb_historico_perfil WHERE usuario_id = ? ORDER BY created_at DESC', [req.params.id]);
    if (rows.length === 0) {
      const [uRows] = await db.query('SELECT role, created_at FROM tb_usuarios WHERE id = ?', [req.params.id]);
      if (uRows.length > 0 && uRows[0].role && uRows[0].role !== 'PADRE' && uRows[0].role !== 'CADASTRO_INICIAL') {
        try {
          await db.query(
            'INSERT INTO tb_historico_perfil (usuario_id, perfil_anterior, perfil_novo, motivo, alterado_por_id, alterado_por_nome, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.params.id, 'PADRE', uRows[0].role, 'Alteração de perfil de acesso', 1, 'Registro Regional', uRows[0].created_at || new Date()]
          );
          const [reloaded] = await db.query('SELECT * FROM tb_historico_perfil WHERE usuario_id = ? ORDER BY created_at DESC', [req.params.id]);
          rows = reloaded;
        } catch (e) {}
      }
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/usuarios/:id/historico-situacao', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_historico_situacao WHERE usuario_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/historico-situacao', authenticateToken, async (req, res) => {
  const { situacao_anterior, situacao_nova, motivo } = req.body;
  const autorRole = req.user.role || 'USUARIO';
  const autorNome = req.user.nome || req.user.login || `Usuário #${req.user.id}`;
  try {
    await db.query(
      'INSERT INTO tb_historico_situacao (usuario_id, situacao_anterior, situacao_nova, motivo, alterado_por_id, alterado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, situacao_anterior, situacao_nova, motivo || null, req.user.id, `${autorRole} (${autorNome})`]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/usuarios/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [targetRows] = await db.query('SELECT nome, login, role FROM tb_usuarios WHERE id = ?', [id]);
    const target = targetRows[0];
    const autorRole = req.user.role || 'USUARIO';
    const autorNome = req.user.nome || req.user.login || `ID #${req.user.id}`;

    await db.query('DELETE FROM tb_usuarios WHERE id = ?', [id]);
    await logAction(
      req.user.id,
      'EXCLUIU_USUARIO',
      'tb_usuarios',
      `${autorRole} (${autorNome}) excluiu o usuário ${target?.nome ? `"${target.nome}" (#${id})` : `ID ${id}`}`
    );
    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Alias for DELETE to avoid 403 Forbidden on some servers
app.post('/api/usuarios/:id/delete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [targetRows] = await db.query('SELECT nome, login, role FROM tb_usuarios WHERE id = ?', [id]);
    const target = targetRows[0];
    const autorRole = req.user.role || 'USUARIO';
    const autorNome = req.user.nome || req.user.login || `ID #${req.user.id}`;

    await db.query('DELETE FROM tb_usuarios WHERE id = ?', [id]);
    await logAction(
      req.user.id,
      'EXCLUIU_USUARIO',
      'tb_usuarios',
      `${autorRole} (${autorNome}) excluiu o usuário ${target?.nome ? `"${target.nome}" (#${id})` : `ID ${id}`}`
    );
    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Religious Houses
app.get('/api/casas-religiosas', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_casas_religiosas');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/casas-religiosas/get', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, 
      (SELECT COUNT(*) FROM tb_missionario_casas mc JOIN tb_usuarios u ON u.id = mc.usuario_id WHERE mc.casa_id = c.id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) AND ${HIDDEN_USERS_ALIAS_SQL('u')}) as missionarios_count
      FROM tb_casas_religiosas c
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching casas-religiosas:', error);
    res.json([]);
  }
});

app.post('/api/utils/validar-cnpj', authenticateToken, (req, res) => {
  const { cnpj } = req.body;
  if (!cnpj) return res.status(400).json({ valid: false, message: 'CNPJ não informado.' });

  const isValid = validateCNPJ(cnpj);
  const formatted = formatCNPJ(cnpj);
  res.json({
    valid: isValid,
    cnpj: formatted,
    clean: cleanCNPJ(cnpj),
    message: isValid ? 'CNPJ válido (Alfanumérico/Numérico).' : 'CNPJ inválido.'
  });
});

app.post('/api/casas-religiosas', authenticateToken, async (req, res) => {
  const { nome, cnpj, endereco, status, regional, data_referencia_casa, pm_code, tipo } = req.body;
  try {
    const dRef = sanitizeDate(data_referencia_casa);

    const cols = ['nome','endereco','status'];
    const params = [nome, endereco, status];

    const [hasCnpj] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'cnpj'");
    const [hasRegional] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'regional'");
    const [hasDataRef] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'data_referencia_casa'");
    const [hasTipo] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'tipo'");
    const [hasPmCode] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'pm_code'");

    if (hasCnpj.length > 0) { cols.push('cnpj'); params.push(cnpj ? formatCNPJ(cnpj) : null); }
    if (hasRegional.length > 0) { cols.push('regional'); params.push(regional || null); }
    if (hasDataRef.length > 0) { cols.push('data_referencia_casa'); params.push(dRef); }
    if (hasTipo.length > 0) { cols.push('tipo'); params.push(tipo || null); }
    if (hasPmCode.length > 0) { cols.push('pm_code'); params.push(pm_code || null); }

    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO tb_casas_religiosas (${cols.join(',')}) VALUES (${placeholders})`;
    const [result] = await db.query(sql, params);

    await logAction(req.user.id, 'CRIAR_CASA_RELIGIOSA', 'tb_casas_religiosas', `Casa "${nome}" criada em ${regional || 'N/A'}`);
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/casas-religiosas/:id', authenticateToken, async (req, res) => {
  const { nome, cnpj, endereco, status, regional, data_referencia_casa, pm_code, tipo, cidade, pais } = req.body;
  const { id } = req.params;
  try {
    const dRef = sanitizeDate(data_referencia_casa);

    const cols = ['nome','endereco','status'];
    const params = [nome, endereco, status];

    const [hasCnpj] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'cnpj'");
    const [hasRegional] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'regional'");
    const [hasDataRef] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'data_referencia_casa'");
    const [hasTipo] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'tipo'");
    const [hasPmCode] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'pm_code'");
    const [hasCidade] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'cidade'");
    const [hasPais] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'pais'");

    if (hasCnpj.length > 0) { cols.push('cnpj'); params.push(cnpj ? formatCNPJ(cnpj) : null); }
    if (hasRegional.length > 0) { cols.push('regional'); params.push(regional || null); }
    if (hasDataRef.length > 0) { cols.push('data_referencia_casa'); params.push(dRef); }
    if (hasTipo.length > 0) { cols.push('tipo'); params.push(tipo || null); }
    if (hasPmCode.length > 0) { cols.push('pm_code'); params.push(pm_code || null); }
    if (hasCidade.length > 0) { cols.push('cidade'); params.push(cidade || null); }
    if (hasPais.length > 0) { cols.push('pais'); params.push(pais || null); }

    const setClause = cols.map(col => `${col} = ?`).join(', ');
    const sql = `UPDATE tb_casas_religiosas SET ${setClause} WHERE id = ?`;
    params.push(id);

    await db.query(sql, params);
    await logAction(req.user.id, 'ATUALIZAR_CASA_RELIGIOSA', 'tb_casas_religiosas', `Casa ID ${id} ("${nome}") atualizada`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Alias for POST to avoid 403 Forbidden on PUT in some production servers
app.post('/api/casas-religiosas/:id/update', authenticateToken, async (req, res) => {
  const { nome, cnpj, endereco, status, regional, data_referencia_casa, pm_code, tipo, cidade, pais } = req.body;
  const { id } = req.params;
  try {
    const dRef = sanitizeDate(data_referencia_casa);

    const cols = ['nome','endereco','status'];
    const params = [nome, endereco, status];

    const [hasCnpj] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'cnpj'");
    const [hasRegional] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'regional'");
    const [hasDataRef] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'data_referencia_casa'");
    const [hasTipo] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'tipo'");
    const [hasPmCode] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'pm_code'");
    const [hasCidade] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'cidade'");
    const [hasPais] = await db.query("SHOW COLUMNS FROM tb_casas_religiosas LIKE 'pais'");

    if (hasCnpj.length > 0) { cols.push('cnpj'); params.push(cnpj ? formatCNPJ(cnpj) : null); }
    if (hasRegional.length > 0) { cols.push('regional'); params.push(regional || null); }
    if (hasDataRef.length > 0) { cols.push('data_referencia_casa'); params.push(dRef); }
    if (hasTipo.length > 0) { cols.push('tipo'); params.push(tipo || null); }
    if (hasPmCode.length > 0) { cols.push('pm_code'); params.push(pm_code || null); }
    if (hasCidade.length > 0) { cols.push('cidade'); params.push(cidade || null); }
    if (hasPais.length > 0) { cols.push('pais'); params.push(pais || null); }

    const setClause = cols.map(col => `${col} = ?`).join(', ');
    const sql = `UPDATE tb_casas_religiosas SET ${setClause} WHERE id = ?`;
    params.push(id);

    await db.query(sql, params);
    await logAction(req.user.id, 'ATUALIZAR_CASA_RELIGIOSA', 'tb_casas_religiosas', `Casa ID ${id} ("${nome}") atualizada (via POST)`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.get('/api/casas-religiosas/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_casas_religiosas WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Casa não encontrada' });

    // Get missionaries currently in this house
    const [missionarios] = await db.query(`
      SELECT u.id, u.nome, u.login, u.situacao, mc.funcao
      FROM tb_usuarios u
      JOIN tb_missionario_casas mc ON u.id = mc.usuario_id
      WHERE mc.casa_id = ? AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE())
      AND ${HIDDEN_USERS_ALIAS_SQL('u')}
    `, [req.params.id]);

    const house = rows[0];
    // Strip funcao from the list sent to frontend (keep missionarios clean)
    house.missionarios = missionarios.map(({ funcao, ...m }) => m);

    // Resolve Pároco and Vigário from the funcao field (can be comma-separated list)
    const findResponsavel = (role) => {
      const found = missionarios.find(m => {
        if (!m.funcao) return false;
        const funcoes = m.funcao.split(',').map(f => f.trim());
        return funcoes.includes(role);
      });
      return found ? found.nome : null;
    };

    house.paroco = house.paroco || findResponsavel('Pároco');
    house.vigario_paroquial = house.vigario_paroquial || findResponsavel('Vigário');

    res.json(house);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/casas-religiosas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Get info for logging
    const [rows] = await db.query('SELECT nome FROM tb_casas_religiosas WHERE id = ?', [id]);
    const nome = rows.length > 0 ? rows[0].nome : `ID ${id}`;

    await db.query('DELETE FROM tb_casas_religiosas WHERE id = ?', [id]);
    await logAction(req.user.id, 'DELETAR_CASA_RELIGIOSA', 'tb_casas_religiosas', `Casa "${nome}" excluída`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Alias for DELETE to avoid 403 Forbidden on some servers
app.post('/api/casas-religiosas/:id/delete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Get info for logging
    const [rows] = await db.query('SELECT nome FROM tb_casas_religiosas WHERE id = ?', [id]);
    const nome = rows.length > 0 ? rows[0].nome : `ID ${id}`;

    await db.query('DELETE FROM tb_casas_religiosas WHERE id = ?', [id]);
    await logAction(req.user.id, 'DELETAR_CASA_RELIGIOSA', 'tb_casas_religiosas', `Casa "${nome}" excluída (via POST)`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Categories
app.get('/api/categorias-financas', authenticateToken, async (req, res) => {
  const { perfil } = req.query;
  try {
    let query = 'SELECT * FROM tb_categorias_financas WHERE 1=1';
    const params = [];

    if (perfil) {
      query += ' AND perfil = ?';
      params.push(perfil);
    }

    query += ' ORDER BY categoria_pai, codigo, nome';
    const [rows] = await db.query(query, params);

    // Hide codes for non-admins/non-RH/non-regional
    const canSeeCodes = ['ADMIN_GERAL', 'RH', 'ECONOMO_REGIONAL', 'SUPERIOR_REGIONAL'].includes(req.user.role);
    const sanitizedRows = rows.map(r => {
      const { codigo, ...rest } = r;
      return canSeeCodes ? r : rest;
    });

    res.json(sanitizedRows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// User-specific data (Civil, Religious, Address, Itinerary)
app.get('/api/usuarios/:id/dados-civis', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_dados_civis WHERE usuario_id = ?', [req.params.id]);
    res.json(rows[0] || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/dados-civis/get', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_dados_civis WHERE usuario_id = ?', [req.params.id]);
    res.json(rows[0] || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/dados-civis', authenticateToken, async (req, res) => {
  const { data_nascimento, filiacao, cidade_estado, diocese, pais, naturalidade, rnm, cpf, titulo_eleitor, cnh, passaporte, nit } = req.body;
  try {
    console.log(`Updating/Inserting civil data for user ${req.params.id}`);
    const [rows] = await db.query('SELECT * FROM tb_dados_civis WHERE usuario_id = ?', [req.params.id]);
    const dNasc = sanitizeDate(data_nascimento);
    if (rows.length > 0) {
      await db.query(
        'UPDATE tb_dados_civis SET data_nascimento=?, filiacao=?, cidade_estado=?, diocese=?, pais=?, naturalidade=?, rnm=?, cpf=?, titulo_eleitor=?, cnh=?, passaporte=?, nit=? WHERE usuario_id=?',
        [dNasc, filiacao, cidade_estado, diocese, pais, naturalidade, rnm, cpf, titulo_eleitor, cnh, passaporte, nit || null, req.params.id]
      );
    } else {
      await db.query(
        'INSERT INTO tb_dados_civis (usuario_id, data_nascimento, filiacao, cidade_estado, diocese, pais, naturalidade, rnm, cpf, titulo_eleitor, cnh, passaporte, nit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, dNasc, filiacao, cidade_estado, diocese, pais, naturalidade, rnm, cpf, titulo_eleitor, cnh, passaporte, nit || null]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error in dados-civis:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/usuarios/:id/nacionalidades', authenticateToken, async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tb_nacionalidades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        nacionalidade VARCHAR(100) NOT NULL,
        doc_path VARCHAR(500),
        FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE
      )
    `);
    const [rows] = await db.query('SELECT nacionalidade FROM tb_nacionalidades WHERE usuario_id = ?', [req.params.id]);
    res.json(rows.map(r => r.nacionalidade));
  } catch (error) {
    console.error('Error fetching nacionalidades:', error);
    res.json([]);
  }
});

app.post('/api/usuarios/:id/nacionalidades', authenticateToken, async (req, res) => {
  let nacList = req.body?.nacionalidades;
  if (nacList === undefined && Array.isArray(req.body)) {
    nacList = req.body;
  }
  if (typeof nacList === 'string') {
    nacList = nacList.split(',').map(s => s.trim());
  }
  if (!Array.isArray(nacList)) {
    nacList = [];
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tb_nacionalidades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        nacionalidade VARCHAR(100) NOT NULL,
        doc_path VARCHAR(500),
        FOREIGN KEY (usuario_id) REFERENCES tb_usuarios(id) ON DELETE CASCADE
      )
    `);
    
    // Remove existing
    await connection.query('DELETE FROM tb_nacionalidades WHERE usuario_id = ?', [req.params.id]);
    
    // Insert new ones
    for (const nac of nacList) {
      if (typeof nac === 'string' && nac.trim()) {
        await connection.query('INSERT INTO tb_nacionalidades (usuario_id, nacionalidade) VALUES (?, ?)', [req.params.id, nac.trim()]);
      }
    }
    
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Error in nacionalidades:', error);
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/usuarios/:id/dados-religiosos', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_dados_religiosos WHERE usuario_id = ?', [req.params.id]);
    res.json(rows[0] || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/dados-religiosos/get', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_dados_religiosos WHERE usuario_id = ?', [req.params.id]);
    res.json(rows[0] || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/dados-religiosos', authenticateToken, async (req, res) => {
  const {
    primeiros_votos_data, votos_perpetuos_data, lugar_profissao,
    diaconato_data, presbiterato_data, bispo_ordenante,
    data_batismo, data_primeira_comunhao, data_crisma
  } = req.body;
  try {
    console.log(`Updating/Inserting religious data for user ${req.params.id}`);
    const [rows] = await db.query('SELECT * FROM tb_dados_religiosos WHERE usuario_id = ?', [req.params.id]);
    const dPrimeiros = sanitizeDate(primeiros_votos_data);
    const dPerpetuos = sanitizeDate(votos_perpetuos_data);
    const dDiaconato = sanitizeDate(diaconato_data);
    const dPresbiterato = sanitizeDate(presbiterato_data);
    const dBatismo = sanitizeDate(data_batismo);
    const dComunhao = sanitizeDate(data_primeira_comunhao);
    const dCrisma = sanitizeDate(data_crisma);

    if (rows.length > 0) {
      await db.query(
        `UPDATE tb_dados_religiosos
         SET primeiros_votos_data=?, votos_perpetuos_data=?, lugar_profissao=?,
             diaconato_data=?, presbiterato_data=?, bispo_ordenante=?,
             data_batismo=?, data_primeira_comunhao=?, data_crisma=?
         WHERE usuario_id=?`,
        [dPrimeiros, dPerpetuos, lugar_profissao, dDiaconato, dPresbiterato, bispo_ordenante,
         dBatismo, dComunhao, dCrisma, req.params.id]
      );
    } else {
      await db.query(
        `INSERT INTO tb_dados_religiosos
         (usuario_id, primeiros_votos_data, votos_perpetuos_data, lugar_profissao,
          diaconato_data, presbiterato_data, bispo_ordenante,
          data_batismo, data_primeira_comunhao, data_crisma)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.params.id, dPrimeiros, dPerpetuos, lugar_profissao, dDiaconato, dPresbiterato, bispo_ordenante,
         dBatismo, dComunhao, dCrisma]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error in dados-religiosos:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload de documento sacramental (batismo / comunhao / crisma)
app.post('/api/usuarios/:id/dados-religiosos/upload-sacramento', authenticateToken, (req, res, next) => {
  upload.single('arquivo')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  const { campo } = req.body; // 'doc_batismo' | 'doc_primeira_comunhao' | 'doc_crisma'
  const allowed = ['doc_batismo', 'doc_primeira_comunhao', 'doc_crisma'];
  if (!allowed.includes(campo)) return res.status(400).json({ message: 'Campo inválido.' });
  if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado.' });
  try {
    const filePath = `/uploads/documentos/${req.file.filename}`;
    const [rows] = await db.query('SELECT id FROM tb_dados_religiosos WHERE usuario_id = ?', [req.params.id]);
    if (rows.length > 0) {
      await db.query(`UPDATE tb_dados_religiosos SET ${campo}=? WHERE usuario_id=?`, [filePath, req.params.id]);
    } else {
      await db.query(`INSERT INTO tb_dados_religiosos (usuario_id, ${campo}) VALUES (?, ?)`, [req.params.id, filePath]);
    }
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error uploading sacramento doc:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/usuarios/:id/endereco-contato', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_enderecos_contatos WHERE usuario_id = ?', [req.params.id]);
    res.json(rows[0] || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/endereco-contato/get', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_enderecos_contatos WHERE usuario_id = ?', [req.params.id]);
    res.json(rows[0] || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/endereco-contato', authenticateToken, async (req, res) => {
  const { logradouro, complemento, bairro, cep, cidade_estado, celular_whatsapp, telefone_fixo, email_pessoal } = req.body;
  try {
    console.log(`Updating/Inserting address for user ${req.params.id}`);
    const [rows] = await db.query('SELECT * FROM tb_enderecos_contatos WHERE usuario_id = ?', [req.params.id]);
    if (rows.length > 0) {
      await db.query(
        'UPDATE tb_enderecos_contatos SET logradouro=?, complemento=?, bairro=?, cep=?, cidade_estado=?, celular_whatsapp=?, telefone_fixo=?, email_pessoal=? WHERE usuario_id=?',
        [logradouro, complemento, bairro, cep, cidade_estado, celular_whatsapp, telefone_fixo, email_pessoal, req.params.id]
      );
    } else {
      await db.query(
        'INSERT INTO tb_enderecos_contatos (usuario_id, logradouro, complemento, bairro, cep, cidade_estado, celular_whatsapp, telefone_fixo, email_pessoal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, logradouro, complemento, bairro, cep, cidade_estado, celular_whatsapp, telefone_fixo, email_pessoal]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error in endereco-contato:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/usuarios/:id/contatos', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT parentesco, nome, endereco, telefone, email FROM tb_contatos WHERE usuario_id = ? ORDER BY id ASC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/contatos', authenticateToken, async (req, res) => {
  const { contatos } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM tb_contatos WHERE usuario_id = ?', [req.params.id]);
    if (contatos && contatos.length > 0) {
      for (const c of contatos) {
        if ((c.parentesco && c.parentesco.trim()) || (c.nome && c.nome.trim())) {
          await connection.query(
            'INSERT INTO tb_contatos (usuario_id, parentesco, nome, endereco, telefone, email) VALUES (?, ?, ?, ?, ?, ?)',
            [req.params.id, c.parentesco || '', c.nome || '', c.endereco || '', c.telefone || '', c.email || '']
          );
        }
      }
    }
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Error saving contatos:', error);
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
});


app.get('/api/usuarios/:id/itinerario', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_itinerario_formativo WHERE usuario_id = ?', [req.params.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/itinerario/get', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_itinerario_formativo WHERE usuario_id = ?', [req.params.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/itinerario', authenticateToken, async (req, res) => {
  const { stages } = req.body; // Expecting an array of stages
  try {
    // Basic implementation: Delete existing and insert new
    await db.query('DELETE FROM tb_itinerario_formativo WHERE usuario_id = ?', [req.params.id]);
    for (const stage of stages) {
      await db.query(
        'INSERT INTO tb_itinerario_formativo (usuario_id, etapa, local, periodo, is_sub_etapa, doc_path, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, stage.etapa, stage.local, stage.periodo, stage.is_sub_etapa || 0, stage.doc_path || null, stage.observacoes || stage.observacao || null]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/itinerario-dashboard', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.nome, 
      (SELECT c.nome FROM tb_missionario_casas mc 
       JOIN tb_casas_religiosas c ON c.id = mc.casa_id 
       WHERE mc.usuario_id = u.id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) 
       LIMIT 1) as casa_nome
      FROM tb_usuarios u 
      WHERE u.role = 'PADRE'
      AND ${HIDDEN_USERS_ALIAS_SQL('u')}
    `);

    const dashboard = await Promise.all(users.map(async (u) => {
      const [stages] = await db.query('SELECT etapa, is_sub_etapa FROM tb_itinerario_formativo WHERE usuario_id = ?', [u.id]);
      const [academic] = await db.query('SELECT COUNT(*) as count FROM tb_formacao_academica WHERE usuario_id = ?', [u.id]);
      
      // We consider these the core stages
      const mandatory = ['SEMINARIO', 'PROPEDEUTICO', 'FILOSOFIA', 'POSTULADO', 'NOVICIADO', 'TEOLOGIA'];
      const completed = stages.map(s => s.etapa);
      const missing = mandatory.filter(m => !completed.includes(m));
      
      return {
        ...u,
        stages: completed,
        missing,
        has_academic: academic[0].count > 0,
        progress: mandatory.length - missing.length,
        total_mandatory: mandatory.length
      };
    }));

    res.json(dashboard);
  } catch (error) {
    console.error('Error in itinerary dashboard:', error);
    res.status(500).json({ message: error.message });
  }
});

// --- New Endpoints ---
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, u.nome as usuario_nome 
      FROM tb_logs l 
      LEFT JOIN tb_usuarios u ON l.usuario_id = u.id 
      ORDER BY l.created_at DESC LIMIT 200
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/usuarios/:id/casas-historico', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT h.*, c.nome as casa_nome 
      FROM tb_missionario_casas h 
      JOIN tb_casas_religiosas c ON h.casa_id = c.id 
      WHERE h.usuario_id = ? 
      ORDER BY h.data_inicio DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching casas-historico:', error);
    res.json([]);
  }
});

app.post('/api/usuarios/:id/casas-historico', authenticateToken, async (req, res) => {
  const { casa_id, data_inicio, data_fim, funcao, is_superior, pm, tipo, pais } = req.body;
  try {
    const dInicio = sanitizeDate(data_inicio);
    const dFim = sanitizeDate(data_fim);
    const superior = is_superior ? 1 : 0;
    // Build INSERT dynamically if optional columns exist
    const cols = ['usuario_id','casa_id','data_inicio','data_fim','funcao','is_superior'];
    const params = [req.params.id, casa_id, dInicio, dFim, funcao, superior];

    const [hasPm] = await db.query("SHOW COLUMNS FROM tb_missionario_casas LIKE 'pm'");
    const [hasTipo] = await db.query("SHOW COLUMNS FROM tb_missionario_casas LIKE 'tipo'");
    const [hasPais] = await db.query("SHOW COLUMNS FROM tb_missionario_casas LIKE 'pais'");

    if (hasPm.length > 0) { cols.push('pm'); params.push(pm || null); }
    if (hasTipo.length > 0) { cols.push('tipo'); params.push(tipo || null); }
    if (hasPais.length > 0) { cols.push('pais'); params.push(pais || null); }

    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO tb_missionario_casas (${cols.join(',')}) VALUES (${placeholders})`;
    const [result] = await db.query(sql, params);
    await logAction(req.user.id, 'ADICIONOU_CASA', 'tb_missionario_casas', `Usuário ${req.params.id} vinculado à casa ${casa_id}`);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/usuarios/:id/casas-historico/:vid', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM tb_missionario_casas WHERE id = ? AND usuario_id = ?', [req.params.vid, req.params.id]);
    await logAction(req.user.id, 'REMOVEU_CASA', 'tb_missionario_casas', `Vínculo ${req.params.vid} do usuário ${req.params.id} removido`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Specialized Profile Sections ---

// 1. Formação Acadêmica
app.get('/api/usuarios/:id/formacao-academica', authenticateToken, async (req, res) => {
  try {
    try {
      await db.query('ALTER TABLE tb_formacao_academica ADD COLUMN observacoes TEXT');
    } catch (_) {}
    const [rows] = await db.query('SELECT * FROM tb_formacao_academica WHERE usuario_id = ?', [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/usuarios/:id/formacao-academica', authenticateToken, async (req, res) => {
  const { curso, faculdade, periodo, doc_path, observacoes } = req.body;
  try {
    try {
      await db.query('ALTER TABLE tb_formacao_academica ADD COLUMN observacoes TEXT');
    } catch (_) {}
    await db.query('INSERT INTO tb_formacao_academica (usuario_id, curso, faculdade, periodo, doc_path, observacoes) VALUES (?, ?, ?, ?, ?, ?)', 
      [req.params.id, sanitizeString(curso), sanitizeString(faculdade), sanitizeString(periodo), sanitizeString(doc_path), sanitizeString(observacoes)]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in formacao-academica:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.put('/api/usuarios/:id/formacao-academica/:fid', authenticateToken, async (req, res) => {
  const { curso, faculdade, periodo, doc_path, observacoes } = req.body;
  try {
    try {
      await db.query('ALTER TABLE tb_formacao_academica ADD COLUMN observacoes TEXT');
    } catch (_) {}
    await db.query('UPDATE tb_formacao_academica SET curso = ?, faculdade = ?, periodo = ?, doc_path = ?, observacoes = ? WHERE id = ? AND usuario_id = ?', 
      [sanitizeString(curso), sanitizeString(faculdade), sanitizeString(periodo), sanitizeString(doc_path), sanitizeString(observacoes), req.params.fid, req.params.id]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in PUT formacao-academica:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.delete('/api/usuarios/:id/formacao-academica/:fid', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM tb_formacao_academica WHERE id = ? AND usuario_id = ?', [req.params.fid, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. Atividade Missionária
app.get('/api/usuarios/:id/atividade-missionaria', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_atividade_missionaria WHERE usuario_id = ?', [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/usuarios/:id/atividade-missionaria', authenticateToken, async (req, res) => {
  const { periodo, lugar, missao, doc_path, funcao_atividade } = req.body;
  try {
    try {
      await db.query('ALTER TABLE tb_atividade_missionaria ADD COLUMN funcao_atividade TEXT');
    } catch (_) {}
    await db.query('INSERT INTO tb_atividade_missionaria (usuario_id, periodo, lugar, missao, doc_path, funcao_atividade) VALUES (?, ?, ?, ?, ?, ?)', 
      [req.params.id, sanitizeString(periodo), sanitizeString(lugar), sanitizeString(missao), sanitizeString(doc_path), sanitizeString(funcao_atividade)]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in atividade-missionaria:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.put('/api/usuarios/:id/atividade-missionaria/:aid', authenticateToken, async (req, res) => {
  const { periodo, lugar, missao, doc_path, funcao_atividade } = req.body;
  try {
    try {
      await db.query('ALTER TABLE tb_atividade_missionaria ADD COLUMN funcao_atividade TEXT');
    } catch (_) {}
    await db.query('UPDATE tb_atividade_missionaria SET periodo = ?, lugar = ?, missao = ?, doc_path = ?, funcao_atividade = ? WHERE id = ? AND usuario_id = ?', 
      [sanitizeString(periodo), sanitizeString(lugar), sanitizeString(missao), sanitizeString(doc_path), sanitizeString(funcao_atividade), req.params.aid, req.params.id]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in PUT atividade-missionaria:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.delete('/api/usuarios/:id/atividade-missionaria/:aid', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM tb_atividade_missionaria WHERE id = ? AND usuario_id = ?', [req.params.aid, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. Saúde
app.get('/api/usuarios/:id/saude', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_saude WHERE usuario_id = ?', [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/usuarios/:id/saude', authenticateToken, async (req, res) => {
  const { sus_card, seguradora, numero_carteira, doc_path } = req.body;
  try {
    await db.query('INSERT INTO tb_saude (usuario_id, sus_card, seguradora, numero_carteira, doc_path) VALUES (?, ?, ?, ?, ?)', 
      [req.params.id, sanitizeString(sus_card), sanitizeString(seguradora), sanitizeString(numero_carteira), sanitizeString(doc_path)]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in saude:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.put('/api/usuarios/:id/saude/:sid', authenticateToken, async (req, res) => {
  const { sus_card, seguradora, numero_carteira, doc_path } = req.body;
  try {
    await db.query('UPDATE tb_saude SET sus_card = ?, seguradora = ?, numero_carteira = ?, doc_path = ? WHERE id = ? AND usuario_id = ?', 
      [sanitizeString(sus_card), sanitizeString(seguradora), sanitizeString(numero_carteira), sanitizeString(doc_path), req.params.sid, req.params.id]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in PUT saude:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.delete('/api/usuarios/:id/saude/:sid', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM tb_saude WHERE id = ? AND usuario_id = ?', [req.params.sid, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 4. Contas Bancárias
app.get('/api/usuarios/:id/contas-bancarias', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_contas_bancarias WHERE usuario_id = ?', [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/usuarios/:id/contas-bancarias', authenticateToken, async (req, res) => {
  const { tipo_conta, titularidade, agencia, numero, doc_path } = req.body;
  try {
    await db.query('INSERT INTO tb_contas_bancarias (usuario_id, tipo_conta, titularidade, agencia, numero, doc_path) VALUES (?, ?, ?, ?, ?, ?)', 
      [req.params.id, sanitizeString(tipo_conta), sanitizeString(titularidade), sanitizeString(agencia), sanitizeString(numero), sanitizeString(doc_path)]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in contas-bancarias:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.put('/api/usuarios/:id/contas-bancarias/:bid', authenticateToken, async (req, res) => {
  const { tipo_conta, titularidade, agencia, numero, doc_path } = req.body;
  try {
    await db.query('UPDATE tb_contas_bancarias SET tipo_conta = ?, titularidade = ?, agencia = ?, numero = ?, doc_path = ? WHERE id = ? AND usuario_id = ?', 
      [sanitizeString(tipo_conta), sanitizeString(titularidade), sanitizeString(agencia), sanitizeString(numero), sanitizeString(doc_path), req.params.bid, req.params.id]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in PUT contas-bancarias:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.delete('/api/usuarios/:id/contas-bancarias/:bid', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM tb_contas_bancarias WHERE id = ? AND usuario_id = ?', [req.params.bid, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 5. Obras Realizadas
app.get('/api/usuarios/:id/obras-realizadas', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_obras_realizadas WHERE usuario_id = ?', [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/usuarios/:id/obras-realizadas', authenticateToken, async (req, res) => {
  const { periodo, lugar, obra, doc_path } = req.body;
  try {
    await db.query('INSERT INTO tb_obras_realizadas (usuario_id, periodo, lugar, obra, doc_path) VALUES (?, ?, ?, ?, ?)', 
      [req.params.id, sanitizeString(periodo), sanitizeString(lugar), sanitizeString(obra), sanitizeString(doc_path)]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in obras-realizadas:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.put('/api/usuarios/:id/obras-realizadas/:oid', authenticateToken, async (req, res) => {
  const { periodo, lugar, obra, doc_path } = req.body;
  try {
    await db.query('UPDATE tb_obras_realizadas SET periodo = ?, lugar = ?, obra = ?, doc_path = ? WHERE id = ? AND usuario_id = ?', 
      [sanitizeString(periodo), sanitizeString(lugar), sanitizeString(obra), sanitizeString(doc_path), req.params.oid, req.params.id]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in PUT obras-realizadas:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.delete('/api/usuarios/:id/obras-realizadas/:oid', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM tb_obras_realizadas WHERE id = ? AND usuario_id = ?', [req.params.oid, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Quadro de Pessoal
app.get('/api/usuarios/:id/quadro-pessoal', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_quadro_pessoal WHERE usuario_id = ?', [req.params.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/quadro-pessoal', authenticateToken, async (req, res) => {
  const { funcao_atual, competencias, cv_path } = req.body;
  try {
    await db.query('DELETE FROM tb_quadro_pessoal WHERE usuario_id = ?', [req.params.id]);
    await db.query(
      'INSERT INTO tb_quadro_pessoal (usuario_id, funcao_atual, competencias, cv_path) VALUES (?, ?, ?, ?)',
      [req.params.id, funcao_atual, competencias, cv_path]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 6. Observações Gerais
app.get('/api/usuarios/:id/observacoes-gerais', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_observacoes_gerais WHERE usuario_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/usuarios/:id/observacoes-gerais', authenticateToken, async (req, res) => {
  const { texto, doc_path } = req.body;
  try {
    await db.query('INSERT INTO tb_observacoes_gerais (usuario_id, texto, doc_path) VALUES (?, ?, ?)', 
      [req.params.id, sanitizeString(texto), sanitizeString(doc_path)]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in observacoes-gerais:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.put('/api/usuarios/:id/observacoes-gerais/:oid', authenticateToken, async (req, res) => {
  const { texto, doc_path } = req.body;
  try {
    await db.query('UPDATE tb_observacoes_gerais SET texto = ?, doc_path = ? WHERE id = ? AND usuario_id = ?', 
      [sanitizeString(texto), sanitizeString(doc_path), req.params.oid, req.params.id]);
    res.json({ success: true });
  } catch (err) { 
    console.error('Error in PUT observacoes-gerais:', err);
    res.status(500).json({ message: err.message }); 
  }
});

app.delete('/api/usuarios/:id/observacoes-gerais/:oid', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM tb_observacoes_gerais WHERE id = ? AND usuario_id = ?', [req.params.oid, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 8. Situação do Missionário (Campos condicionais)
app.get('/api/usuarios/:id/situacao', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_dados_situacao WHERE usuario_id = ?', [req.params.id]);
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/usuarios/:id/situacao', authenticateToken, async (req, res) => {
  const {
    data_falecimento, cidade_falecimento, certidao_obito_path, local_sepultamento,
    egresso_incardinado_path, egresso_desistencia_path, egresso_laicizado_path,
    egresso_transf_sacerdotes_path,
    egresso_transf_para_regiao_path, egresso_transf_da_regiao_path,
    exclaustrado_data, exclaustrado_processo, exclaustrado_doc_path
  } = req.body;
  
  try {
    const [existing] = await db.query('SELECT id FROM tb_dados_situacao WHERE usuario_id = ?', [req.params.id]);
    
    if (existing.length > 0) {
      await db.query(`
        UPDATE tb_dados_situacao SET 
          data_falecimento = ?, cidade_falecimento = ?, 
          certidao_obito_path = COALESCE(?, certidao_obito_path), 
          local_sepultamento = ?,
          egresso_incardinado_path = COALESCE(?, egresso_incardinado_path), 
          egresso_desistencia_path = COALESCE(?, egresso_desistencia_path), 
          egresso_laicizado_path = COALESCE(?, egresso_laicizado_path),
          egresso_transf_sacerdotes_path = COALESCE(?, egresso_transf_sacerdotes_path),
          egresso_transf_para_regiao_path = COALESCE(?, egresso_transf_para_regiao_path), 
          egresso_transf_da_regiao_path = COALESCE(?, egresso_transf_da_regiao_path),
          exclaustrado_data = ?, exclaustrado_processo = ?, 
          exclaustrado_doc_path = COALESCE(?, exclaustrado_doc_path)
        WHERE usuario_id = ?
      `, [
        sanitizeDate(data_falecimento), 
        sanitizeString(cidade_falecimento), 
        sanitizeString(certidao_obito_path), 
        sanitizeString(local_sepultamento),
        sanitizeString(egresso_incardinado_path), 
        sanitizeString(egresso_desistencia_path), 
        sanitizeString(egresso_laicizado_path),
        sanitizeString(egresso_transf_sacerdotes_path),
        sanitizeString(egresso_transf_para_regiao_path), 
        sanitizeString(egresso_transf_da_regiao_path),
        sanitizeDate(exclaustrado_data), 
        sanitizeString(exclaustrado_processo), 
        sanitizeString(exclaustrado_doc_path),
        req.params.id
      ]);
    } else {
      await db.query(`
        INSERT INTO tb_dados_situacao (
          usuario_id, data_falecimento, cidade_falecimento, certidao_obito_path, local_sepultamento,
          egresso_incardinado_path, egresso_desistencia_path, egresso_laicizado_path,
          egresso_transf_sacerdotes_path,
          egresso_transf_para_regiao_path, egresso_transf_da_regiao_path,
          exclaustrado_data, exclaustrado_processo, exclaustrado_doc_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.params.id, 
        sanitizeDate(data_falecimento), 
        sanitizeString(cidade_falecimento), 
        sanitizeString(certidao_obito_path), 
        sanitizeString(local_sepultamento),
        sanitizeString(egresso_incardinado_path), 
        sanitizeString(egresso_desistencia_path), 
        sanitizeString(egresso_laicizado_path),
        sanitizeString(egresso_transf_sacerdotes_path),
        sanitizeString(egresso_transf_para_regiao_path), 
        sanitizeString(egresso_transf_da_regiao_path),
        sanitizeDate(exclaustrado_data), 
        sanitizeString(exclaustrado_processo),
        sanitizeString(exclaustrado_doc_path)
      ]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error in situacao:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload de documento específico de situação
app.post('/api/usuarios/:id/situacao/upload-doc', authenticateToken, (req, res) => {
  upload.single('arquivo')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });

    const campo = req.body.campo;
    const allowedCampos = [
      'certidao_obito_path',
      'egresso_incardinado_path',
      'egresso_desistencia_path',
      'egresso_laicizado_path',
      'egresso_transf_sacerdotes_path',
      'egresso_transf_para_regiao_path',
      'egresso_transf_da_regiao_path',
      'exclaustrado_doc_path'
    ];
    if (!allowedCampos.includes(campo)) {
      return res.status(400).json({ message: 'Campo inválido' });
    }

    const filePath = `/uploads/documentos/${req.file.filename}`;
    try {
      const [existing] = await db.query('SELECT id FROM tb_dados_situacao WHERE usuario_id = ?', [req.params.id]);
      if (existing.length > 0) {
        await db.query(`UPDATE tb_dados_situacao SET \`${campo}\` = ? WHERE usuario_id = ?`, [filePath, req.params.id]);
      } else {
        await db.query(`INSERT INTO tb_dados_situacao (usuario_id, \`${campo}\`) VALUES (?, ?)`, [req.params.id, filePath]);
      }
      res.json({ success: true, filePath, campo });
    } catch (error) {
      console.error('Error uploading situacao doc:', error);
      res.status(500).json({ message: error.message });
    }
  });
});

// Remover documento específico de situação
const handleRemoveSituacaoDoc = async (req, res) => {
  const { id, campo } = req.params;
  const allowedCampos = [
    'certidao_obito_path',
    'egresso_incardinado_path',
    'egresso_desistencia_path',
    'egresso_laicizado_path',
    'egresso_transf_sacerdotes_path',
    'egresso_transf_para_regiao_path',
    'egresso_transf_da_regiao_path',
    'exclaustrado_doc_path'
  ];
  if (!allowedCampos.includes(campo)) {
    return res.status(400).json({ message: 'Campo inválido' });
  }

  try {
    await db.query(`UPDATE tb_dados_situacao SET \`${campo}\` = NULL WHERE usuario_id = ?`, [id]);
    res.json({ success: true, message: 'Documento removido com sucesso', campo });
  } catch (error) {
    console.error('Error removing situacao doc:', error);
    res.status(500).json({ message: error.message });
  }
};

app.delete('/api/usuarios/:id/situacao/doc/:campo', authenticateToken, handleRemoveSituacaoDoc);
app.post('/api/usuarios/:id/situacao/doc/:campo/delete', authenticateToken, handleRemoveSituacaoDoc);

app.get('/api/financas-casa/casa/:casa_id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT f.*, u.nome as registrado_por_nome 
      FROM tb_financas_casa f 
      LEFT JOIN tb_usuarios u ON f.registrado_por = u.id 
      WHERE f.casa_id = ? 
      ORDER BY f.data DESC
    `, [req.params.casa_id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Monthly Financial Spreadsheets (Planilhas Mensais) ---

app.get('/api/financas-mensais/usuario/:usuario_id/mes/:mes', authenticateToken, async (req, res) => {
  const { usuario_id, mes } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM tb_financas_mensais WHERE usuario_id = ? AND mes_referencia = ?', [usuario_id, mes]);
    if (rows.length === 0) return res.json(null);
    
    const [itens] = await db.query('SELECT * FROM tb_financas_mensais_itens WHERE planilha_id = ?', [rows[0].id]);
    res.json({ ...rows[0], itens });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/financas-mensais/usuario/:id/extratos', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT id, mes_referencia, total_credito, total_debito, (total_credito - total_debito) as saldo, updated_at as data_validacao
      FROM tb_financas_mensais
      WHERE usuario_id = ? AND status = 'VALIDADO'
      ORDER BY created_at DESC
    `, [id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/financas-mensais/pendentes/casa/:casa_id', authenticateToken, async (req, res) => {
  const { casa_id } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT p.id, p.usuario_id, u.nome as nome_missionario, p.mes_referencia, p.status, p.updated_at
      FROM tb_financas_mensais p
      JOIN tb_usuarios u ON p.usuario_id = u.id
      WHERE p.casa_id = ? AND p.status IN ('PENDENTE', 'EM_VALIDACAO')
      AND ${HIDDEN_USERS_ALIAS_SQL('u')}
      ORDER BY p.updated_at DESC
    `, [casa_id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/financas-mensais/historico/casa/:casa_id', authenticateToken, async (req, res) => {
  const { casa_id } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT p.id, p.usuario_id, u.nome as nome_missionario, p.mes_referencia, p.status, p.updated_at
      FROM tb_financas_mensais p
      JOIN tb_usuarios u ON p.usuario_id = u.id
      WHERE p.casa_id = ? AND p.status IN ('VALIDADO', 'DEVOLVIDO')
      AND ${HIDDEN_USERS_ALIAS_SQL('u')}
      ORDER BY p.updated_at DESC
    `, [casa_id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/financas-mensais', authenticateToken, async (req, res) => {
  const { usuario_id, casa_id, mes_referencia, itens, total_credito, total_debito, num_missas_superior, anexo_path, obs_receita, obs_despesa, status } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if exists
    const [existing] = await connection.query('SELECT id, status FROM tb_financas_mensais WHERE usuario_id = ? AND mes_referencia = ?', [usuario_id, mes_referencia]);
    
    let planilhaId;
    if (existing.length > 0) {
      if (existing[0].status === 'VALIDADO' && req.user.role !== 'ADMIN_GERAL') {
         throw new Error('Esta planilha já foi validada e não pode ser editada.');
      }
      planilhaId = existing[0].id;
      await connection.query(
        'UPDATE tb_financas_mensais SET total_credito = ?, total_debito = ?, num_missas_superior = ?, anexo_path = ?, obs_receita = ?, obs_despesa = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [total_credito, total_debito, num_missas_superior || 0, anexo_path || null, obs_receita || null, obs_despesa || null, status || 'PENDENTE', planilhaId]
      );
      // Clean old items
      await connection.query('DELETE FROM tb_financas_mensais_itens WHERE planilha_id = ?', [planilhaId]);
    } else {
      const [result] = await connection.query(
        'INSERT INTO tb_financas_mensais (usuario_id, casa_id, mes_referencia, total_credito, total_debito, num_missas_superior, anexo_path, obs_receita, obs_despesa, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [usuario_id, casa_id, mes_referencia, total_credito, total_debito, num_missas_superior || 0, anexo_path || null, obs_receita || null, obs_despesa || null, status || 'PENDENTE']
      );
      planilhaId = result.insertId;
    }

    // Insert items
    for (const item of itens) {
      if (item.valor > 0) {
        await connection.query(
          'INSERT INTO tb_financas_mensais_itens (planilha_id, categoria_id, valor, observacao) VALUES (?, ?, ?, ?)',
          [planilhaId, item.categoria_id, item.valor, item.observacao || null]
        );
      }
    }

    await connection.commit();
    // 4. Mark notifications for this month as read/cleared
    await db.query(`
      UPDATE tb_notificacoes 
      SET lida = TRUE 
      WHERE usuario_id = ? AND mensagem LIKE ?
    `, [usuario_id, `%planilha de ${mes_referencia} foi devolvida%`]);

    // Notificação ao Ecônomo Local
    if (casa_id) {
      const [oconomos] = await connection.query(`
        SELECT u.id 
        FROM tb_usuarios u
        JOIN tb_missionario_casas mc ON u.id = mc.usuario_id
        WHERE mc.casa_id = ? AND u.is_oconomo = 1 AND u.id != ? AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE())
      `, [casa_id, usuario_id]);
      const [missionario] = await connection.query('SELECT nome FROM tb_usuarios WHERE id = ?', [usuario_id]);
      const missNome = missionario[0]?.nome || 'Um missionário';
      
      for (const oc of oconomos) {
        await connection.query(
          'INSERT INTO tb_notificacoes (usuario_id, mensagem, tipo, link_path) VALUES (?, ?, ?, ?)',
          [oc.id, `${missNome} acabou de finalizar e enviou sua planilha de ${mes_referencia} para que você valide e faça suas considerações!`, 'SISTEMA', '/financeiro?tab=validacoes_pendentes']
        );
      }
    }

    res.json({ success: true, id: planilhaId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/financas-mensais/consolidado/casa/:casa_id/mes/:mes', authenticateToken, async (req, res) => {
  const { casa_id, mes } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT p.*, u.nome as usuario_nome 
      FROM tb_financas_mensais p
      JOIN tb_usuarios u ON p.usuario_id = u.id
      WHERE p.casa_id = ? AND p.mes_referencia = ?
      AND ${HIDDEN_USERS_ALIAS_SQL('u')}
    `, [casa_id, mes]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/financas-casa/consolidado/status/:casa_id/:mes', authenticateToken, async (req, res) => {
  const { casa_id, mes } = req.params;
  const targetUid = req.query.usuario_id;
  try {
    let query = 'SELECT * FROM tb_financas_consolidado WHERE casa_id = ? AND mes_referencia = ?';
    let params = [casa_id, mes];
    if (targetUid) {
      query += ' AND usuario_id = ?';
      params.push(targetUid);
    }
    query += ' ORDER BY id DESC LIMIT 1';
    const [rows] = await db.query(query, params);
    if (rows.length === 0) {
       // Return a default object if it doesn't exist
       return res.json({ status: 'PENDENTE_ECONOMO', casa_id, mes_referencia: mes });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/financas-casa/consolidado/status/:casa_id/:mes', authenticateToken, async (req, res) => {
  const { casa_id, mes } = req.params;
  const { status, apontamentos_economo, apontamentos_superior, usuario_id } = req.body;
  const targetUid = usuario_id || req.user.id;
  try {
    const [existing] = await db.query('SELECT id FROM tb_financas_consolidado WHERE casa_id = ? AND mes_referencia = ? AND usuario_id = ?', [casa_id, mes, targetUid]);
    if (existing.length > 0) {
       await db.query(
         'UPDATE tb_financas_consolidado SET status = ?, apontamentos_economo = IFNULL(?, apontamentos_economo), apontamentos_superior = IFNULL(?, apontamentos_superior), validado_por = ? WHERE id = ?',
         [status, apontamentos_economo, apontamentos_superior, req.user.id, existing[0].id]
       );
    } else {
       await db.query(
         'INSERT INTO tb_financas_consolidado (casa_id, mes_referencia, status, apontamentos_economo, apontamentos_superior, validado_por, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
         [casa_id, mes, status, apontamentos_economo, apontamentos_superior, req.user.id, targetUid]
       );
    }

    // Handle Notifications for Community Spreadsheet
    if (status === 'APROVADO' || status === 'DEVOLVIDO_SUPERIOR') {
      const [casaRows] = await db.query('SELECT nome FROM tb_casas_religiosas WHERE id = ?', [casa_id]);
      const casaNome = casaRows[0]?.nome || '';
      
      const [valRows] = await db.query('SELECT nome FROM tb_usuarios WHERE id = ?', [req.user.id]);
      const valNome = valRows[0]?.nome || 'Desconhecido';
      
      const [economos] = await db.query(`
        SELECT u.id FROM tb_usuarios u
        JOIN tb_missionario_casas mc ON u.id = mc.usuario_id
        WHERE mc.casa_id = ? AND u.is_oconomo = 1 AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE())
      `, [casa_id]);
      
      for (const eco of economos) {
        let msg = '';
        if (status === 'APROVADO') {
          msg = `A prestação de contas da casa religiosa (${casaNome}) de ${mes} foi aprovada por ${valNome}.`;
        } else {
          msg = `A prestação de contas da casa religiosa (${casaNome}) de ${mes} foi devolvida por ${valNome}. Motivo: ${apontamentos_economo || apontamentos_superior || 'Não especificado'}`;
        }
        await createNotification(
          eco.id,
          msg,
          status === 'APROVADO' ? 'INFO' : 'ALERTA',
          `/financeiro?mes=${mes}&tab=comunidade`
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Community Monthly Financials (Planilhas de Comunidade - Perfil 2) ---
app.get('/api/financas-comunidade/:casa_id/:mes', authenticateToken, async (req, res) => {
  const { casa_id, mes } = req.params;
  try {
    // 1. Get validated missionary items for this house and month
    const [missionaryItens] = await db.query(`
      SELECT it.categoria_id, it.valor, cat.codigo, cat.tipo
      FROM tb_financas_mensais_itens it
      JOIN tb_financas_mensais p ON it.planilha_id = p.id
      JOIN tb_categorias_financas cat ON it.categoria_id = cat.id
      WHERE p.casa_id = ? AND p.mes_referencia = ? AND p.status = 'VALIDADO'
    `, [casa_id, mes]);

    // 2. Fetch all categories of PERFIL_2
    const [perfil2Cats] = await db.query(`
      SELECT id, codigo, tipo FROM tb_categorias_financas WHERE perfil = 'PERFIL_2'
    `);

    // Helper to normalize codes for safe matching (e.g. 42.02 and 42.2)
    const normalizeCode = (code) => {
      if (!code) return '';
      return code.split('.')
                 .map(part => {
                   const num = parseInt(part, 10);
                   return isNaN(num) ? part : num.toString();
                 })
                 .join('.');
    };

    // 3. Map missionary items (PERFIL_1) to community categories (PERFIL_2) by matching code and type
    const missionarySums = {};
    perfil2Cats.forEach(cat => {
      missionarySums[cat.id] = 0;
    });

    missionaryItens.forEach(it => {
      const normItCode = normalizeCode(it.codigo);
      const p2cat = perfil2Cats.find(c => normalizeCode(c.codigo) === normItCode && c.tipo === it.tipo);
      if (p2cat) {
        missionarySums[p2cat.id] += parseFloat(it.valor);
      }
    });

    // 4. Fetch consolidated house data
    const targetUid = req.query.usuario_id;
    let queryConsolidado = 'SELECT * FROM tb_financas_consolidado WHERE casa_id = ? AND mes_referencia = ?';
    let paramsConsolidado = [casa_id, mes];
    if (targetUid) {
      queryConsolidado += ' AND usuario_id = ?';
      paramsConsolidado.push(targetUid);
    }
    queryConsolidado += ' ORDER BY id DESC LIMIT 1';
    const [rows] = await db.query(queryConsolidado, paramsConsolidado);

    if (rows.length === 0) {
      return res.json({
        id: null,
        casa_id: parseInt(casa_id),
        mes_referencia: mes,
        status: 'PENDENTE_ECONOMO',
        total_credito: 0,
        total_debito: 0,
        num_missas_superior: 0,
        anexo_path: null,
        itens: [],
        missionarySums
      });
    }

    const [itens] = await db.query(
      'SELECT * FROM tb_financas_consolidado_itens WHERE consolidado_id = ?',
      [rows[0].id]
    );

    res.json({ ...rows[0], itens, missionarySums });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/financas-comunidade', authenticateToken, async (req, res) => {
  const { casa_id, mes_referencia, total_credito, total_debito, num_missas_superior, anexo_path, status, itens } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if it exists
    const [existing] = await connection.query(
      'SELECT id, status FROM tb_financas_consolidado WHERE casa_id = ? AND mes_referencia = ? AND usuario_id = ?',
      [casa_id, mes_referencia, req.user.id]
    );

    let consolidadoId;
    if (existing.length > 0) {
      consolidadoId = existing[0].id;
      // Update
      await connection.query(
        'UPDATE tb_financas_consolidado SET total_credito = ?, total_debito = ?, num_missas_superior = ?, anexo_path = ?, status = ? WHERE id = ?',
        [total_credito, total_debito, num_missas_superior, anexo_path, status || 'PENDENTE_ECONOMO', consolidadoId]
      );
      // Clean old items
      await connection.query('DELETE FROM tb_financas_consolidado_itens WHERE consolidado_id = ?', [consolidadoId]);
    } else {
      // Insert new
      const [result] = await connection.query(
        'INSERT INTO tb_financas_consolidado (casa_id, mes_referencia, total_credito, total_debito, num_missas_superior, anexo_path, status, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [casa_id, mes_referencia, total_credito, total_debito, num_missas_superior, anexo_path, status || 'PENDENTE_ECONOMO', req.user.id]
      );
      consolidadoId = result.insertId;
    }

    // Insert new items
    for (const item of itens) {
      if (item.valor > 0) {
        await connection.query(
          'INSERT INTO tb_financas_consolidado_itens (consolidado_id, categoria_id, valor, observacao) VALUES (?, ?, ?, ?)',
          [consolidadoId, item.categoria_id, item.valor, item.observacao || null]
        );
      }
    }

    await connection.commit();

    // Notify Regional Economists if ENVIADO_REGIONAL
    if (status === 'ENVIADO_REGIONAL') {
      try {
        const [casaRows] = await db.query('SELECT nome FROM tb_casas_religiosas WHERE id = ?', [casa_id]);
        const casaNome = casaRows[0]?.nome || '';
        
        const [userRows] = await db.query('SELECT nome FROM tb_usuarios WHERE id = ?', [req.user.id]);
        const userNome = userRows[0]?.nome || 'Desconhecido';
        
        const [regRows] = await db.query("SELECT id FROM tb_usuarios WHERE role = 'ECONOMO_REGIONAL' AND status = 'ATIVO'");
        
        for (const reg of regRows) {
          await createNotification(
            reg.id,
            `O ecônomo local ${userNome} enviou a prestação de contas da casa religiosa (${casaNome}) de ${mes_referencia} para validação.`,
            'INFO',
            `/financeiro?mes=${mes_referencia}&tab=validacoes_pendentes`
          );
        }
      } catch (err) {
        console.error('Error sending regional notifications:', err);
      }
    }

    res.json({ success: true, id: consolidadoId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
});


app.put('/api/financas-mensais/:id/validar', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, apontamentos } = req.body;
  try {
    // 1. Update status and validador
    await db.query(
      'UPDATE tb_financas_mensais SET status = ?, apontamentos = ?, validado_por = ? WHERE id = ?',
      [status, apontamentos, req.user.id, id]
    );

    // 2. Log Action
    await logAction(req.user.id, 'VALIDAR_PLANILHA_MENSAL', 'tb_financas_mensais', `Planilha ${id} validada como ${status}`);

    // 3. Handle Notifications
    const [sheet] = await db.query('SELECT usuario_id, casa_id, mes_referencia FROM tb_financas_mensais WHERE id = ?', [id]);
    if (sheet.length > 0) {
      const { usuario_id, casa_id, mes_referencia } = sheet[0];
      
      // Notify the missionary if returned
      if (status === 'DEVOLVIDO') {
        await createNotification(
          usuario_id, 
          `Sua planilha de ${mes_referencia} foi devolvida para correções. Motivo: ${apontamentos || 'Não especificado'}`,
          'ALERTA',
          `/financeiro?mes=${mes_referencia}`
        );
      }

      // Notify the Economist of the house if the action was taken by a Superior or Admin
      const [userRows] = await db.query('SELECT is_superior, role FROM tb_usuarios WHERE id = ?', [req.user.id]);
      const sender = userRows[0];
      if (sender && (sender.is_superior || sender.role === 'ADMIN_GERAL')) {
        const [economos] = await db.query(`
          SELECT u.id FROM tb_usuarios u
          JOIN tb_missionario_casas mc ON u.id = mc.usuario_id
          WHERE mc.casa_id = ? AND u.is_oconomo = 1 AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE())
        `, [casa_id]);
        
        for (const eco of economos) {
          if (eco.id !== req.user.id) {
            await createNotification(
              eco.id,
              `A planilha de ${mes_referencia} (${usuario_id}) foi ${status === 'VALIDADO' ? 'validada' : 'devolvida'} pelo Superior/Admin.`,
              'INFO',
              '/gestao-financeira'
            );
          }
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/financas-casa', authenticateToken, async (req, res) => {
  const { casa_id, descricao, valor, tipo_transacao, data, status, categoria_id, tipo_despesa } = req.body;
  try {
    const defaultStatus = status || 'PENDENTE';
    const dLanc = sanitizeDate(data);
    const [result] = await db.query(
      'INSERT INTO tb_financas_casa (casa_id, registrado_por, descricao, valor, tipo_transacao, data, status, categoria_id, tipo_despesa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [casa_id, req.user.id, descricao, valor, tipo_transacao, dLanc, defaultStatus, categoria_id || null, tipo_despesa || 'CASA']
    );
    await logAction(req.user.id, 'LANCAMENTO_FINANCEIRO', 'tb_financas_casa', `Lançamento de ${tipo_transacao} na casa ${casa_id} - R$ ${valor}`);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/financas-casa/:id', authenticateToken, async (req, res) => {
  try {
    const { casa_id, descricao, valor, tipo_transacao, data, status, categoria_id, tipo_despesa, apontamento_texto } = req.body;
    
    // Get existing data to know who to notify
    const [existing] = await db.query('SELECT registrado_por, descricao, casa_id FROM tb_financas_casa WHERE id = ?', [req.params.id]);
    
    const dLanc = data ? sanitizeDate(data) : undefined;
    
    let updateQuery = 'UPDATE tb_financas_casa SET id = id'; // dummy start
    const params = [];

    if (casa_id) { updateQuery += ', casa_id = ?'; params.push(casa_id); }
    if (descricao) { updateQuery += ', descricao = ?'; params.push(descricao); }
    if (valor !== undefined) { updateQuery += ', valor = ?'; params.push(valor); }
    if (tipo_transacao) { updateQuery += ', tipo_transacao = ?'; params.push(tipo_transacao); }
    if (dLanc !== undefined) { updateQuery += ', data = ?'; params.push(dLanc); }
    if (status) { updateQuery += ', status = ?'; params.push(status); }
    if (categoria_id !== undefined) { updateQuery += ', categoria_id = ?'; params.push(categoria_id); }
    if (tipo_despesa) { updateQuery += ', tipo_despesa = ?'; params.push(tipo_despesa); }
    if (apontamento_texto !== undefined) { updateQuery += ', apontamento_texto = ?'; params.push(apontamento_texto); }

    updateQuery += ' WHERE id = ?';
    params.push(req.params.id);

    await db.query(updateQuery, params);
    
    await logAction(req.user.id, 'ATUALIZAR_FINANCAS', 'tb_financas_casa', `Lançamento ID ${req.params.id} ("${descricao || 'sem desc'}") atualizado - Status: ${status}`);
    
    // Notify user if it's an "Apontamento"
    if (status === 'APONTAMENTO' && existing.length > 0) {
      const msg = `Correção solicitada no lançamento: "${existing[0].descricao}". Motivo: ${apontamento_texto}`;
      await createNotification(existing[0].registrado_por, msg, 'ALERTA', `/missionarios/${existing[0].registrado_por}`);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/financas-casa/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT descricao, valor FROM tb_financas_casa WHERE id = ?', [req.params.id]);
    const info = rows.length > 0 ? `"${rows[0].descricao}" (R$ ${rows[0].valor})` : `ID ${req.params.id}`;

    await db.query('DELETE FROM tb_financas_casa WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'DELETAR_FINANCAS', 'tb_financas_casa', `Lançamento ${info} excluído`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Consolidated Financial Report
app.get('/api/financas-casa/relatorio', authenticateToken, async (req, res) => {
  const { casa_id, status, data_inicio, data_fim, tipo_despesa } = req.query;
  try {
    let query = `
      SELECT f.*, u.nome as registrado_por_nome, c.nome as casa_nome, cat.nome as categoria_nome 
      FROM tb_financas_casa f 
      LEFT JOIN tb_usuarios u ON f.registrado_por = u.id 
      LEFT JOIN tb_casas_religiosas c ON f.casa_id = c.id 
      LEFT JOIN tb_categorias_financas cat ON f.categoria_id = cat.id
      WHERE 1=1
    `;
    const params = [];

    if (casa_id) { query += ' AND f.casa_id = ?'; params.push(casa_id); }
    if (status) { query += ' AND f.status = ?'; params.push(status); }
    if (data_inicio) { query += ' AND f.data >= ?'; params.push(data_inicio); }
    if (data_fim) { query += ' AND f.data <= ?'; params.push(data_fim); }
    if (tipo_despesa) { query += ' AND f.tipo_despesa = ?'; params.push(tipo_despesa); }

    query += ' ORDER BY f.data DESC, f.id DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/financas-casa/sumario', authenticateToken, async (req, res) => {
  const { casa_id, data_inicio, data_fim, tipo_despesa } = req.query;
  try {
    let query = 'SELECT tipo_transacao, SUM(valor) as total FROM tb_financas_casa WHERE 1=1';
    const params = [];

    if (casa_id) { query += ' AND casa_id = ?'; params.push(casa_id); }
    if (data_inicio) { query += ' AND data >= ?'; params.push(data_inicio); }
    if (data_fim) { query += ' AND data <= ?'; params.push(data_fim); }
    if (tipo_despesa) { query += ' AND tipo_despesa = ?'; params.push(tipo_despesa); }

    query += ' GROUP BY tipo_transacao';

    const [rows] = await db.query(query, params);
    
    const summary = {
      credito: 0,
      debito: 0,
      saldo: 0
    };

    rows.forEach(row => {
      if (row.tipo_transacao === 'CREDITO') summary.credito = row.total;
      if (row.tipo_transacao === 'DEBITO') summary.debito = row.total;
    });

    summary.saldo = summary.credito - summary.debito;
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Analytics Dashboard Endpoint
app.get('/api/financas-casa/estatisticas', authenticateToken, async (req, res) => {
  try {
    // 1. Totals by house
    const [houseTotals] = await db.query(`
      SELECT c.nome, SUM(f.valor) as total, f.tipo_transacao
      FROM tb_financas_casa f
      JOIN tb_casas_religiosas c ON f.casa_id = c.id
      GROUP BY c.id, f.tipo_transacao
    `);

    // 2. Data by month (last 6 months)
    const [monthlyStats] = await db.query(`
      SELECT DATE_FORMAT(data, '%Y-%m') as mes, tipo_transacao, SUM(valor) as total
      FROM tb_financas_casa
      WHERE data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY mes, tipo_transacao
      ORDER BY mes ASC
    `);

    // 3. Largest single transactions
    const [largeTransactions] = await db.query(`
      SELECT f.*, c.nome as casa_nome
      FROM tb_financas_casa f
      JOIN tb_casas_religiosas c ON f.casa_id = c.id
      ORDER BY valor DESC LIMIT 5
    `);

    res.json({ houseTotals, monthlyStats, largeTransactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Access Logs Endpoint
app.get('/api/logs-acesso', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, u.nome as usuario_nome, u.login as usuario_login
      FROM tb_logs_acesso l
      LEFT JOIN tb_usuarios u ON l.usuario_id = u.id
      WHERE u.login IS NULL OR ${HIDDEN_USERS_ALIAS_SQL('u')}
      ORDER BY l.created_at DESC LIMIT 200
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Documents
app.get('/api/usuarios/:id/documentos', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM tb_documentos WHERE usuario_id = ? AND descricao NOT LIKE 'Documento formacao-academica%' AND descricao NOT LIKE 'Documento quadro-pessoal%' ORDER BY created_at DESC`,
      [req.params.id]
    );
    // Map to frontend-expected shape: url (from arquivo_path) and data_upload (from created_at)
    const BASE_URL = process.env.BASE_URL || '';
    const docs = rows.map(r => ({
      ...r,
      url: r.arquivo_path ? `${BASE_URL}${r.arquivo_path}` : null,
      data_upload: r.created_at
    }));
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Dedicated Attachment Upload (Does NOT insert into tb_documentos)
app.post(['/api/upload-anexo', '/api/usuarios/:id/upload-anexo'], authenticateToken, (req, res, next) => {
  upload.single('arquivo')(req, res, (err) => {
    if (err) {
      console.error('[ATTACHMENT UPLOAD ERROR]', err.message);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado.' });
  const filePath = `/uploads/documentos/${req.file.filename}`;
  const BASE_URL = process.env.BASE_URL || '';
  res.json({
    success: true,
    arquivo_path: filePath,
    url: `${BASE_URL}${filePath}`,
    filename: req.file.filename,
    original_name: sanitizeFilename(req.file.originalname)
  });
});

app.post('/api/usuarios/:id/documentos', authenticateToken, (req, res, next) => {
  // Wrap multer to catch file-type/size errors with a friendly message
  upload.single('arquivo')(req, res, (err) => {
    if (err) {
      console.error('[UPLOAD ERROR]', err.message);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, async (req, res) => {
  const { descricao } = req.body;
  if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado. Selecione um arquivo PDF, JPG ou PNG.' });
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  // Sanitize filename to handle macOS NFD unicode / special chars that break MySQL latin1 columns
  const safeFilename = sanitizeFilename(req.file.originalname);
  try {
    const filePath = `/uploads/documentos/${req.file.filename}`;
    const BASE_URL = process.env.BASE_URL || '';
    const [result] = await db.query(
      'INSERT INTO tb_documentos (usuario_id, descricao, arquivo_path, arquivo_nome, tipo_arquivo) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, sanitizeString(descricao) || 'Documento', filePath, safeFilename, ext]
    );
    await logAction(req.user.id, 'UPLOAD_DOCUMENTO', 'tb_documentos', `Documento "${descricao}" enviado para usuario ${req.params.id}`);
    res.json({
      success: true,
      id: result.insertId,
      arquivo_path: filePath,
      url: `${BASE_URL}${filePath}`,
      arquivo_nome: safeFilename,
      tipo_arquivo: ext,
      descricao: sanitizeString(descricao) || 'Documento',
      data_upload: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DOC INSERT ERROR]', error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/usuarios/:id/documentos/:doc_id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_documentos WHERE id = ? AND usuario_id = ?', [req.params.doc_id, req.params.id]);
    if (rows.length > 0) {
      const fullPath = path.join(__dirname, rows[0].arquivo_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await db.query('DELETE FROM tb_documentos WHERE id = ? AND usuario_id = ?', [req.params.doc_id, req.params.id]);
    await logAction(req.user.id, 'DELETE_DOCUMENTO', 'tb_documentos', `Documento ${req.params.doc_id} removido`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Notifications
app.get('/api/notificacoes', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tb_notificacoes WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching notificacoes:', error);
    res.json([]);
  }
});

app.put('/api/notificacoes/:id/lida', authenticateToken, async (req, res) => {
  try {
    await db.query('UPDATE tb_notificacoes SET lida = TRUE WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/notificacoes/ler-todas', authenticateToken, async (req, res) => {
  try {
    await db.query('UPDATE tb_notificacoes SET lida = TRUE WHERE usuario_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'PADRE') {
      // 1. Get user's current house
      const [houseRow] = await db.query(`
        SELECT c.nome, c.regional, mc.casa_id 
        FROM tb_missionario_casas mc 
        JOIN tb_casas_religiosas c ON mc.casa_id = c.id 
        WHERE mc.usuario_id = ? AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) 
        LIMIT 1
      `, [req.user.id]);

      const house = houseRow[0];

      // 2. Get current month's spreadsheet status
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [spreadsheet] = await db.query('SELECT status FROM tb_financas_mensais WHERE usuario_id = ? AND mes_referencia = ?', [req.user.id, currentMonth]);
      
      // 3. Get recent notifications
      const [notifications] = await db.query('SELECT mensagem, created_at FROM tb_notificacoes WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 5', [req.user.id]);

      return res.json({
        isMissionary: true,
        houseName: house ? house.nome : 'Sem Casa Vinculada',
        regional: house ? house.regional : '',
        spreadsheetStatus: spreadsheet.length > 0 ? spreadsheet[0].status : 'NÃO INICIADA',
        recentActivities: notifications.map((n, i) => ({ id: i, user: 'Sistema', activity: n.mensagem, time: n.created_at }))
      });
    }

    // Admin view
    const [userCount] = await db.query(`SELECT COUNT(*) as count FROM tb_usuarios WHERE role = 'PADRE' AND ${HIDDEN_USERS_SQL}`);
    const [houseCount] = await db.query('SELECT COUNT(*) as count FROM tb_casas_religiosas');
    const [itineraryCount] = await db.query(`SELECT COUNT(*) as count FROM tb_usuarios WHERE role = 'PADRE' AND ${HIDDEN_USERS_SQL}`);
    
    res.json({
      totalUsers: userCount[0].count,
      totalHouses: houseCount[0].count,
      totalItineraries: itineraryCount[0].count,
      recentActivities: [
        { id: 1, user: 'Admin', activity: 'Sistema pronto', time: 'Agora mesmo' }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/stats', authenticateToken, async (req, res) => {
  // Same logic as GET /stats, just to avoid 404/405 if frontend calls POST
  try {
    if (req.user.role === 'PADRE') {
      const [houseRow] = await db.query(`
        SELECT c.nome, c.regional, mc.casa_id 
        FROM tb_missionario_casas mc 
        JOIN tb_casas_religiosas c ON mc.casa_id = c.id 
        WHERE mc.usuario_id = ? AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) 
        LIMIT 1
      `, [req.user.id]);
      const house = houseRow[0];
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [spreadsheet] = await db.query('SELECT status FROM tb_financas_mensais WHERE usuario_id = ? AND mes_referencia = ?', [req.user.id, currentMonth]);
      const [notifications] = await db.query('SELECT mensagem, created_at FROM tb_notificacoes WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 5', [req.user.id]);

      return res.json({
        isMissionary: true,
        houseName: house ? house.nome : 'Sem Casa Vinculada',
        regional: house ? house.regional : '',
        spreadsheetStatus: spreadsheet.length > 0 ? spreadsheet[0].status : 'NÃO INICIADA',
        recentActivities: notifications.map((n, i) => ({ id: i, user: 'Sistema', activity: n.mensagem, time: n.created_at }))
      });
    }

    const [userCount] = await db.query(`SELECT COUNT(*) as count FROM tb_usuarios WHERE role = 'PADRE' AND ${HIDDEN_USERS_SQL}`);
    const [houseCount] = await db.query('SELECT COUNT(*) as count FROM tb_casas_religiosas');
    const [itineraryCount] = await db.query(`SELECT COUNT(*) as count FROM tb_usuarios WHERE role = 'PADRE' AND ${HIDDEN_USERS_SQL}`);
    
    // Detailed counts by type
    let housesByType = { CR: 0, CI: 0, M: 0, P: 0, PV: 0, CS: 0 };
    try {
      const [typeRows] = await db.query('SELECT tipo, COUNT(*) as count FROM tb_casas_religiosas GROUP BY tipo');
      typeRows.forEach(r => { if (r.tipo) housesByType[r.tipo] = r.count; });
    } catch (e) {
      console.warn('Could not fetch house types (maybe column not exists yet)');
    }

    res.json({
      totalUsers: userCount[0].count,
      totalHouses: houseCount[0].count,
      totalItineraries: itineraryCount[0].count,
      housesByType,
      recentActivities: [
        { id: 1, user: 'Admin', activity: 'Sistema pronto', time: 'Agora mesmo' }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/financas-comunidade/:id/validar', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, apontamentos } = req.body;
  try {
    const colApontamentos = req.user.role === 'SUPERIOR_REGIONAL' ? 'apontamentos_superior' : 'apontamentos_economo';
    
    await db.query(
      `UPDATE tb_financas_consolidado SET status = ?, ${colApontamentos} = ?, validado_por = ? WHERE id = ?`,
      [status, apontamentos, req.user.id, id]
    );

    await logAction(req.user.id, 'VALIDAR_PLANILHA_COMUNIDADE', 'tb_financas_consolidado', `Planilha consolidada ${id} validada como ${status}`);

    const [sheet] = await db.query('SELECT casa_id, mes_referencia FROM tb_financas_consolidado WHERE id = ?', [id]);
    if (sheet.length > 0) {
      const { casa_id, mes_referencia } = sheet[0];
      const [casaRows] = await db.query('SELECT nome FROM tb_casas_religiosas WHERE id = ?', [casa_id]);
      const casaNome = casaRows[0]?.nome || '';
      
      const [valRows] = await db.query('SELECT nome FROM tb_usuarios WHERE id = ?', [req.user.id]);
      const valNome = valRows[0]?.nome || 'Desconhecido';
      
      const [economos] = await db.query(`
        SELECT u.id FROM tb_usuarios u
        JOIN tb_missionario_casas mc ON u.id = mc.usuario_id
        WHERE mc.casa_id = ? AND u.is_oconomo = 1 AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE())
      `, [casa_id]);
      
      for (const eco of economos) {
        let msg = '';
        if (status === 'APROVADO') {
          msg = `A prestação de contas da casa religiosa (${casaNome}) de ${mes_referencia} foi aprovada por ${valNome}.`;
        } else {
          msg = `A prestação de contas da casa religiosa (${casaNome}) de ${mes_referencia} foi devolvida por ${valNome}. Motivo: ${apontamentos || 'Não especificado'}`;
        }
        await createNotification(
          eco.id,
          msg,
          status === 'APROVADO' ? 'INFO' : 'ALERTA',
          `/financeiro?mes=${mes_referencia}&tab=comunidade`
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/validacoes/pendentes', authenticateToken, async (req, res) => {
  try {
    const [userRows] = await db.query('SELECT role, is_oconomo FROM tb_usuarios WHERE id = ?', [req.user.id]);
    const dbUser = userRows[0];
    const isAdmin = req.user.role === 'ADMIN_GERAL';
    const isRegional = req.user.role === 'ECONOMO_REGIONAL' || req.user.role === 'SUPERIOR_REGIONAL' || (dbUser && (dbUser.role === 'ECONOMO_REGIONAL' || dbUser.role === 'SUPERIOR_REGIONAL'));
    const isLocalEco = req.user.role === 'ECONOMO_LOCAL' || (dbUser && dbUser.is_oconomo);

    // Fetch userCasaId
    const [houseRow] = await db.query(
      'SELECT casa_id FROM tb_missionario_casas WHERE usuario_id = ? AND (data_fim IS NULL OR data_fim >= CURDATE()) LIMIT 1',
      [req.user.id]
    );
    const userCasaId = houseRow.length > 0 ? houseRow[0].casa_id : null;

    const items = [];

    // 1. Fetch pending missionary sheets
    let queryMensal = `
      SELECT p.id, p.usuario_id, p.casa_id, u.nome as nome_usuario_ou_casa, c.nome as nome_casa, p.mes_referencia, p.status, p.updated_at,
             COALESCE(
               (SELECT mc.pm FROM tb_missionario_casas mc WHERE mc.usuario_id = p.usuario_id AND mc.casa_id = p.casa_id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1),
               (SELECT mc.pm FROM tb_missionario_casas mc WHERE mc.usuario_id = p.usuario_id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1),
               c.pm_code
             ) as codigo_pm
      FROM tb_financas_mensais p
      JOIN tb_usuarios u ON p.usuario_id = u.id
      JOIN tb_casas_religiosas c ON p.casa_id = c.id
      WHERE p.status IN ('PENDENTE', 'EM_VALIDACAO')
      AND ${HIDDEN_USERS_ALIAS_SQL('u')}
    `;
    const paramsMensal = [];
    if (!isAdmin && !isRegional) {
      queryMensal += " AND p.casa_id = ?";
      paramsMensal.push(userCasaId);
    }
    const [rowsMensal] = await db.query(queryMensal, paramsMensal);
    rowsMensal.forEach(r => {
      items.push({
        id: r.id,
        tipo_planilha: 'missionario',
        usuario_id: r.usuario_id,
        casa_id: r.casa_id,
        nome_usuario_ou_casa: r.nome_usuario_ou_casa,
        nome_casa: r.nome_casa,
        mes_referencia: r.mes_referencia,
        status: r.status,
        updated_at: r.updated_at,
        codigo_pm: r.codigo_pm || null
      });
    });

    // 2. Fetch pending community consolidated sheets (only for regional/admin)
    if (isRegional || isAdmin) {
      let queryConsolidado = `
        SELECT p.id, p.casa_id, u.nome as nome_usuario_ou_casa, c.nome as nome_casa, p.mes_referencia, p.status, p.updated_at, p.usuario_id,
               COALESCE(
                 (SELECT mc.pm FROM tb_missionario_casas mc WHERE mc.usuario_id = p.usuario_id AND mc.casa_id = p.casa_id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1),
                 c.pm_code
               ) as codigo_pm
        FROM tb_financas_consolidado p
        JOIN tb_usuarios u ON p.usuario_id = u.id
        JOIN tb_casas_religiosas c ON p.casa_id = c.id
        WHERE p.status = 'ENVIADO_REGIONAL'
        AND ${HIDDEN_USERS_ALIAS_SQL('u')}
      `;
      const paramsConsolidado = [];
      if (!isAdmin && !isRegional) {
        queryConsolidado += " AND p.casa_id = ?";
        paramsConsolidado.push(userCasaId);
      }
      const [rowsConsolidado] = await db.query(queryConsolidado, paramsConsolidado);
      rowsConsolidado.forEach(r => {
        items.push({
          id: r.id,
          tipo_planilha: 'comunidade',
          casa_id: r.casa_id,
          usuario_id: r.usuario_id,
          nome_usuario_ou_casa: r.nome_usuario_ou_casa,
          nome_casa: r.nome_casa,
          mes_referencia: r.mes_referencia,
          status: r.status,
          updated_at: r.updated_at,
          codigo_pm: r.codigo_pm || null
        });
      });
    }

    items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/validacoes/historico/missionario', authenticateToken, async (req, res) => {
  try {
    const [userRows] = await db.query('SELECT role, is_oconomo FROM tb_usuarios WHERE id = ?', [req.user.id]);
    const dbUser = userRows[0];
    const isAdmin = req.user.role === 'ADMIN_GERAL';
    const isRegional = req.user.role === 'ECONOMO_REGIONAL' || req.user.role === 'SUPERIOR_REGIONAL' || (dbUser && (dbUser.role === 'ECONOMO_REGIONAL' || dbUser.role === 'SUPERIOR_REGIONAL'));

    // Fetch userCasaId
    const [houseRow] = await db.query(
      'SELECT casa_id FROM tb_missionario_casas WHERE usuario_id = ? AND (data_fim IS NULL OR data_fim >= CURDATE()) LIMIT 1',
      [req.user.id]
    );
    const userCasaId = houseRow.length > 0 ? houseRow[0].casa_id : null;

    let query = `
      SELECT p.id, p.usuario_id, p.casa_id, u.nome as nome_usuario_ou_casa, c.nome as nome_casa, p.mes_referencia, p.status, p.updated_at, v.nome as nome_validador,
             COALESCE(
               (SELECT mc.pm FROM tb_missionario_casas mc WHERE mc.usuario_id = p.usuario_id AND mc.casa_id = p.casa_id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1),
               (SELECT mc.pm FROM tb_missionario_casas mc WHERE mc.usuario_id = p.usuario_id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1),
               c.pm_code
             ) as codigo_pm
      FROM tb_financas_mensais p
      JOIN tb_usuarios u ON p.usuario_id = u.id
      JOIN tb_casas_religiosas c ON p.casa_id = c.id
      LEFT JOIN tb_usuarios v ON p.validado_por = v.id
      WHERE p.status IN ('VALIDADO', 'DEVOLVIDO')
    `;
    const params = [];
    if (!isAdmin && !isRegional) {
      query += " AND p.casa_id = ?";
      params.push(userCasaId);
    }
    query += " ORDER BY p.updated_at DESC";
    const [rows] = await db.query(query, params);
    const items = rows.map(r => ({
      id: r.id,
      tipo_planilha: 'missionario',
      usuario_id: r.usuario_id,
      casa_id: r.casa_id,
      nome_usuario_ou_casa: r.nome_usuario_ou_casa,
      nome_casa: r.nome_casa,
      mes_referencia: r.mes_referencia,
      status: r.status,
      updated_at: r.updated_at,
      nome_validador: r.nome_validador || 'N/A',
      codigo_pm: r.codigo_pm || null
    }));

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/validacoes/historico/casa', authenticateToken, async (req, res) => {
  try {
    const [userRows] = await db.query('SELECT role, is_oconomo FROM tb_usuarios WHERE id = ?', [req.user.id]);
    const dbUser = userRows[0];
    const isAdmin = req.user.role === 'ADMIN_GERAL';
    const isRegional = req.user.role === 'ECONOMO_REGIONAL' || req.user.role === 'SUPERIOR_REGIONAL' || (dbUser && (dbUser.role === 'ECONOMO_REGIONAL' || dbUser.role === 'SUPERIOR_REGIONAL'));

    // Fetch userCasaId
    const [houseRow] = await db.query(
      'SELECT casa_id FROM tb_missionario_casas WHERE usuario_id = ? AND (data_fim IS NULL OR data_fim >= CURDATE()) LIMIT 1',
      [req.user.id]
    );
    const userCasaId = houseRow.length > 0 ? houseRow[0].casa_id : null;

    let query = `
      SELECT p.id, p.casa_id, u.nome as nome_usuario_ou_casa, c.nome as nome_casa, p.mes_referencia, p.status, p.updated_at, v.nome as nome_validador, p.usuario_id,
             COALESCE(
               (SELECT mc.pm FROM tb_missionario_casas mc WHERE mc.usuario_id = p.usuario_id AND mc.casa_id = p.casa_id AND (mc.data_fim IS NULL OR mc.data_fim >= CURDATE()) ORDER BY mc.data_inicio DESC LIMIT 1),
               c.pm_code
             ) as codigo_pm
      FROM tb_financas_consolidado p
      JOIN tb_usuarios u ON p.usuario_id = u.id
      JOIN tb_casas_religiosas c ON p.casa_id = c.id
      LEFT JOIN tb_usuarios v ON p.validado_por = v.id
      WHERE p.status IN ('APROVADO', 'DEVOLVIDO_SUPERIOR')
    `;
    const params = [];
    if (!isAdmin && !isRegional) {
      query += " AND p.casa_id = ?";
      params.push(userCasaId);
    }
    query += " ORDER BY p.updated_at DESC";
    const [rows] = await db.query(query, params);
    const items = rows.map(r => ({
      id: r.id,
      tipo_planilha: 'comunidade',
      casa_id: r.casa_id,
      usuario_id: r.usuario_id,
      nome_usuario_ou_casa: r.nome_usuario_ou_casa,
      nome_casa: r.nome_casa,
      mes_referencia: r.mes_referencia,
      status: r.status === 'DEVOLVIDO_SUPERIOR' ? 'DEVOLVIDO' : r.status,
      updated_at: r.updated_at,
      nome_validador: r.nome_validador || 'N/A',
      codigo_pm: r.codigo_pm || null
    }));

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/extratos/missionarios', authenticateToken, async (req, res) => {
  try {
    const [userRows] = await db.query('SELECT role, is_oconomo FROM tb_usuarios WHERE id = ?', [req.user.id]);
    const dbUser = userRows[0];
    const isAdmin = req.user.role === 'ADMIN_GERAL';
    const isRegional = req.user.role === 'ECONOMO_REGIONAL' || req.user.role === 'SUPERIOR_REGIONAL' || (dbUser && (dbUser.role === 'ECONOMO_REGIONAL' || dbUser.role === 'SUPERIOR_REGIONAL'));
    const isLocalEco = req.user.role === 'ECONOMO_LOCAL' || (dbUser && dbUser.is_oconomo);

    // Fetch userCasaId
    const [houseRow] = await db.query(
      'SELECT casa_id FROM tb_missionario_casas WHERE usuario_id = ? AND (data_fim IS NULL OR data_fim >= CURDATE()) LIMIT 1',
      [req.user.id]
    );
    const userCasaId = houseRow.length > 0 ? houseRow[0].casa_id : null;

    let query = `
      SELECT p.id, p.usuario_id, p.casa_id, u.nome as nome_missionario, p.mes_referencia, p.total_credito, p.total_debito, (p.total_credito - p.total_debito) as saldo, p.updated_at as data_validacao, c.nome as nome_casa
      FROM tb_financas_mensais p
      JOIN tb_usuarios u ON p.usuario_id = u.id
      JOIN tb_casas_religiosas c ON p.casa_id = c.id
      WHERE p.status = 'VALIDADO'
    `;
    const params = [];
    if (!isAdmin && !isRegional) {
      if (isLocalEco) {
        query += " AND p.casa_id = ?";
        params.push(userCasaId);
      } else {
        query += " AND p.usuario_id = ?";
        params.push(req.user.id);
      }
    }
    query += " ORDER BY p.mes_referencia DESC, p.updated_at DESC";
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/extratos/casas', authenticateToken, async (req, res) => {
  try {
    const [userRows] = await db.query('SELECT role, is_oconomo FROM tb_usuarios WHERE id = ?', [req.user.id]);
    const dbUser = userRows[0];
    const isAdmin = req.user.role === 'ADMIN_GERAL';
    const isRegional = req.user.role === 'ECONOMO_REGIONAL' || req.user.role === 'SUPERIOR_REGIONAL' || (dbUser && (dbUser.role === 'ECONOMO_REGIONAL' || dbUser.role === 'SUPERIOR_REGIONAL'));

    // Fetch userCasaId
    const [houseRow] = await db.query(
      'SELECT casa_id FROM tb_missionario_casas WHERE usuario_id = ? AND (data_fim IS NULL OR data_fim >= CURDATE()) LIMIT 1',
      [req.user.id]
    );
    const userCasaId = houseRow.length > 0 ? houseRow[0].casa_id : null;

    let query = `
      SELECT p.id, p.casa_id, c.nome as nome_casa, p.mes_referencia, p.total_credito, p.total_debito, (p.total_credito - p.total_debito) as saldo, p.updated_at as data_validacao, p.usuario_id
      FROM tb_financas_consolidado p
      JOIN tb_casas_religiosas c ON p.casa_id = c.id
      WHERE p.status = 'APROVADO'
    `;
    const params = [];
    if (!isAdmin && !isRegional) {
      query += " AND p.casa_id = ?";
      params.push(userCasaId);
    }
    query += " ORDER BY p.mes_referencia DESC, p.updated_at DESC";
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Seed Admin User
const seedAdmin = async () => {
  try {
    const login = 'admin@teste.com';
    const password = 'F9289*#s';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [rows] = await db.query('SELECT * FROM tb_usuarios WHERE login = ?', [login]);
    if (rows.length === 0) {
      await db.query(
        'INSERT INTO tb_usuarios (nome, login, password_hash, role, status, situacao) VALUES (?, ?, ?, ?, ?, ?)',
        ['Administrador Geral', login, hashedPassword, 'ADMIN_GERAL', 'ATIVO', 'ATIVO']
      );
      console.log('✅ Admin user seeded successfully');
    }
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    fs.appendFileSync('debug.log', `${new Date().toISOString()} - Seed Error: ${error.stack}\n`);
  }
};

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}`);
    await ensureOptionalSchema();
    await seedAdmin();
  });
} else {
  // Ensure schema on serverless cold start if needed
  ensureOptionalSchema().catch(err => console.error('Schema init error:', err));
}

// Serve static frontend dist files and handle SPA fallback for non-API GET requests
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    const indexPath = path.join(frontendDistDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// Final catch-all for 404s (to distinguish from Apache 404)
app.use((req, res) => {
  console.log(`[404] No route for ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found in Node.js', 
    method: req.method, 
    path: req.originalUrl,
    hint: 'Check if the /api prefix is being handled correctly by the proxy'
  });
});

module.exports = app;

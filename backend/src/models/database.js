const sqlite = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(__dirname, '../data.db');
const db = new sqlite.DatabaseSync(dbPath);

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  return { lastID: info.lastInsertRowid, changes: info.changes };
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function exec(sql) {
  db.exec(sql);
}

function getColumns(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
}

function hasColumn(tableName, colName) {
  return getColumns(tableName).includes(colName);
}

function safeAddColumn(tableName, colName, colDef) {
  if (!hasColumn(tableName, colName)) {
    try {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
      console.log(`迁移: ${tableName} 新增 ${colName} 列`);
    } catch (e) {
      console.warn(`迁移 ${tableName}.${colName} 跳过: ${e.message}`);
    }
  }
}

function safeCreateIndex(indexName, table, column) {
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column})`);
  } catch (e) {
    console.warn(`索引 ${indexName} 跳过: ${e.message}`);
  }
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guidelines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      deadline DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS declarations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      guideline_id INTEGER,
      applicant TEXT NOT NULL,
      company TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      content TEXT,
      status TEXT DEFAULT 'draft',
      current_step INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      deleted_at DATETIME,
      deleted_by TEXT,
      last_auto_save_at DATETIME,
      version_count INTEGER DEFAULT 0,
      FOREIGN KEY (guideline_id) REFERENCES guidelines(id)
    );

    CREATE TABLE IF NOT EXISTS declaration_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      guideline_id INTEGER,
      applicant TEXT NOT NULL,
      company TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      content TEXT,
      status TEXT DEFAULT 'draft',
      current_step INTEGER DEFAULT 0,
      save_type TEXT DEFAULT 'manual',
      change_summary TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      snapshot_json TEXT,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_declaration_versions_declaration_id
      ON declaration_versions(declaration_id);
    CREATE INDEX IF NOT EXISTS idx_declaration_versions_version
      ON declaration_versions(declaration_id, version_number DESC);

    CREATE TABLE IF NOT EXISTS material_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guideline_id INTEGER,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      required INTEGER DEFAULT 0,
      allowed_extensions TEXT,
      max_size INTEGER DEFAULT 10485760,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guideline_id) REFERENCES guidelines(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    );

    CREATE TABLE IF NOT EXISTS approval_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL,
      step INTEGER NOT NULL,
      step_name TEXT,
      step_role TEXT,
      approver TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT,
      action TEXT NOT NULL,
      module TEXT,
      target_id INTEGER,
      detail TEXT,
      ip TEXT,
      user_agent TEXT,
      before_data TEXT,
      after_data TEXT,
      changed_fields TEXT,
      version_number INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      step_order INTEGER NOT NULL,
      role TEXT
    );

    CREATE TABLE IF NOT EXISTS workflow_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guideline_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guideline_id) REFERENCES guidelines(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_config_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      step_key TEXT NOT NULL,
      role TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      pending_status TEXT NOT NULL,
      approved_status TEXT NOT NULL,
      allow_rollback INTEGER DEFAULT 1,
      rollback_targets TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (config_id) REFERENCES workflow_configs(id) ON DELETE CASCADE
    );
  `);

  safeAddColumn('attachments', 'material_type_id', 'INTEGER REFERENCES material_types(id)');
  safeAddColumn('attachments', 'file_hash', 'TEXT');
  safeAddColumn('declarations', 'workflow_config_id', 'INTEGER REFERENCES workflow_configs(id)');
  safeAddColumn('approval_records', 'step_name', 'TEXT');
  safeAddColumn('approval_records', 'step_role', 'TEXT');
  safeCreateIndex('idx_attachments_hash', 'attachments', 'file_hash');
  safeCreateIndex('idx_material_types_guideline', 'material_types', 'guideline_id');
  safeCreateIndex('idx_workflow_configs_guideline', 'workflow_configs', 'guideline_id');
  safeCreateIndex('idx_workflow_config_steps_config', 'workflow_config_steps', 'config_id');
  safeCreateIndex('idx_declarations_workflow_config', 'declarations', 'workflow_config_id');

  const guidelineCount = get('SELECT COUNT(*) as count FROM guidelines');
  if (guidelineCount.count === 0) {
    const insertGuideline = db.prepare(`
      INSERT INTO guidelines (title, content, category, deadline)
      VALUES (?, ?, ?, ?)
    `);

    insertGuideline.run(
      '2024年度科技型中小企业技术创新基金',
      '为支持科技型中小企业技术创新，加快科技成果转化，现开展2024年度科技型中小企业技术创新基金申报工作。\n\n一、支持方向\n1. 电子信息领域\n2. 生物医药领域\n3. 新材料领域\n4. 先进制造领域\n\n二、申报条件\n1. 在中国境内依法注册的企业\n2. 职工人数不超过500人\n3. 具有大专以上学历的科技人员占职工总数的比例不低于30%\n4. 每年用于高新技术产品研究开发的经费不低于销售额的5%\n\n三、申报流程\n1. 在线填报申报材料\n2. 上传相关附件\n3. 提交初审\n4. 专家评审\n5. 公示立项',
      '科技项目',
      '2024-12-31'
    );

    insertGuideline.run(
      '2024年度小微企业发展专项资金',
      '为贯彻落实国家关于支持小微企业发展的政策措施，促进小微企业健康发展，现组织开展2024年度小微企业发展专项资金申报工作。\n\n一、支持范围\n1. 小微企业创业基地建设\n2. 小微企业公共服务平台\n3. 小微企业融资担保\n4. 小微企业转型升级\n\n二、申报条件\n1. 依法设立的小微企业\n2. 符合国家产业政策\n3. 财务管理制度健全\n4. 无不良信用记录',
      '企业发展',
      '2024-11-30'
    );

    insertGuideline.run(
      '2024年度高新技术企业认定',
      '根据《高新技术企业认定管理办法》，现开展2024年度高新技术企业认定工作。\n\n一、认定条件\n1. 企业申请认定时须注册成立一年以上\n2. 企业通过自主研发、受让、受赠、并购等方式，获得对其主要产品（服务）在技术上发挥核心支持作用的知识产权的所有权\n3. 对企业主要产品（服务）发挥核心支持作用的技术属于《国家重点支持的高新技术领域》规定的范围\n4. 企业从事研发和相关技术创新活动的科技人员占企业当年职工总数的比例不低于10%',
      '资质认定',
      '2024-10-31'
    );
  }

  const stepCount = get('SELECT COUNT(*) as count FROM workflow_steps');
  if (stepCount.count === 0) {
    const insertStep = db.prepare(`
      INSERT INTO workflow_steps (name, description, step_order, role)
      VALUES (?, ?, ?, ?)
    `);

    insertStep.run('草稿', '申报人填写申报信息', 0, '申请人');
    insertStep.run('初审', '材料形式审查', 1, '初审员');
    insertStep.run('复审', '业务部门审核', 2, '复审员');
    insertStep.run('终审', '领导审批', 3, '领导');
    insertStep.run('已立项', '审批通过', 4, '系统');
    insertStep.run('已驳回', '审批不通过', 5, '系统');
  }

  const configCount = get('SELECT COUNT(*) as count FROM workflow_configs');
  if (configCount.count === 0) {
    const insertConfig = db.prepare(`
      INSERT INTO workflow_configs (guideline_id, name, description)
      VALUES (?, ?, ?)
    `);
    const insertConfigStep = db.prepare(`
      INSERT INTO workflow_config_steps (config_id, name, step_key, role, step_order, pending_status, approved_status, allow_rollback, rollback_targets)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const config1 = insertConfig.run(1, '科技项目审批流', '科技型中小企业技术创新基金审批流程');
    insertConfigStep.run(config1.lastInsertRowid, '初审', 'initial_review', '初审员', 1, 'submitted', 'first_reviewed', 1, '[0]');
    insertConfigStep.run(config1.lastInsertRowid, '专家评审', 'expert_review', '评审专家', 2, 'first_reviewed', 'expert_reviewed', 1, '[1,0]');
    insertConfigStep.run(config1.lastInsertRowid, '终审', 'final_review', '领导', 3, 'expert_reviewed', 'approved', 1, '[2,1,0]');

    const config2 = insertConfig.run(2, '小微企业审批流', '小微企业发展专项资金审批流程');
    insertConfigStep.run(config2.lastInsertRowid, '初审', 'initial_review', '初审员', 1, 'submitted', 'first_reviewed', 1, '[0]');
    insertConfigStep.run(config2.lastInsertRowid, '复审', 'second_review', '复审员', 2, 'first_reviewed', 'approved', 1, '[1,0]');

    const config3 = insertConfig.run(3, '高企认定审批流', '高新技术企业认定审批流程');
    insertConfigStep.run(config3.lastInsertRowid, '形式审查', 'formal_review', '审查员', 1, 'submitted', 'formal_reviewed', 1, '[0]');
    insertConfigStep.run(config3.lastInsertRowid, '专家评审', 'expert_review', '评审专家', 2, 'formal_reviewed', 'expert_reviewed', 1, '[1,0]');
    insertConfigStep.run(config3.lastInsertRowid, '公示审核', 'public_review', '公示专员', 3, 'expert_reviewed', 'public_reviewed', 1, '[2,1,0]');
    insertConfigStep.run(config3.lastInsertRowid, '认定审批', 'final_approval', '认定委员会', 4, 'public_reviewed', 'approved', 1, '[3,2,1,0]');
  }

  const materialTypeCount = get('SELECT COUNT(*) as count FROM material_types');
  if (materialTypeCount.count === 0) {
    const insertMaterialType = db.prepare(`
      INSERT INTO material_types (guideline_id, name, code, description, required, allowed_extensions, max_size, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertMaterialType.run(null, '企业营业执照', 'business_license', '企业营业执照复印件，需加盖公章', 1, 'pdf,jpg,jpeg,png', 10485760, 1);
    insertMaterialType.run(null, '法人身份证', 'legal_id_card', '法定代表人身份证正反面', 1, 'pdf,jpg,jpeg,png', 10485760, 2);
    insertMaterialType.run(null, '组织机构代码证', 'org_code_cert', '组织机构代码证复印件', 0, 'pdf,jpg,jpeg,png', 10485760, 3);
    insertMaterialType.run(null, '税务登记证', 'tax_reg_cert', '税务登记证复印件', 0, 'pdf,jpg,jpeg,png', 10485760, 4);
    insertMaterialType.run(null, '项目申请书', 'project_application', '项目申请书Word文档', 1, 'doc,docx,pdf', 20971520, 5);
    insertMaterialType.run(null, '财务报表', 'financial_statement', '近三年财务报表', 0, 'xls,xlsx,pdf', 20971520, 6);
    insertMaterialType.run(null, '知识产权证明', 'ip_cert', '专利证书、软件著作权等', 0, 'pdf,jpg,jpeg,png', 20971520, 7);
    insertMaterialType.run(null, '荣誉资质', 'honor_qualification', '企业荣誉证书、资质证书等', 0, 'pdf,jpg,jpeg,png,zip,rar', 52428800, 8);
    insertMaterialType.run(null, '其他材料', 'other_materials', '其他需要补充的证明材料', 0, 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png,zip,rar', 52428800, 99);
  }

  console.log('数据库初始化完成');
}

module.exports = { db, initDatabase, run, get, all, exec };

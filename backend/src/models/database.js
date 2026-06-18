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

    CREATE TABLE IF NOT EXISTS declaration_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guideline_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guideline_id) REFERENCES guidelines(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guideline_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guideline_id) REFERENCES guidelines(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approval_reason_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  safeAddColumn('attachments', 'material_type_id', 'INTEGER REFERENCES material_types(id)');
  safeAddColumn('attachments', 'file_hash', 'TEXT');
  safeAddColumn('declarations', 'workflow_config_id', 'INTEGER REFERENCES workflow_configs(id)');
  safeAddColumn('approval_records', 'step_name', 'TEXT');
  safeAddColumn('approval_records', 'step_role', 'TEXT');
  safeAddColumn('approval_records', 'reason_category', 'TEXT');
  safeCreateIndex('idx_attachments_hash', 'attachments', 'file_hash');
  safeCreateIndex('idx_material_types_guideline', 'material_types', 'guideline_id');
  safeCreateIndex('idx_workflow_configs_guideline', 'workflow_configs', 'guideline_id');
  safeCreateIndex('idx_workflow_config_steps_config', 'workflow_config_steps', 'config_id');
  safeCreateIndex('idx_declarations_workflow_config', 'declarations', 'workflow_config_id');
  safeCreateIndex('idx_declaration_templates_guideline', 'declaration_templates', 'guideline_id');
  safeCreateIndex('idx_faqs_guideline', 'faqs', 'guideline_id');
  safeCreateIndex('idx_approval_reason_categories_action', 'approval_reason_categories', 'action_type');

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

  const templateCount = get('SELECT COUNT(*) as count FROM declaration_templates');
  if (templateCount.count === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO declaration_templates (guideline_id, title, content, description, sort_order, is_default)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertTemplate.run(1, '科技型中小企业创新基金申报模板',
      '一、项目概述\n\n简要说明项目的技术创新点、市场前景、预期效益等（不超过500字）。\n\n二、企业概况\n\n1. 企业基本情况\n2. 企业人员结构\n3. 企业财务状况\n4. 企业研发能力\n\n三、项目技术方案\n\n1. 技术原理与创新点\n2. 技术路线\n3. 关键技术与突破点\n4. 知识产权情况\n\n四、市场分析\n\n1. 目标市场\n2. 竞争分析\n3. 市场策略\n\n五、项目实施计划\n\n1. 总体目标\n2. 阶段计划\n3. 人员安排\n\n六、经费预算\n\n1. 总预算\n2. 明细预算\n3. 资金筹措\n\n七、预期效益\n\n1. 经济效益\n2. 社会效益',
      '适用于科技型中小企业技术创新基金项目申报', 1, 1);

    insertTemplate.run(2, '小微企业发展专项资金申报模板',
      '一、企业基本情况\n\n1. 企业简介\n2. 注册信息\n3. 股权结构\n4. 员工情况\n\n二、项目背景与意义\n\n三、项目主要内容\n\n1. 建设内容\n2. 实施方案\n3. 技术路线\n\n四、市场分析与预测\n\n五、投资估算与资金来源\n\n六、财务分析与效益预测\n\n七、风险分析与应对措施',
      '适用于小微企业发展专项资金申报', 1, 1);

    insertTemplate.run(3, '高新技术企业认定申报模板',
      '一、企业基本信息\n\n二、核心自主知识产权\n\n1. 知识产权列表\n2. 知识产权获取方式\n3. 对核心产品的支撑作用\n\n三、科技成果转化能力\n\n1. 近三年科技成果转化情况\n2. 转化形式说明\n\n四、研究开发组织管理水平\n\n1. 研发管理制度\n2. 研发机构设置\n3. 研发人员绩效考核\n4. 产学研合作情况\n\n五、企业成长性指标\n\n1. 销售收入增长率\n2. 净资产增长率\n\n六、研发费用情况\n\n七、高新技术产品（服务）收入情况',
      '适用于高新技术企业认定申报', 1, 1);
  }

  const faqCount = get('SELECT COUNT(*) as count FROM faqs');
  if (faqCount.count === 0) {
    const insertFaq = db.prepare(`
      INSERT INTO faqs (guideline_id, question, answer, sort_order)
      VALUES (?, ?, ?, ?)
    `);

    insertFaq.run(1, '科技型中小企业的认定标准是什么？',
      '根据相关规定，科技型中小企业须同时满足以下条件：\n1. 在中国境内（不包括港、澳、台地区）注册的居民企业。\n2. 职工总数不超过500人、年销售收入不超过2亿元、资产总额不超过2亿元。\n3. 企业提供的产品和服务不属于国家规定的禁止、限制和淘汰类。\n4. 企业在填报上一年及当年内未发生重大安全、重大质量事故和严重环境违法、科研严重失信行为，且企业未列入经营异常名录和严重违法失信企业名单。', 1);

    insertFaq.run(1, '项目经费预算包括哪些内容？',
      '项目经费预算主要包括：\n1. 设备费：购置或试制专用仪器设备的费用\n2. 材料费：原材料、辅助材料等低值易耗品的采购及运输、装卸、整理等费用\n3. 测试化验加工费：支付给外单位的检验、测试、化验及加工等费用\n4. 燃料动力费：相关大型仪器设备、专用科学装置等运行发生的水、电、气、燃料消耗费用等\n5. 差旅费：开展科学实验（试验）、科学考察、业务调研、学术交流等所发生的外埠差旅费、市内交通费用等\n6. 会议费：组织开展学术研讨、咨询以及协调项目等活动而发生的会议费用\n7. 国际合作与交流费：项目研究过程中研究人员出国及外国专家来华工作的费用\n8. 出版/文献/信息传播/知识产权事务费\n9. 劳务费：支付给项目组成员中没有工资性收入的相关人员和项目组临时聘用人员等的劳务性费用\n10. 专家咨询费：支付给临时聘请的咨询专家的费用\n11. 其他费用', 2);

    insertFaq.run(1, '申报截止日期后还能修改材料吗？',
      '申报截止日期后系统将关闭申报通道，无法再进行修改。请务必在截止日期前完成所有材料的提交。如有特殊情况，请联系项目主管部门说明情况。', 3);

    insertFaq.run(2, '小微企业的划型标准是什么？',
      '小微企业的划型标准根据《中小企业划型标准规定》执行：\n1. 农、林、牧、渔业：营业收入50万元及以上的为小型企业，营业收入50万元以下的为微型企业。\n2. 工业：从业人员20人及以上，且营业收入300万元及以上的为小型企业；从业人员20人以下或营业收入300万元以下的为微型企业。\n3. 其他行业请参照相关文件执行。', 1);

    insertFaq.run(2, '专项资金支持的具体方式有哪些？',
      '专项资金支持方式主要包括：\n1. 无偿资助：对符合条件的项目给予一定比例的资金补助\n2. 贷款贴息：对企业通过银行贷款实施的项目给予利息补贴\n3. 以奖代补：对已完成并取得良好成效的项目给予奖励\n具体支持方式以当年申报通知为准。', 2);

    insertFaq.run(3, '高新技术企业认定需要满足哪些条件？',
      '高新技术企业认定须同时满足以下条件：\n1. 企业申请认定时须注册成立一年以上\n2. 企业通过自主研发、受让、受赠、并购等方式，获得对其主要产品（服务）在技术上发挥核心支持作用的知识产权的所有权\n3. 对企业主要产品（服务）发挥核心支持作用的技术属于《国家重点支持的高新技术领域》规定的范围\n4. 企业从事研发和相关技术创新活动的科技人员占企业当年职工总数的比例不低于10%\n5. 企业近三个会计年度（实际经营期不满三年的按实际经营时间计算）的研究开发费用总额占同期销售收入总额的比例符合要求\n6. 近一年高新技术产品（服务）收入占企业同期总收入的比例不低于60%\n7. 企业创新能力评价应达到相应要求\n8. 企业申请认定前一年内未发生重大安全、重大质量事故或严重环境违法行为', 1);

    insertFaq.run(3, '高新技术企业资格有效期是多久？',
      '通过认定的高新技术企业，其资格自颁发证书之日起有效期为三年。企业应在期满前三个月内提出复审申请，不提出复审申请或复审不合格的，其高新技术企业资格到期自动失效。', 2);

    insertFaq.run(3, '研发费用归集范围包括哪些？',
      '研发费用归集范围包括：\n1. 人员人工费用：包括企业科技人员的工资薪金、基本养老保险费、基本医疗保险费、失业保险费、工伤保险费、生育保险费和住房公积金，以及外聘科技人员的劳务费用。\n2. 直接投入费用：直接投入费用是指企业为实施研究开发活动而实际发生的相关支出。\n3. 折旧费用与长期待摊费用\n4. 无形资产摊销费用\n5. 设计费用\n6. 装备调试费用与试验费用\n7. 委托外部研究开发费用\n8. 其他费用', 3);
  }

  const historyDeclarationCount = get('SELECT COUNT(*) as count FROM declarations');
  if (historyDeclarationCount.count === 0) {
    const insertDeclaration = db.prepare(`
      INSERT INTO declarations (title, guideline_id, applicant, company, phone, email, content, status, current_step, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertDeclaration.run(
      '智能工业机器人控制系统研发与产业化',
      1,
      '张三',
      '北京智能科技有限公司',
      '13800138001',
      'zhangsan@example.com',
      '一、项目概述\n本项目旨在研发一套具有自主知识产权的智能工业机器人控制系统，解决传统工业机器人灵活性不足、编程复杂等问题。\n\n二、技术方案\n采用深度学习算法结合运动规划技术，实现机器人的自主决策和智能协作。\n\n三、市场前景\n预计项目达产后年销售收入可达5000万元。',
      'approved',
      4,
      '2023-06-15 10:00:00'
    );

    insertDeclaration.run(
      '新能源汽车电池管理系统关键技术研究',
      1,
      '李四',
      '上海新能源科技股份有限公司',
      '13800138002',
      'lisi@example.com',
      '一、项目概述\n针对新能源汽车电池管理系统的核心技术问题，开展关键技术研究。\n\n二、创新点\n1. 高精度电池状态估算算法\n2. 智能均衡充电技术\n3. 故障诊断与预警系统\n\n三、预期成果\n申请发明专利5项，软件著作权3项。',
      'approved',
      4,
      '2023-08-20 14:30:00'
    );

    insertDeclaration.run(
      '中小企业数字化转型公共服务平台建设',
      2,
      '王五',
      '广州数字服务有限公司',
      '13800138003',
      'wangwu@example.com',
      '一、项目背景\n为解决中小企业数字化转型面临的成本高、技术难、人才缺等问题，建设公共服务平台。\n\n二、建设内容\n1. 云服务平台\n2. 数字化咨询服务\n3. 人才培训体系',
      'approved',
      3,
      '2023-05-10 09:00:00'
    );

    insertDeclaration.run(
      '基于人工智能的工业视觉检测系统',
      3,
      '赵六',
      '深圳视觉科技有限公司',
      '13800138004',
      'zhaoliu@example.com',
      '企业拥有发明专利15项，软件著作权20项。近三年研发投入占比8.5%，高新技术产品收入占比72%。科技人员占比35%。',
      'approved',
      5,
      '2023-09-01 11:00:00'
    );
  }

  const reasonCategoryCount = get('SELECT COUNT(*) as count FROM approval_reason_categories');
  if (reasonCategoryCount.count === 0) {
    const insertReasonCategory = db.prepare(`
      INSERT INTO approval_reason_categories (action_type, code, name, description, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertReasonCategory.run('approve', 'material_complete', '材料齐全合规', '申报材料完整，符合要求', 1);
    insertReasonCategory.run('approve', 'qualified', '符合立项条件', '企业资质和项目内容均符合申报指南要求', 2);
    insertReasonCategory.run('approve', 'excellent', '项目优秀', '项目创新性强，具有良好的市场前景', 3);
    insertReasonCategory.run('approve', 'policy_support', '政策扶持范围', '属于政策重点支持领域', 4);
    insertReasonCategory.run('approve', 'other_approve', '其他', '其他通过原因', 99);

    insertReasonCategory.run('reject', 'material_missing', '材料缺失', '缺少必要的申报材料', 1);
    insertReasonCategory.run('reject', 'material_invalid', '材料无效/不规范', '提交的材料不符合要求、已过期或信息错误', 2);
    insertReasonCategory.run('reject', 'not_qualified', '不符合申报条件', '企业资质或项目内容不符合申报指南要求', 3);
    insertReasonCategory.run('reject', 'duplicate', '重复申报', '同一项目或内容已申报过其他项目', 4);
    insertReasonCategory.run('reject', 'info_false', '信息不实', '申报材料存在虚假信息', 5);
    insertReasonCategory.run('reject', 'beyond_deadline', '超期申报', '超过申报截止日期', 6);
    insertReasonCategory.run('reject', 'other_reject', '其他', '其他驳回原因', 99);

    insertReasonCategory.run('rollback', 'material_incomplete', '材料不完整', '需要补充或完善材料', 1);
    insertReasonCategory.run('rollback', 'content_modify', '内容需修改', '申报内容需要调整或补充说明', 2);
    insertReasonCategory.run('rollback', 'format_issue', '格式问题', '材料格式、排版不符合规范', 3);
    insertReasonCategory.run('rollback', 'clarification_needed', '需补充说明', '需要申请人对相关内容进行澄清说明', 4);
    insertReasonCategory.run('rollback', 'other_rollback', '其他', '其他退回原因', 99);
  }

  console.log('数据库初始化完成');
}

module.exports = { db, initDatabase, run, get, all, exec };

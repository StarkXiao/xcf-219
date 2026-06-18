const COMPARABLE_FIELDS = [
  'title', 'guideline_id', 'applicant', 'company',
  'phone', 'email', 'content', 'status', 'current_step'
];

const FIELD_LABELS = {
  title: '项目名称',
  guideline_id: '申报指南',
  applicant: '申请人',
  company: '企业名称',
  phone: '联系电话',
  email: '电子邮箱',
  content: '项目内容',
  status: '状态',
  current_step: '当前步骤'
};

function computeDiff(before, after) {
  const changes = [];
  const changedFields = [];

  for (const field of COMPARABLE_FIELDS) {
    const beforeVal = before?.[field];
    const afterVal = after?.[field];
    const beforeStr = beforeVal === null || beforeVal === undefined ? '' : String(beforeVal);
    const afterStr = afterVal === null || afterVal === undefined ? '' : String(afterVal);

    if (beforeStr !== afterStr) {
      changedFields.push(field);
      const lineDiff = computeLineDiff(beforeStr, afterStr);
      changes.push({
        field,
        field_label: FIELD_LABELS[field] || field,
        before: beforeVal,
        after: afterVal,
        line_diff: lineDiff,
        char_change_count: Math.abs(afterStr.length - beforeStr.length)
      });
    }
  }

  return {
    has_changes: changes.length > 0,
    changed_fields: changedFields,
    changes,
    summary: generateSummary(changes)
  };
}

function computeLineDiff(beforeText, afterText) {
  if (!beforeText && !afterText) {
    return { added: 0, removed: 0, lines: [] };
  }

  const beforeLines = (beforeText || '').split('\n');
  const afterLines = (afterText || '').split('\n');
  const lines = [];
  let addedCount = 0;
  let removedCount = 0;

  const lcs = computeLCS(beforeLines, afterLines);
  let i = 0, j = 0;
  let lineNumBefore = 1, lineNumAfter = 1;

  while (i < lcs.length) {
    const lcsItem = lcs[i];
    while (lineNumBefore - 1 < lcsItem.beforeIdx) {
      lines.push({
        type: 'removed',
        content: beforeLines[lineNumBefore - 1],
        line_number_before: lineNumBefore,
        line_number_after: null
      });
      removedCount++;
      lineNumBefore++;
    }
    while (lineNumAfter - 1 < lcsItem.afterIdx) {
      lines.push({
        type: 'added',
        content: afterLines[lineNumAfter - 1],
        line_number_before: null,
        line_number_after: lineNumAfter
      });
      addedCount++;
      lineNumAfter++;
    }
    lines.push({
      type: 'unchanged',
      content: lcsItem.line,
      line_number_before: lineNumBefore,
      line_number_after: lineNumAfter
    });
    lineNumBefore++;
    lineNumAfter++;
    i++;
  }

  while (lineNumBefore - 1 < beforeLines.length) {
    lines.push({
      type: 'removed',
      content: beforeLines[lineNumBefore - 1],
      line_number_before: lineNumBefore,
      line_number_after: null
    });
    removedCount++;
    lineNumBefore++;
  }

  while (lineNumAfter - 1 < afterLines.length) {
    lines.push({
      type: 'added',
      content: afterLines[lineNumAfter - 1],
      line_number_before: null,
      line_number_after: lineNumAfter
    });
    addedCount++;
    lineNumAfter++;
  }

  return { added: addedCount, removed: removedCount, lines };
}

function computeLCS(arr1, arr2) {
  const m = arr1.length;
  const n = arr2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift({ line: arr1[i - 1], beforeIdx: i - 1, afterIdx: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return lcs;
}

function generateSummary(changes) {
  if (changes.length === 0) return '无变更';
  const parts = changes.map(c => {
    const label = c.field_label;
    if (c.field === 'content') {
      return `${label} (${c.line_diff.added}行新增, ${c.line_diff.removed}行删除)`;
    }
    return label;
  });
  return `修改了 ${changes.length} 个字段: ${parts.join('、')}`;
}

function getChangedFields(before, after) {
  return computeDiff(before, after).changed_fields;
}

module.exports = {
  computeDiff,
  computeLineDiff,
  getChangedFields,
  COMPARABLE_FIELDS,
  FIELD_LABELS
};

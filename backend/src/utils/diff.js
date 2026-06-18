function getChangedFields(before, after) {
  const changedFields = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  
  allKeys.forEach(key => {
    if (before[key] !== after[key]) {
      changedFields.push(key);
    }
  });
  
  return changedFields;
}

function computeDiff(before, after) {
  const changedFields = getChangedFields(before, after);
  const changes = [];
  let addedChars = 0;
  let removedChars = 0;

  changedFields.forEach(field => {
    const beforeVal = String(before[field] || '');
    const afterVal = String(after[field] || '');
    
    addedChars += Math.max(0, afterVal.length - beforeVal.length);
    removedChars += Math.max(0, beforeVal.length - afterVal.length);
    
    changes.push({
      field,
      before: before[field],
      after: after[field]
    });
  });

  const summary = changedFields.length > 0 
    ? `修改了 ${changedFields.length} 个字段：${changedFields.slice(0, 3).join('、')}${changedFields.length > 3 ? '...' : ''}`
    : '无变化';

  return {
    has_changes: changedFields.length > 0,
    changed_fields: changedFields,
    changes,
    summary,
    char_change_count: addedChars + removedChars
  };
}

module.exports = {
  computeDiff,
  getChangedFields
};

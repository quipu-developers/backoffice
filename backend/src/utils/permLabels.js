const { Permission, WRITE_ALL_MASK } = require("../config/permissions");

function permToLabels(perm) {
  const labels = [];
  if (perm & Permission.READ) labels.push("read/all");

  const hasAllWrite = (perm & WRITE_ALL_MASK) === WRITE_ALL_MASK;
  if (hasAllWrite) {
    labels.push("write/all");
    return labels;
  }

  if (perm & Permission.WRITE_ACTIVITY) labels.push("write/activity");
  if (perm & Permission.WRITE_RECRUIT_FORM) labels.push("write/recruit-form");
  if (perm & Permission.WRITE_CLUB_INFO) labels.push("write/club-info");

  return labels;
}

function labelsToPerm(labels = []) {
  let perm = 0;
  if (labels.includes("read/all")) perm |= Permission.READ;
  if (labels.includes("write/activity")) perm |= Permission.WRITE_ACTIVITY;
  if (labels.includes("write/recruit-form")) perm |= Permission.WRITE_RECRUIT_FORM;
  if (labels.includes("write/club-info")) perm |= Permission.WRITE_CLUB_INFO;
  if (labels.includes("write/all")) perm |= WRITE_ALL_MASK;
  if ((perm & Permission.READ) === 0) perm |= Permission.READ;
  return perm;
}

module.exports = { permToLabels, labelsToPerm };

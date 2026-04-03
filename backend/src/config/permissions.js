const Permission = {
  READ: 1 << 0,
  WRITE_ACTIVITY: 1 << 1,
  WRITE_RECRUIT_FORM: 1 << 2,
  WRITE_CLUB_INFO: 1 << 3,
};

const WRITE_ALL_MASK =
  Permission.WRITE_ACTIVITY |
  Permission.WRITE_RECRUIT_FORM |
  Permission.WRITE_CLUB_INFO;

module.exports = { Permission, WRITE_ALL_MASK };

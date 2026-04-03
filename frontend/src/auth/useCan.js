import { useAuth } from "./AuthProvider";

const PERM = {
  READ: 1 << 0,
  WRITE_ACTIVITY: 1 << 1,
  WRITE_RECRUIT_FORM: 1 << 2,
  WRITE_CLUB_INFO: 1 << 3,
};

export function useCan() {
  const { me } = useAuth();

  return {
    PERM,
    isSuperAdmin: !!me?.isSuperAdmin,
    has: (mask) => ((me?.perm || 0) & mask) === mask,
  };
}

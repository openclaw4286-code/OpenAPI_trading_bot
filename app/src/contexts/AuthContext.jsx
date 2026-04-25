import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearSession, readSession, verifyPassword, writeSession } from '../lib/auth.js';
import { getMember, listMembers } from '../lib/members.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshMembers = useCallback(async () => {
    const list = await listMembers();
    setMembers(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await refreshMembers();
        const session = readSession();
        if (session) {
          const member = list.find((m) => m.id === session.memberId);
          if (member) {
            if (!cancelled) setCurrentUser(member);
          } else {
            clearSession();
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMembers]);

  const login = useCallback(async (memberId, password) => {
    const member = await getMember(memberId);
    if (!member) throw new Error('멤버를 찾을 수 없습니다.');
    if (!member.hasPassword) throw new Error('비밀번호가 설정되지 않은 멤버입니다.');
    const ok = await verifyPassword(password, member.pw_salt, member.pw_hash);
    if (!ok) throw new Error('비밀번호가 일치하지 않습니다.');
    writeSession(member.id);
    setCurrentUser(member);
    return member;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
  }, []);

  const value = {
    members,
    currentUser,
    loading,
    error,
    login,
    logout,
    refreshMembers,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

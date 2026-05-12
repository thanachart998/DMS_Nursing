import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { Users, Shield, User as UserIcon, Check, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatThaiDate } from '../lib/utils';
import { UserProfile } from '../types';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'lecturer' | 'guest') => {
    setUpdatingId(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error("Role update failed:", err);
      alert("Failed to update role. You might not have permission.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">การจัดการผู้ใช้งานในระบบ</h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">การควบคุมสิทธิ์และการกำหนดบทบาทผู้ใช้งาน</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                <th className="py-4 px-6">ข้อมูลผู้ใช้งาน</th>
                <th className="py-4 px-6">อีเมล</th>
                <th className="py-4 px-6">วันที่เข้าร่วม</th>
                <th className="py-4 px-6 text-center">บทบาทหน้าที่</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <UserIcon size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 uppercase tracking-tight">{u.displayName}</p>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter">UID: {u.uid.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 font-medium font-mono text-xs">{u.email}</td>
                  <td className="py-4 px-6 text-slate-400">{formatThaiDate(u.createdAt)}</td>
                  <td className="py-4 px-6">
                    <div className="flex justify-center">
                      <div className="relative group/role">
                        <select
                          disabled={updatingId === u.uid}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value as any)}
                          className={cn(
                            "appearance-none px-3 py-1.5 pr-8 rounded-lg text-xs font-bold uppercase tracking-widest outline-none border transition-all cursor-pointer",
                            u.role === 'admin' ? "bg-blue-50 border-blue-200 text-blue-700" :
                            u.role === 'lecturer' ? "bg-indigo-50 border-indigo-200 text-indigo-700" :
                            "bg-slate-50 border-slate-200 text-slate-500"
                          )}
                        >
                          <option value="admin">ผู้ดูแลระบบ</option>
                          <option value="lecturer">อาจารย์</option>
                          <option value="guest">ผู้เยี่ยมชม</option>
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-4">
        <div className="p-2 bg-blue-100 text-blue-600 rounded">
          <Shield size={16} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-blue-800 uppercase tracking-tight">คำเตือนการควบคุมสิทธิ์</h4>
          <p className="text-xs text-blue-600 font-medium mt-1 leading-relaxed">
            การเปลี่ยนบทบาทของผู้ใช้งานจะมีผลทันทีต่อสิทธิ์การเข้าถึงในระบบทั้งหมด 
            <strong>ผู้ดูแลระบบ (Admin)</strong> สามารถจัดการข้อมูลได้ทั้งหมด ส่วน <strong>ผู้ใช้งานทั่วไป</strong> จะสามารถดูข้อมูลได้อย่างเดียว
          </p>
        </div>
      </div>
    </div>
  );
}

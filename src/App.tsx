/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { 
  FileText, 
  Inbox, 
  Send, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Search, 
  Menu, 
  X,
  User as UserIcon,
  ChevronRight,
  Users,
  Download,
  FileDown,
  Shield,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import Dashboard from './components/Dashboard';
import DocumentPanel from './components/DocumentPanel';
import UserManagement from './components/UserManagement';
import PetitionPanel from './components/PetitionPanel';
import MouPanel from './components/MouPanel';

type View = 'dashboard' | 'incoming' | 'outgoing' | 'appointment' | 'mptu_appointment' | 'users' | 'petition' | 'mou';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'lecturer' | 'guest' | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        let userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const isAdmin = user.email === 'thanachart.kt@ptu.ac.th' || user.email === 'thanachart.kt@gmail.com'; 
          const role = isAdmin ? 'admin' : 'guest';
          
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            role: role,
            createdAt: new Date()
          });
          userSnap = await getDoc(userRef);
        }
        
        const data = userSnap.data();
        let currentRole = data?.role || 'guest';
        if (currentRole === 'general' || currentRole === 'staff') {
          // Migrate old roles
          currentRole = currentRole === 'staff' ? 'lecturer' : 'guest';
        }
        setUserRole(currentRole);
        setUser(user);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200"
        >
          <div className="bg-blue-900 p-8 text-center text-white">
            <div className="bg-white/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm p-2">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const icon = document.createElement('div');
                  icon.className = 'text-white font-bold text-4xl';
                  icon.innerText = 'N';
                  e.currentTarget.parentElement?.appendChild(icon);
                }}
              />
            </div>
            <h1 className="text-3xl font-bold">ระบบสารบรรณ คณะพยาบาลศาสตร์</h1>
            <p className="text-blue-200 mt-2">มหาวิทยาลัยปทุมธานี</p>
          </div>
          <div className="p-8">
            <button 
              onClick={handleLogin}
              className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              เข้าสู่ระบบด้วย Google
            </button>
            <p className="text-center text-slate-400 text-base mt-6">
              เข้าใช้งานด้วยอีเมลมหาวิทยาลัย (@ptu.ac.th)
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'ภาพรวมระบบสารบรรณ', icon: LayoutDashboard },
    { id: 'incoming', label: 'หนังสือรับเข้า', icon: Inbox },
    { id: 'outgoing', label: 'หนังสือส่งออก', icon: Send },
    { id: 'appointment', label: 'ออกเลขคำสั่งแต่งตั้ง', icon: FileText },
    { id: 'mptu_appointment', label: 'คำสั่งแต่งตั้ง มปท.', icon: FileText },
    { id: 'petition', label: 'หนังสือคำร้อง', icon: FileText },
    { id: 'mou', label: 'เอกสาร MOU', icon: FileText },
  ];

  const formTemplates = [
    { name: 'บันทึกข้อความนักศึกษา', url: 'https://drive.google.com/file/d/1tfaERrwI8Kvs1Ney6HK1HLHplLX_w364/view' },
    { name: 'บันทึกข้อความอาจารย์', url: 'https://drive.google.com/file/d/1Ga89NF1hfpNaImODPUdzQkRGa7uATias/view' },
    { name: 'ใบสำคัญรับเงิน', url: '#' },
    { name: 'ใบลา', url: '#' },
    { name: 'ใบขอหยุดชดเชย', url: 'https://drive.google.com/file/d/17vvhilZ1HCJ1B9S55u8omyuP-tht2LK7/view' },
    { name: 'ใบขออบรม', url: 'https://drive.google.com/file/d/1YbuwDPIzUiK0IgdMPBGx2IfWw6-xlvlR/view' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 256 : 72 }}
        className="bg-slate-900 text-white flex flex-col fixed h-full z-50 shadow-2xl border-right border-slate-800"
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-800 overflow-hidden whitespace-nowrap">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback to Icon if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.classList.add('bg-blue-600', 'rounded');
                const icon = document.createElement('div');
                icon.className = 'text-white font-bold text-xl';
                icon.innerText = 'N';
                e.currentTarget.parentElement?.appendChild(icon);
              }}
            />
          </div>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex flex-col"
            >
              <span className="font-bold tracking-tight text-base uppercase">NURSING DMS</span>
              <span className="text-xs text-blue-400 font-bold -mt-1 underline decoration-blue-500/30">ระบบงานสารบรรณ</span>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {userRole !== 'guest' && menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded text-base font-medium transition-all group relative",
                activeView === item.id 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <item.icon size={16} className={activeView === item.id ? "text-white" : "text-slate-500 group-hover:text-slate-300"} />
              {isSidebarOpen && <span>{item.label}</span>}
              {activeView === item.id && isSidebarOpen && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
              )}
            </button>
          ))}
          
          {userRole !== 'guest' && isSidebarOpen && (
            <div className="pt-4 pb-2 text-xs uppercase tracking-widest text-slate-500 font-bold px-3">
              แบบฟอร์มต่างๆ
            </div>
          )}

          {userRole !== 'guest' && (
            <div className="space-y-1 px-2">
              {formTemplates.map((form, idx) => (
                <a
                  key={idx}
                  href={form.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded text-sm transition-all hover:bg-slate-800 text-slate-400 hover:text-blue-400 group",
                    !isSidebarOpen && "justify-center"
                  )}
                >
                  <FileDown size={14} className="text-slate-500 group-hover:text-blue-400 shrink-0" />
                  {isSidebarOpen && <span className="truncate">{form.name}</span>}
                  {isSidebarOpen && <Download size={10} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
                </a>
              ))}
            </div>
          )}
          
          {userRole === 'admin' && isSidebarOpen && (
            <div className="pt-4 pb-2 text-xs uppercase tracking-widest text-slate-500 font-bold px-3">
              ส่วนการจัดการ
            </div>
          )}

          {userRole === 'admin' && (
            <button
              onClick={() => setActiveView('users')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded text-base font-medium transition-all group relative",
                activeView === 'users' 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Users size={16} className={activeView === 'users' ? "text-white" : "text-slate-500 group-hover:text-slate-300"} />
              {isSidebarOpen && <span>จัดการผู้ใช้งาน</span>}
              {activeView === 'users' && isSidebarOpen && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
              )}
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-xl bg-white/5",
            !isSidebarOpen && "justify-center"
          )}>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 font-bold text-sm flex-shrink-0 border border-white/10 uppercase">
              {user.displayName?.slice(0, 2) || 'ST'}
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-semibold truncate leading-tight uppercase tracking-tight">{user.displayName}</p>
                <p className="text-xs text-blue-400 truncate mt-0.5 uppercase tracking-widest font-bold">สถานะ: {userRole === 'admin' ? 'ผู้ดูแลระบบ' : userRole === 'lecturer' ? 'อาจารย์' : 'ผู้เยี่ยมชม'}</p>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className={cn(
              "w-full mt-4 flex items-center gap-3 px-3 py-2 rounded text-sm font-semibold text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all border border-transparent hover:border-red-500/20",
              !isSidebarOpen && "justify-center px-0"
            )}
          >
            <LogOut size={14} />
            {isSidebarOpen && <span>ออกจากระบบ</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        isSidebarOpen ? "ml-64" : "ml-[72px]"
      )}>
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40 backdrop-blur-md bg-white/90">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-slate-100 rounded border border-slate-200 text-slate-500 transition-colors"
            >
              {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight">
              คณะพยาบาลศาสตร์ มหาวิทยาลัยปทุมธานี
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="ค้นหาเอกสารทั้งหมด..."
                className="bg-slate-100 border-none rounded-lg py-2 pl-9 pr-4 w-64 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400"
              />
            </div>
            <a
              href="https://nurse.ptu.ac.th"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-blue-200"
            >
              <Globe size={16} />
              <span>เว็บไซต์คณะ</span>
            </a>
            <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 uppercase">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>LIVE SERVER</span>
            </div>
          </div>
        </header>

        <section className="p-6 md:p-8 bg-slate-50 min-h-[calc(100vh-64px)] overflow-x-hidden">
          {userRole === 'guest' ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
                <Shield size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึงระบบ</h2>
              <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
                ระบบสารบรรณ คณะพยาบาลศาสตร์ มหาวิทยาลัยปทุมธานี<br/>
                หากต้องการเข้าถึงข้อมูล โปรดติดต่อสำนักงานคณบดี คณะพยาบาลศาสตร์
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeView === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Dashboard onNavigate={setActiveView} userRole={userRole} />
                </motion.div>
              )}
              {(activeView === 'incoming' || activeView === 'outgoing' || activeView === 'appointment' || activeView === 'mptu_appointment') && (
                <motion.div
                  key="document-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <DocumentPanel type={activeView} userRole={userRole} />
                </motion.div>
              )}
              {activeView === 'petition' && (
                <motion.div
                  key="petition-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <PetitionPanel userRole={userRole} />
                </motion.div>
              )}
              {activeView === 'mou' && (
                <motion.div
                  key="mou-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <MouPanel userRole={userRole} />
                </motion.div>
              )}
              {activeView === 'users' && userRole === 'admin' && (
                <motion.div
                  key="user-management"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <UserManagement />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </section>
      </main>
    </div>
  );
}

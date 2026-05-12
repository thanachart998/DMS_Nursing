import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { 
  Inbox, 
  Send, 
  FileText, 
  TrendingUp, 
  Clock,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatThaiDate } from '../lib/utils';

export default function Dashboard({ onNavigate, userRole }: { onNavigate: (view: any) => void, userRole?: string | null }) {
  const [stats, setStats] = useState({ incoming: 0, outgoing: 0, recent: [] as any[] });

  useEffect(() => {
    async function fetchStats() {
      const docsRef = collection(db, 'documents');
      
      const incSnap = await getDocs(query(docsRef, where('doc_type', '==', 'incoming')));
      const outSnap = await getDocs(query(docsRef, where('doc_type', '==', 'outgoing')));
      const recentSnap = await getDocs(query(docsRef, orderBy('created_at', 'desc'), limit(5)));

      setStats({
        incoming: incSnap.size,
        outgoing: outSnap.size,
        recent: recentSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      });
    }
    fetchStats();
  }, []);

  const cards = [
    { 
      id: 'incoming', 
      label: 'หนังสือรับทั้งหมด', 
      value: stats.incoming, 
      icon: Inbox, 
      color: 'bg-blue-500',
      description: 'เอกสารขาเข้าคณะ'
    },
    { 
      id: 'outgoing', 
      label: 'หนังสือส่งทั้งหมด', 
      value: stats.outgoing, 
      icon: Send, 
      color: 'bg-indigo-600',
      description: 'เอกสารขาออกคณะ'
    },
    { 
      id: 'total', 
      label: 'รวมเอกสาร', 
      value: stats.incoming + stats.outgoing, 
      icon: FileText, 
      color: 'bg-slate-700',
      description: 'ปริมาณงานรวม'
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">ภาพรวมระบบ</h1>
        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">สถิติและสถานะการดำเนินงานแบบเรียลไทม์</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group cursor-pointer overflow-hidden"
            onClick={() => card.id !== 'total' && onNavigate(card.id)}
          >
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">{card.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-slate-800">{card.value.toLocaleString()}</p>
                <div className={cn("p-2 rounded text-white flex-shrink-0", card.color)}>
                  <card.icon size={16} />
                </div>
              </div>
            </div>
            {card.id === 'incoming' && (
              <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-3/4 rounded-full" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} className="text-blue-500" />
              รายการเอกสารที่ปรับปรุงล่าสุด
            </h3>
            <button 
              onClick={() => onNavigate('incoming')}
              className="text-xs bg-white border border-slate-200 text-slate-600 font-bold px-2 py-1 rounded hover:bg-slate-50 transition-colors uppercase"
            >
              ดูทั้งหมด
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-6">เลขที่หนังสือ</th>
                  <th className="py-3 px-6">ชื่อเรื่อง / ใจความสำคัญ</th>
                  <th className="py-3 px-6">วันที่ในหนังสือ</th>
                  <th className="py-3 px-6 text-center">ประเภท</th>
                  <th className="py-3 px-6 text-right">ชนิด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stats.recent.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors group cursor-default">
                    <td className="py-3 px-6 font-mono font-bold text-slate-900 uppercase">{doc.doc_no}</td>
                    <td className="py-3 px-6 text-slate-600 font-medium group-hover:text-blue-600 transition-colors">
                      {doc.title}
                    </td>
                    <td className="py-3 px-6 text-slate-400 font-mono">{formatThaiDate(doc.date_issued)}</td>
                    <td className="py-3 px-6 text-center whitespace-nowrap">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] font-bold uppercase",
                        doc.doc_subtype === 'external' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {doc.doc_subtype === 'internal' ? 'ภายใน' : 'ภายนอก'}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right uppercase">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] font-bold",
                        doc.doc_type === 'incoming' ? "bg-blue-100 text-blue-700" : "bg-indigo-100 text-indigo-700"
                      )}>
                        {doc.doc_type === 'incoming' ? 'รับ' : 'ส่ง'}
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic font-medium">ไม่พบรายการเอกสารในขณะนี้...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">ประสิทธิภาพการจัดการรายเดือน</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-500 uppercase">อัตราการประมวลผล</span>
                  <span className="text-sm font-bold text-blue-600">92%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <div className="h-full bg-blue-500 w-[92%] rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1 text-slate-400">
                  <span className="text-xs font-bold uppercase">อัตราการจัดเก็บถาวร</span>
                  <span className="text-sm font-bold">45%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <div className="h-full bg-slate-300 w-[45%] rounded-full" />
                </div>
              </div>
            </div>
          </div>
          
          {userRole === 'admin' && (
            <div className="mt-auto pt-6 border-t border-slate-100">
              <button className="w-full bg-slate-900 text-white font-bold text-sm py-3 rounded-lg hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98]">
                สร้างรายรายงานประจำเดือน
              </button>
              <p className="text-[11px] text-center text-slate-400 font-medium mt-3 uppercase tracking-tighter">
                เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

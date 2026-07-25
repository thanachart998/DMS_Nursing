import { useState, useEffect } from 'react';
import { cn, formatThaiDate } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { 
  Inbox, 
  Send, 
  FileText, 
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Dashboard({ onNavigate, userRole }: { onNavigate: (view: any) => void, userRole?: string | null }) {
  const [stats, setStats] = useState({ incoming: 0, outgoing: 0, appointment: 0, mptu_appointment: 0, petition: 0, mou: 0, recent: [] as any[] });

  useEffect(() => {
    async function fetchStats() {
      const docsRef = collection(db, 'documents');
      const incSnap = await getDocs(query(docsRef, where('doc_type', '==', 'incoming')));
      const outSnap = await getDocs(query(docsRef, where('doc_type', '==', 'outgoing')));
      const appSnap = await getDocs(query(docsRef, where('doc_type', '==', 'appointment')));
      const mptuSnap = await getDocs(query(docsRef, where('doc_type', '==', 'mptu_appointment')));
      
      const petRef = collection(db, 'petitions');
      const petSnap = await getDocs(petRef);
      
      const mouRef = collection(db, 'mous');
      const mouSnap = await getDocs(mouRef);
      
      const recentSnap = await getDocs(query(docsRef, orderBy('created_at', 'desc'), limit(10)));
      
      setStats({
        incoming: incSnap.size,
        outgoing: outSnap.size,
        appointment: appSnap.size,
        mptu_appointment: mptuSnap.size,
        petition: petSnap.size,
        mou: mouSnap.size,
        recent: recentSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      });
    }
    fetchStats();
  }, []);

  const cards = [
    { 
      id: 'incoming', 
      label: 'หนังสือรับเข้า', 
      value: stats.incoming, 
      icon: Inbox, 
      color: 'bg-blue-500',
    },
    { 
      id: 'outgoing', 
      label: 'หนังสือส่งออก', 
      value: stats.outgoing, 
      icon: Send, 
      color: 'bg-indigo-600',
    },
    { 
      id: 'appointment', 
      label: 'คำสั่งแต่งตั้ง', 
      value: stats.appointment, 
      icon: FileText, 
      color: 'bg-purple-600',
    },
    { 
      id: 'mptu_appointment', 
      label: 'คำสั่งแต่งตั้ง มปท.', 
      value: stats.mptu_appointment, 
      icon: FileText, 
      color: 'bg-fuchsia-600',
    },
    { 
      id: 'petition', 
      label: 'หนังสือคำร้อง', 
      value: stats.petition, 
      icon: FileText, 
      color: 'bg-emerald-600',
    },
    { 
      id: 'mou', 
      label: 'เอกสาร MOU', 
      value: stats.mou, 
      icon: FileText, 
      color: 'bg-amber-500',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">ภาพรวมระบบสารบรรณ</h1>
        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">สถิติและสถานะการดำเนินงานแบบเรียลไทม์</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-slate-300"
            onClick={() => onNavigate(card.id)}
          >
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight truncate">{card.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-slate-800">{card.value.toLocaleString()}</p>
                <div className={cn("p-1.5 rounded text-white flex-shrink-0", card.color)}>
                  <card.icon size={14} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} className="text-blue-500" />
              10 รายการเอกสารล่าสุด
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-6 w-48">เลขที่หนังสือ</th>
                  <th className="py-3 px-6">ชื่อเรื่อง / ใจความสำคัญ</th>
                  <th className="py-3 px-6 w-36">วันที่ในหนังสือ</th>
                  <th className="py-3 px-6 w-24 text-center">ประเภท</th>
                  <th className="py-3 px-6 w-24 text-right">ชนิด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stats.recent.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors group cursor-default">
                    <td className="py-3 px-6 font-mono font-bold text-slate-900 uppercase">{doc.doc_no}</td>
                    <td className="py-3 px-6 text-slate-600 font-medium group-hover:text-blue-600 transition-colors truncate max-w-sm">
                      {doc.title}
                    </td>
                    <td className="py-3 px-6 text-slate-400 font-mono text-[13px]">{formatThaiDate(doc.date_issued)}</td>
                    <td className="py-3 px-6 text-center whitespace-nowrap">
                      {doc.doc_type !== 'appointment' && doc.doc_type !== 'mptu_appointment' && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[11px] font-bold uppercase",
                          doc.doc_subtype === 'external' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                        )}>
                          {doc.doc_subtype === 'internal' ? 'ภายใน' : 'ภายนอก'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-right uppercase">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] font-bold",
                        doc.doc_type === 'incoming' ? "bg-blue-100 text-blue-700" : 
                        doc.doc_type === 'outgoing' ? "bg-indigo-100 text-indigo-700" : 
                        doc.doc_type === 'mptu_appointment' ? "bg-fuchsia-100 text-fuchsia-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {doc.doc_type === 'incoming' ? 'รับ' : doc.doc_type === 'outgoing' ? 'ส่ง' : doc.doc_type === 'mptu_appointment' ? 'คำสั่ง มปท.' : 'คำสั่ง'}
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">ไม่พบรายการเอกสารในขณะนี้...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Download, 
  Trash2, 
  Edit2,
  Calendar,
  Tag,
  User,
  ArrowUpDown,
  X,
  FileText,
  Upload,
  FileCheck,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatThaiDate, cn, getCurrentAcademicYear, getFormAcademicYears } from '../lib/utils';
import { DocType, DocumentRecord } from '../types';

export default function DocumentPanel({ type, userRole }: { type: DocType, userRole?: string | null }) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทุกหมวดหมู่');
  const [selectedYear, setSelectedYear] = useState('ทุกปีการศึกษา');
  const [selectedSubtype, setSelectedSubtype] = useState('ทุกประเภท');
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    doc_no: '',
    receive_no: '',
    doc_subtype: 'internal' as any,
    title: '',
    sender: '',
    receiver: '',
    date_issued: new Date().toISOString().split('T')[0],
    category: 'คำสั่ง',
    academic_year: getCurrentAcademicYear(),
    status: 'pending' as any,
    file_url: '',
    responsible_person: '',
  });

  const resetForm = () => {
    setSelectedFile(null);
    setFormData({
      doc_no: '',
      receive_no: '',
      doc_subtype: 'internal',
      title: '',
      sender: '',
      receiver: '',
      date_issued: new Date().toISOString().split('T')[0],
      category: 'คำสั่ง',
      academic_year: getCurrentAcademicYear(),
      status: 'pending',
      file_url: '',
      responsible_person: '',
    });
  };

  const categories = ['คำสั่ง', 'ประกาศ', 'ระเบียบ', 'ส่งนักศึกษาออกฝึก', 'เชิญ', 'ส่งเกรด', 'วิจัย', 'การเงิน', 'จริยธรรม', 'คณะ', 'สภาการพยาบาล', 'ประกันคุณภาพ', 'คำร้อง', 'บันทึกข้อความ', 'แก้ผลการเรืยน'];
  const formAcademicYears = getFormAcademicYears();
  
  // Extract unique academic years from existing documents for the filter
  const existingAcademicYears = Array.from(new Set(docs.map(doc => doc.academic_year).filter(Boolean))).sort().reverse();

  const generateNextDocNo = async () => {
    if (type !== 'outgoing') return;
    
    try {
      const prefix = formData.doc_subtype === 'internal' ? 'พย.บ. น.' : 'พย.บ.';
      const year = formData.academic_year.replace('ปีการศึกษา ', '');
      
      const q = query(
        collection(db, 'documents'),
        where('doc_type', '==', 'outgoing'),
        where('doc_subtype', '==', formData.doc_subtype),
        where('academic_year', '==', formData.academic_year)
      );
      
      const snap = await getDocs(q);
      const existingDocs = snap.docs.map(d => d.data() as DocumentRecord);
      
      let nextNum = 1;
      if (existingDocs.length > 0) {
        const nums = existingDocs.map(d => {
          const escapedPrefix = prefix.replace(/\./g, '\\.');
          const regex = new RegExp(`${escapedPrefix}\\s*(\\d+)/`);
          const match = d.doc_no.match(regex);
          return match ? parseInt(match[1]) : 0;
        });
        nextNum = Math.max(...nums) + 1;
      }
      
      const paddedNum = String(nextNum).padStart(3, '0');
      const spacing = formData.doc_subtype === 'external' ? ' ' : '';
      const newDocNo = `${prefix}${spacing}${paddedNum}/${year}`;
      setFormData(prev => ({ ...prev, doc_no: newDocNo }));
    } catch (err) {
      console.error("Error generating doc no:", err);
      alert("ไม่สามารถสร้างเลขที่หนังสืออัตโนมัติได้");
    }
  };

  const generateNextReceiveNo = async () => {
    if (type !== 'incoming') return;
    
    try {
      const prefix = 'พย.บ. ข.';
      const year = formData.academic_year.replace('ปีการศึกษา ', '');
      
      const q = query(
        collection(db, 'documents'),
        where('doc_type', '==', 'incoming'),
        where('academic_year', '==', formData.academic_year)
      );
      
      const snap = await getDocs(q);
      const existingDocs = snap.docs.map(d => d.data() as DocumentRecord);
      
      let nextNum = 1;
      if (existingDocs.length > 0) {
        const nums = existingDocs.map(d => {
          if (!d.receive_no) return 0;
          const regex = new RegExp(`พย\\.บ\\. ข\\.\\s*(\\d+)/`);
          const match = d.receive_no.match(regex);
          return match ? parseInt(match[1]) : 0;
        });
        nextNum = Math.max(...nums) + 1;
      }
      
      const paddedNum = String(nextNum).padStart(3, '0');
      const newReceiveNo = `${prefix}${paddedNum}/${year}`;
      setFormData(prev => ({ ...prev, receive_no: newReceiveNo }));
    } catch (err) {
      console.error("Error generating receive no:", err);
      alert("ไม่สามารถสร้างเลขรับหนังสืออัตโนมัติได้");
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [type]);

  async function fetchDocs() {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'documents'), 
        where('doc_type', '==', type),
        orderBy('created_at', 'desc')
      );
      const snap = await getDocs(q);
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentRecord)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert('กรุณาเลือกไฟล์ PDF เท่านั้น');
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async (docNo: string): Promise<string> => {
    if (!selectedFile) return formData.file_url;
    
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('filename', `${type}_${docNo.replace(/[\/\s\.]/g, '_')}_${Date.now()}.pdf`);

      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        body: form
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      return data.url;
    } catch (error: any) {
      console.error("Drive upload error:", error);
      alert(error.message || "เกิดข้อผิดพลาดในการอัปโหลดไปยัง Google Drive");
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      let finalFileUrl = formData.file_url;
      if (selectedFile) {
        finalFileUrl = await uploadFile(formData.doc_no);
      }

      const payload = {
        ...formData,
        file_url: finalFileUrl,
        doc_type: type,
        date_issued: Timestamp.fromDate(new Date(formData.date_issued)),
        owner_id: auth.currentUser.uid,
        updated_at: serverTimestamp(),
      };

      if (editingDoc?.id) {
        await updateDoc(doc(db, 'documents', editingDoc.id), payload);
      } else {
        await addDoc(collection(db, 'documents'), {
          ...payload,
          created_at: serverTimestamp(),
        });
      }
      
      setModalOpen(false);
      setEditingDoc(null);
      resetForm();
      fetchDocs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      await deleteDoc(doc(db, 'documents', docToDelete));
      setDeleteConfirmOpen(false);
      setDocToDelete(null);
      fetchDocs();
    } catch (err) {
      console.error("Delete error:", err);
      alert("ไม่สามารถลบเอกสารได้");
    }
  };

  const confirmDelete = (id: string) => {
    setDocToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const filteredDocs = docs.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      d.doc_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (type === 'incoming' ? d.sender : d.receiver).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'ทุกหมวดหมู่' || d.category === selectedCategory;
    const matchesYear = selectedYear === 'ทุกปีการศึกษา' || d.academic_year === selectedYear;
    const matchesSubtype = selectedSubtype === 'ทุกประเภท' || d.doc_subtype === selectedSubtype;

    return matchesSearch && matchesCategory && matchesYear && matchesSubtype;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">
            {type === 'incoming' ? 'ทะเบียนหนังสือรับ' : 'ทะเบียนหนังสือส่ง'}
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">รายการดัชนีและระบบลงทะเบียนเอกสาร</p>
        </div>
        {userRole === 'admin' && (
          <button 
            onClick={() => { setEditingDoc(null); resetForm(); setModalOpen(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={14} />
            ลงทะเบียนเอกสารใหม่
          </button>
        )}
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="ค้นหาตามชื่อเรื่อง, เลขที่หนังสือ, หรือผู้ส่ง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold text-slate-600 uppercase outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ทุกหมวดหมู่">ทุกหมวดหมู่</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold text-slate-600 uppercase outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ทุกปีการศึกษา">ทุกปีการศึกษา</option>
            {existingAcademicYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          <select 
            value={selectedSubtype}
            onChange={(e) => setSelectedSubtype(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold text-slate-600 uppercase outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ทุกประเภท">ทุกประเภท</option>
            <option value="internal">ภายใน</option>
            <option value="external">ภายนอก</option>
          </select>
          <button className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs font-bold text-slate-500 hover:bg-slate-100 uppercase transition-colors">
            <ArrowUpDown size={12} />
            เรียงลำดับ
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
              <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                <th className="py-4 px-6">{type === 'incoming' ? 'เลขที่หนังสือ / เลขรับ' : 'เลขที่หนังสือ'}</th>
                <th className="py-4 px-6">วันที่</th>
                <th className="py-4 px-6">ชื่อเรื่อง / หัวข้อ</th>
                <th className="py-4 px-6">{type === 'incoming' ? 'จาก/ผู้ส่ง' : 'ถึง/ผู้รับ'}</th>
                <th className="py-4 px-6 text-center">สถานะ</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 group transition-colors">
                  <td className="py-4 px-6 font-mono font-bold uppercase tracking-tighter">
                    <div className="text-slate-900">{doc.doc_no}</div>
                    {type === 'incoming' && doc.receive_no && (
                      <div className="text-blue-600 text-[11px] mt-0.5">เลขรับ: {doc.receive_no}</div>
                    )}
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap text-slate-400 font-medium">
                    {formatThaiDate(doc.date_issued)}
                  </td>
                  <td className="py-4 px-6 max-w-xs">
                    <div className="text-slate-800 font-semibold truncate group-hover:text-blue-600 transition-colors uppercase text-sm">{doc.title}</div>
                    <div className="flex gap-2 mt-0.5">
                      <div className={cn(
                        "text-[11px] font-bold uppercase mt-0.5 tracking-tighter px-1 rounded",
                        doc.doc_subtype === 'internal' ? "bg-slate-100 text-slate-600" : "bg-purple-100 text-purple-700"
                      )}>
                        {doc.doc_subtype === 'internal' ? 'ภายใน' : 'ภายนอก'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter border-l border-slate-200 pl-2">{doc.category}</div>
                      <div className="text-[11px] text-blue-400 font-bold uppercase mt-0.5 tracking-tighter border-l border-slate-200 pl-2">{doc.academic_year}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-500 font-medium uppercase tracking-tight">
                    {type === 'incoming' ? doc.sender : doc.receiver}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest",
                      doc.status === 'pending' ? "bg-orange-100 text-orange-700" :
                      doc.status === 'received' ? "bg-blue-100 text-blue-700" :
                      "bg-green-100 text-green-700"
                    )}>
                      {doc.status === 'received' ? 'รับแล้ว' : doc.status === 'pending' ? 'รอรับ' : 'เสร็จสิ้น'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.file_url && (
                        <a 
                          href={doc.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-white text-blue-600 rounded border border-transparent hover:border-slate-200 transition-all flex items-center gap-1"
                          title="ดูไฟล์ PDF"
                        >
                          <ExternalLink size={12} />
                          <span className="text-xs font-bold uppercase tracking-tighter">PDF</span>
                        </a>
                      )}
                      {userRole === 'admin' && (
                        <>
                          <button 
                            onClick={() => {
                              setEditingDoc(doc);
                              setFormData({
                                doc_no: doc.doc_no,
                                receive_no: doc.receive_no || '',
                                doc_subtype: doc.doc_subtype || 'internal',
                                title: doc.title,
                                sender: doc.sender,
                                receiver: doc.receiver,
                                date_issued: doc.date_issued.toDate().toISOString().split('T')[0],
                                category: doc.category,
                                academic_year: doc.academic_year || getCurrentAcademicYear(),
                                status: doc.status,
                                file_url: doc.file_url || '',
                                responsible_person: doc.responsible_person || '',
                              });
                              setModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-white text-slate-400 hover:text-blue-600 rounded border border-transparent hover:border-slate-200 transition-all"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            onClick={() => confirmDelete(doc.id!)}
                            className="p-1.5 hover:bg-white text-slate-400 hover:text-red-500 rounded border border-transparent hover:border-slate-200 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300 gap-4">
                      <FileText size={48} className="opacity-10" />
                      <p className="text-xs font-bold uppercase tracking-[0.2em]">ไม่พบข้อมูลที่ค้นหา</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            แสดง {filteredDocs.length} จากทั้งหมด {docs.length} รายการ
          </p>
          <div className="flex gap-1">
            <button className="h-7 px-3 bg-white border border-slate-200 text-xs font-bold text-slate-400 rounded-lg uppercase cursor-not-allowed">ก่อนหน้า</button>
            <div className="flex gap-1">
              <button className="w-7 h-7 bg-blue-600 text-white rounded-lg text-xs font-bold">1</button>
              <button className="w-7 h-7 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50">2</button>
            </div>
            <button className="h-7 px-3 bg-white border border-slate-200 text-xs font-bold text-blue-600 rounded-lg uppercase hover:bg-slate-50">ถัดไป</button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">ยืนยันการลบเอกสาร?</h3>
              <p className="text-slate-500 text-base mb-8 px-4">คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้ออกจากระบบ? การดำเนินการนี้ไม่สามารถเรียกคืนได้</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleDelete}
                  className="w-full py-4 bg-red-500 text-white font-bold text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-[0.98]"
                >
                  ยืนยันการลบข้อมูล
                </button>
                <button 
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="w-full py-4 bg-slate-50 text-slate-500 font-bold text-sm uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Tool */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div>
                  <h2 className="text-base font-bold uppercase tracking-wider">{editingDoc ? 'แก้ไขข้อมูลการลงทะเบียน' : 'ลงทะเบียนเอกสารใหม่'}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{type === 'incoming' ? 'ประเภท: หนังสือรับ' : 'ประเภท: หนังสือส่ง'}</p>
                </div>
                <button type="button" onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded transition-colors text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 bg-slate-50/30 overflow-y-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">ปีการศึกษา</label>
                        <select 
                          value={formData.academic_year}
                          onChange={(e) => setFormData({...formData, academic_year: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow uppercase"
                        >
                          {formAcademicYears.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">ประเภทหนังสือ</label>
                        <select 
                          value={formData.doc_subtype}
                          onChange={(e) => setFormData({...formData, doc_subtype: e.target.value as any})}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow uppercase"
                        >
                          <option value="internal">ภายใน</option>
                          <option value="external">ภายนอก</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">
                        {type === 'incoming' ? 'เลขที่หนังสือ (อ้างอิงจากต้นทาง)' : 'เลขที่หนังสือ'}
                      </label>
                      <div className="flex gap-2">
                        <input 
                          required
                          type="text" 
                          value={formData.doc_no}
                          onChange={(e) => setFormData({...formData, doc_no: e.target.value})}
                          placeholder={type === 'incoming' ? "เช่น ศธ 0001/2569" : "เช่น พย.บ. 0001/2569"}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow placeholder:text-slate-300"
                        />
                        {type === 'outgoing' && !editingDoc && (
                          <button 
                            type="button"
                            onClick={generateNextDocNo}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase shadow-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                          >
                            <ArrowUpDown size={12} />
                            ออกเลขที่อัตโนมัติ
                          </button>
                        )}
                      </div>
                    </div>

                    {type === 'incoming' && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">เลขรับหนังสือ (ออกอัตโนมัติโดยระบบ)</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={formData.receive_no}
                            onChange={(e) => setFormData({...formData, receive_no: e.target.value})}
                            placeholder="เช่น พย.บ. ข.001/2569"
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow placeholder:text-slate-300"
                          />
                          {!editingDoc && (
                            <button 
                              type="button"
                              onClick={generateNextReceiveNo}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase shadow-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                            >
                              <ArrowUpDown size={12} />
                              ออกเลขรับอัตโนมัติ
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">
                          วันที่ในหนังสือ
                        </label>
                        <input 
                          required
                          type="date" 
                          value={formData.date_issued}
                          onChange={(e) => setFormData({...formData, date_issued: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">สถานะเอกสาร</label>
                        <select 
                          value={formData.status}
                          onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow uppercase"
                        >
                          <option value="pending">รอรับ</option>
                          <option value="received">รับแล้ว</option>
                          <option value="archived">เสร็จสิ้น</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">
                        ชื่อเรื่อง / สาระสำคัญ
                      </label>
                      <textarea 
                        required
                        rows={2}
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        placeholder="ระบุชื่อเรื่องหรือสาระสำคัญของเอกสาร..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-600 outline-none resize-none transition-shadow placeholder:text-slate-300 uppercase leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">
                          {type === 'incoming' ? 'หน่วยงานผู้ส่ง' : 'หน่วยงานผู้รับ'}
                        </label>
                        <input 
                          required
                          type="text" 
                          value={type === 'incoming' ? formData.sender : formData.receiver}
                          onChange={(e) => setFormData(type === 'incoming' ? {...formData, sender: e.target.value} : {...formData, receiver: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow uppercase"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">หมวดหมู่เอกสาร</label>
                        <select 
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow uppercase"
                        >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">
                        ชื่อผู้รับผิดชอบ
                      </label>
                      <input
                        type="text"
                        value={formData.responsible_person}
                        onChange={(e) => setFormData({...formData, responsible_person: e.target.value})}
                        placeholder="ระบุชื่อผู้รับผิดชอบ..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 outline-none transition-shadow placeholder:text-slate-300"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">
                        ไฟล์เอกสาร (PDF - อัปโหลดไปยัง Google Drive)
                      </label>
                      <div 
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!uploading) e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                          if (!uploading && e.dataTransfer.files && e.dataTransfer.files[0]) {
                            const file = e.dataTransfer.files[0];
                            if (file.type !== 'application/pdf') {
                              alert('กรุณาเลือกไฟล์ PDF เท่านั้น');
                              return;
                            }
                            setSelectedFile(file);
                          }
                        }}
                        className={cn(
                          "w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
                          uploading ? "bg-slate-50 border-slate-200 cursor-not-allowed" :
                          selectedFile 
                            ? "border-green-400 bg-green-50/30" 
                            : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/30"
                        )}
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".pdf"
                          className="hidden"
                          disabled={uploading}
                        />
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 size={24} className="text-blue-600 animate-spin" />
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">กำลังอัปโหลด...</span>
                          </div>
                        ) : selectedFile ? (
                          <>
                            <FileCheck size={24} className="text-green-500" />
                            <div className="text-center">
                              <p className="text-xs font-bold text-slate-700 uppercase truncate max-w-[300px]">
                                {selectedFile.name}
                              </p>
                              <p className="text-[11px] text-green-600 font-bold uppercase mt-1">ไฟล์พร้อมสำหรับการบันทึก</p>
                            </div>
                          </>
                        ) : formData.file_url ? (
                          <>
                            <FileText size={24} className="text-blue-500" />
                            <div className="text-center">
                              <p className="text-xs font-bold text-blue-600 uppercase">มีไฟล์เดิมในระบบแล้ว</p>
                              <p className="text-[11px] text-slate-400 mt-1 uppercase">ลากไฟล์ใหม่มาวางเพื่อเปลี่ยนไฟล์</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload size={24} className="text-slate-300" />
                            <div className="text-center">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                                ลากไฟล์ PDF มาวางตรงนี้ หรือคลิกเพื่อเลือกไฟล์
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-tighter">
                                ระบบจะบันทึกไปยัง Google Drive อัตโนมัติ
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 flex gap-3 border-t border-slate-100 flex-col sm:flex-row">
                  <button 
                    type="button" 
                    onClick={resetForm}
                    className="flex-1 py-3 px-4 bg-yellow-400 text-yellow-900 font-bold text-xs uppercase tracking-widest rounded-lg shadow-sm hover:bg-yellow-500 transition-colors"
                  >
                    ล้างข้อมูล
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { resetForm(); setModalOpen(false); }}
                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-3 px-4 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
                  >
                    {editingDoc ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

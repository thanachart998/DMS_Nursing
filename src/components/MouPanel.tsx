import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Search, Plus, Trash2, Edit2, Download, FileText, Upload, FileCheck, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatThaiDate, cn, getCurrentAcademicYear, getFormAcademicYears } from '../lib/utils';
import { MouRecord } from '../types';

export default function MouPanel({ userRole }: { userRole?: string | null }) {
  const [mous, setMous] = useState<MouRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mouToDelete, setMouToDelete] = useState<string | null>(null);
  const [editingMou, setEditingMou] = useState<MouRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('ทุกปีการศึกษา');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // File upload state (PDF)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload state (Word)
  const [selectedWordFile, setSelectedWordFile] = useState<File | null>(null);
  const [wordUploading, setWordUploading] = useState(false);
  const wordFileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    academic_year: getCurrentAcademicYear(),
    agency: '',
    title: '',
    signature_date: new Date().toISOString().split('T')[0],
    status: 'pending' as any,
    file_url: '',
    word_url: '',
  });

  const resetForm = () => {
    setSelectedFile(null);
    setSelectedWordFile(null);
    setFormData({
      academic_year: getCurrentAcademicYear(),
      agency: '',
      title: '',
      signature_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      file_url: '',
      word_url: '',
    });
  };

  const formAcademicYears = getFormAcademicYears();

  useEffect(() => {
    fetchMous();
  }, []);

  async function fetchMous() {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'mous'), 
        orderBy('created_at', 'desc')
      );
      const snap = await getDocs(q);
      setMous(snap.docs.map(d => ({ id: d.id, ...d.data() } as MouRecord)));
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

  const handleWordFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.doc') && !file.name.endsWith('.docx')) {
        alert('กรุณาเลือกไฟล์ Word (.doc, .docx) เท่านั้น');
        return;
      }
      setSelectedWordFile(file);
    }
  };

  const uploadFile = async (): Promise<string> => {
    if (!selectedFile) return formData.file_url;
    
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('filename', `mou_${Date.now()}.pdf`);

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

  const uploadWordFile = async (): Promise<string> => {
    if (!selectedWordFile) return formData.word_url;
    
    setWordUploading(true);
    try {
      const form = new FormData();
      form.append('file', selectedWordFile);
      const extension = selectedWordFile.name.endsWith('.docx') ? 'docx' : 'doc';
      form.append('filename', `mou_${Date.now()}.${extension}`);

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
      setWordUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      let finalFileUrl = formData.file_url;
      if (selectedFile) {
        finalFileUrl = await uploadFile();
      }

      let finalWordUrl = formData.word_url;
      if (selectedWordFile) {
        finalWordUrl = await uploadWordFile();
      }

      const payload = {
        ...formData,
        file_url: finalFileUrl,
        word_url: finalWordUrl,
        owner_id: editingMou?.id ? editingMou.owner_id : auth.currentUser.uid,
        updated_at: serverTimestamp(),
      };

      if (editingMou?.id) {
        await updateDoc(doc(db, 'mous', editingMou.id), payload);
      } else {
        await addDoc(collection(db, 'mous'), {
          ...payload,
          created_at: serverTimestamp(),
        });
      }
      
      setModalOpen(false);
      setEditingMou(null);
      resetForm();
      fetchMous();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!mouToDelete) return;
    try {
      await deleteDoc(doc(db, 'mous', mouToDelete));
      setDeleteConfirmOpen(false);
      setMouToDelete(null);
      fetchMous();
    } catch (err) {
      console.error(err);
    }
  };

  const existingAcademicYears = Array.from(new Set(mous.map(p => p.academic_year).filter(Boolean))).sort().reverse();

  const filteredMous = mous.filter(p => {
    const s = searchQuery.toLowerCase();
    const matchSearch = p.agency.toLowerCase().includes(s) || p.title.toLowerCase().includes(s);
    const matchYear = selectedYear === 'ทุกปีการศึกษา' || p.academic_year === selectedYear;
    return matchSearch && matchYear;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedYear]);

  const totalPages = Math.ceil(filteredMous.length / itemsPerPage);
  const paginatedMous = filteredMous.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">
            เอกสาร MOU
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">รายการดัชนีและระบบลงทะเบียนเอกสาร</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold text-slate-600 uppercase outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ทุกปีการศึกษา">ทุกปีการศึกษา</option>
            {existingAcademicYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="ค้นหา (หน่วยงาน, ชื่อเรื่อง)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-shadow placeholder:uppercase placeholder:tracking-wider placeholder:text-xs"
            />
          </div>
          {userRole === 'admin' && (
            <button 
              onClick={() => { setEditingMou(null); resetForm(); setModalOpen(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={14} />
              เพิ่มเอกสาร MOU
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
              <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                <th className="py-4 px-6">วันที่ลงนาม</th>
                <th className="py-4 px-6">ปีการศึกษา</th>
                <th className="py-4 px-6">หน่วยงาน</th>
                <th className="py-4 px-6">ชื่อเรื่อง / สารสำคัญ</th>
                <th className="py-4 px-6 text-center">สถานะ</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 text-slate-600 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                    <div className="flex justify-center mb-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filteredMous.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                    ไม่พบข้อมูล MOU
                  </td>
                </tr>
              ) : paginatedMous.map((mou) => (
                <tr key={mou.id} className="hover:bg-slate-50 group transition-colors">
                  <td className="py-4 px-6 text-slate-400 whitespace-nowrap">
                    {mou.signature_date ? formatThaiDate(mou.signature_date) : '-'}
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-900">
                    <div className="text-[11px] text-blue-600 font-bold uppercase tracking-tighter bg-blue-50 inline-block px-2 py-0.5 rounded">{mou.academic_year}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-slate-900 font-bold uppercase text-xs">{mou.agency}</div>
                  </td>
                  <td className="py-4 px-6 text-slate-700 max-w-xs truncate">
                    <button 
                      onClick={() => {
                        setEditingMou(mou);
                        setFormData({
                          academic_year: mou.academic_year || getCurrentAcademicYear(),
                          agency: mou.agency || '',
                          title: mou.title || '',
                          signature_date: mou.signature_date || new Date().toISOString().split('T')[0],
                          status: mou.status || 'pending',
                          file_url: mou.file_url || '',
                        });
                        setModalOpen(true);
                      }}
                      className="text-left w-full cursor-pointer hover:underline text-slate-700 font-bold group-hover:text-blue-600 transition-colors uppercase text-sm block truncate"
                    >
                      {mou.title}
                    </button>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest",
                      mou.status === 'pending' ? "bg-orange-100 text-orange-700" :
                      mou.status === 'received' ? "bg-blue-100 text-blue-700" :
                      mou.status === 'cancelled' ? "bg-red-100 text-red-700" :
                      "bg-green-100 text-green-700"
                    )}>
                      {mou.status === 'received' ? 'รับแล้ว' : mou.status === 'pending' ? 'รอรับ' : mou.status === 'cancelled' ? 'ยกเลิก' : 'เสร็จสิ้น'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right space-x-1 flex justify-end">
                    {mou.word_url && (
                      <a 
                        href={mou.word_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-lg inline-flex transition-colors"
                        title="ดูไฟล์ Word"
                      >
                        <FileText size={18} />
                      </a>
                    )}
                    {mou.file_url && (
                      <a 
                        href={mou.file_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 rounded-lg inline-flex transition-colors"
                        title="ดูไฟล์ PDF"
                      >
                        <Download size={18} />
                      </a>
                    )}
                    {!mou.word_url && !mou.file_url && (
                      <span className="inline-block p-2 text-slate-200" title="ไม่มีไฟล์แนบ">
                        <Download size={18} />
                      </span>
                    )}
                    
                    {userRole === 'admin' && (
                      <>
                        <button 
                          onClick={() => {
                            setEditingMou(mou);
                            setFormData({
                              academic_year: mou.academic_year || getCurrentAcademicYear(),
                              agency: mou.agency || '',
                              title: mou.title || '',
                              signature_date: mou.signature_date || new Date().toISOString().split('T')[0],
                              status: mou.status || 'pending',
                              file_url: mou.file_url || '',
                              word_url: mou.word_url || '',
                            });
                            setModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setMouToDelete(mou.id!);
                            setDeleteConfirmOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            แสดง {filteredMous.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredMous.length)} จากทั้งหมด {filteredMous.length} รายการ
          </p>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 px-3 bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-lg uppercase hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ก่อนหน้า
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      "w-7 h-7 rounded-lg text-xs font-bold",
                      currentPage === i + 1 
                        ? "bg-blue-600 text-white" 
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 px-3 bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-lg uppercase hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ถัดไป
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                  <h2 className="text-base font-bold uppercase tracking-wider">{editingMou ? 'แก้ไขเอกสาร MOU' : 'เพิ่มเอกสาร MOU'}</h2>
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
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">วันที่ลงนาม</label>
                        <input 
                          required
                          type="date" 
                          value={formData.signature_date}
                          onChange={(e) => setFormData({...formData, signature_date: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">หน่วยงาน</label>
                        <input 
                          required
                          type="text" 
                          value={formData.agency}
                          onChange={(e) => setFormData({...formData, agency: e.target.value})}
                          placeholder="ระบุหน่วยงาน..."
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow uppercase"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">ชื่อเรื่อง / สารสำคัญ</label>
                      <input 
                        required
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        placeholder="ระบุชื่อเรื่องหรือสาระสำคัญ..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow uppercase"
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
                          <option value="cancelled">ยกเลิก</option>
                        </select>
                     </div>
                  </div>

                  <div className="space-y-4">
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
                              <p className="text-xs font-bold text-blue-600 uppercase">มีไฟล์ PDF เดิมในระบบแล้ว</p>
                              <p className="text-[11px] text-slate-400 mt-1 uppercase">ลากไฟล์ใหม่มาวางเพื่อเปลี่ยนไฟล์</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload size={24} className="text-slate-300" />
                            <div className="text-center">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                                ลากไฟล์ PDF มาวางตรงนี้ หรือคลิก
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">
                        ไฟล์เอกสาร (Word - อัปโหลดไปยัง Google Drive)
                      </label>
                      <div 
                        onClick={() => !wordUploading && wordFileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!wordUploading) e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                          if (!wordUploading && e.dataTransfer.files && e.dataTransfer.files[0]) {
                            const file = e.dataTransfer.files[0];
                            if (!file.name.endsWith('.doc') && !file.name.endsWith('.docx')) {
                              alert('กรุณาเลือกไฟล์ Word (.doc, .docx) เท่านั้น');
                              return;
                            }
                            setSelectedWordFile(file);
                          }
                        }}
                        className={cn(
                          "w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
                          wordUploading ? "bg-slate-50 border-slate-200 cursor-not-allowed" :
                          selectedWordFile 
                            ? "border-green-400 bg-green-50/30" 
                            : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/30"
                        )}
                      >
                        <input 
                          type="file" 
                          ref={wordFileInputRef}
                          onChange={handleWordFileChange}
                          accept=".doc,.docx"
                          className="hidden"
                          disabled={wordUploading}
                        />
                        {wordUploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 size={24} className="text-blue-600 animate-spin" />
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">กำลังอัปโหลด...</span>
                          </div>
                        ) : selectedWordFile ? (
                          <>
                            <FileCheck size={24} className="text-green-500" />
                            <div className="text-center">
                              <p className="text-xs font-bold text-slate-700 uppercase truncate max-w-[300px]">
                                {selectedWordFile.name}
                              </p>
                              <p className="text-[11px] text-green-600 font-bold uppercase mt-1">ไฟล์พร้อมสำหรับการบันทึก</p>
                            </div>
                          </>
                        ) : formData.word_url ? (
                          <>
                            <FileText size={24} className="text-blue-500" />
                            <div className="text-center">
                              <p className="text-xs font-bold text-blue-600 uppercase">มีไฟล์ Word เดิมในระบบแล้ว</p>
                              <p className="text-[11px] text-slate-400 mt-1 uppercase">ลากไฟล์ใหม่มาวางเพื่อเปลี่ยนไฟล์</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload size={24} className="text-slate-300" />
                            <div className="text-center">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                                ลากไฟล์ Word มาวางตรงนี้ หรือคลิก
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
                    ปิด
                  </button>
                  {userRole === 'admin' && (
                  <button 
                    type="submit" 
                    className="flex-[2] py-3 px-4 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
                  >
                    {editingMou ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                  </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden p-6 text-center border border-slate-200"
            >
              <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการลบ?</h3>
              <p className="text-sm text-slate-500 font-medium mb-6 uppercase tracking-tight">คุณต้องการลบเอกสาร MOU นี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="flex-1 py-2 px-4 bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-2 px-4 bg-red-600 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-md hover:bg-red-700 transition-colors"
                >
                  ลบข้อมูล
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

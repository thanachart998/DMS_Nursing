import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Search, Plus, Trash2, Edit2, Download, FileText, Upload, FileCheck, Loader2, X, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatThaiDate, cn, getCurrentAcademicYear, getFormAcademicYears } from '../lib/utils';
import { PetitionRecord } from '../types';

export default function PetitionPanel({ userRole }: { userRole?: string | null }) {
  const [petitions, setPetitions] = useState<PetitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [petitionToDelete, setPetitionToDelete] = useState<string | null>(null);
  const [editingPetition, setEditingPetition] = useState<PetitionRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('ทุกปีการศึกษา');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    topic: 'ลาออก' as 'ลาออก' | 'พักการเรียน',
    applicant_status: 'นักศึกษา' as 'นักศึกษา' | 'อาจารย์',
    first_name: '',
    last_name: '',
    identifier: '',
    file_url: '',
    academic_year: getCurrentAcademicYear(),
    date_issued: new Date().toISOString().split('T')[0],
  });

  const resetForm = () => {
    setSelectedFile(null);
    setFormData({
      topic: 'ลาออก',
      applicant_status: 'นักศึกษา',
      first_name: '',
      last_name: '',
      identifier: '',
      file_url: '',
      academic_year: getCurrentAcademicYear(),
      date_issued: new Date().toISOString().split('T')[0],
    });
  };

  const formAcademicYears = getFormAcademicYears();

  useEffect(() => {
    fetchPetitions();
  }, []);

  useEffect(() => {
    // If topic is 'พักการเรียน', force applicant_status to 'นักศึกษา'
    if (formData.topic === 'พักการเรียน' && formData.applicant_status !== 'นักศึกษา') {
      setFormData((prev) => ({ ...prev, applicant_status: 'นักศึกษา' }));
    }
  }, [formData.topic]);

  async function fetchPetitions() {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'petitions'), 
        orderBy('created_at', 'desc')
      );
      const snap = await getDocs(q);
      setPetitions(snap.docs.map(d => ({ id: d.id, ...d.data() } as PetitionRecord)));
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

  const uploadFile = async (): Promise<string> => {
    if (!selectedFile) return formData.file_url;
    
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('filename', `petition_${Date.now()}.pdf`);

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
        finalFileUrl = await uploadFile();
      }

      const payload = {
        ...formData,
        file_url: finalFileUrl,
        owner_id: auth.currentUser.uid,
        updated_at: serverTimestamp(),
      };

      if (editingPetition?.id) {
        await updateDoc(doc(db, 'petitions', editingPetition.id), payload);
      } else {
        await addDoc(collection(db, 'petitions'), {
          ...payload,
          created_at: serverTimestamp(),
        });
      }
      
      setModalOpen(false);
      setEditingPetition(null);
      resetForm();
      fetchPetitions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!petitionToDelete) return;
    try {
      await deleteDoc(doc(db, 'petitions', petitionToDelete));
      setDeleteConfirmOpen(false);
      setPetitionToDelete(null);
      fetchPetitions();
    } catch (err) {
      console.error(err);
    }
  };

  const existingAcademicYears = Array.from(new Set(petitions.map(p => p.academic_year).filter(Boolean))).sort().reverse();

  const filteredPetitions = petitions.filter(p => {
    const s = searchQuery.toLowerCase();
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    const matchSearch = fullName.includes(s) || p.identifier.toLowerCase().includes(s);
    const matchYear = selectedYear === 'ทุกปีการศึกษา' || p.academic_year === selectedYear;
    return matchSearch && matchYear;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">
          หนังสือคำร้อง
        </h2>
        
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
              placeholder="ค้นหา (ชื่อ, นามสกุล, รหัส)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-shadow placeholder:uppercase placeholder:tracking-wider placeholder:text-xs"
            />
          </div>
          {(userRole === 'admin' || userRole === 'lecturer' || userRole === 'guest') && (
            <button 
              onClick={() => { setEditingPetition(null); resetForm(); setModalOpen(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={14} />
              เพิ่มคำร้องใหม่
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
              <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                <th className="py-4 px-6">เรื่อง</th>
                <th className="py-4 px-6">ผู้ยื่นคำร้อง</th>
                <th className="py-4 px-6">รหัสนักศึกษา / รหัสพนักงาน</th>
                <th className="py-4 px-6">ชื่อ - นามสกุล</th>
                <th className="py-4 px-6">วันที่ยื่นคำร้อง</th>
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
              ) : filteredPetitions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                    ไม่พบข้อมูลคำร้อง
                  </td>
                </tr>
              ) : filteredPetitions.map((petition) => (
                <tr key={petition.id} className="hover:bg-slate-50 group transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {petition.topic}
                  </td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider",
                      petition.applicant_status === 'อาจารย์' ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"
                    )}>
                      {petition.applicant_status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-slate-900 font-bold">{petition.identifier}</div>
                  </td>
                  <td className="py-4 px-6 text-slate-700">
                    {petition.first_name} {petition.last_name}
                  </td>
                  <td className="py-4 px-6 text-slate-400 whitespace-nowrap">
                    {petition.date_issued ? formatThaiDate(petition.date_issued) : petition.created_at ? formatThaiDate(new Date(petition.created_at.seconds * 1000).toISOString()) : '-'}
                  </td>
                  <td className="py-4 px-6 text-right space-x-2">
                    {petition.file_url ? (
                      <a 
                        href={petition.file_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-lg inline-flex transition-colors"
                        title="ดูไฟล์แนบ"
                      >
                        <Download size={16} />
                      </a>
                    ) : (
                      <span className="inline-block p-2 text-slate-200" title="ไม่มีไฟล์แนบ">
                        <Download size={16} />
                      </span>
                    )}
                    
                    {(userRole === 'admin' || auth.currentUser?.uid === petition.owner_id) && (
                      <>
                        <button 
                          onClick={() => {
                            setEditingPetition(petition);
                            setFormData({
                              topic: petition.topic,
                              applicant_status: petition.applicant_status,
                              first_name: petition.first_name,
                              last_name: petition.last_name,
                              identifier: petition.identifier,
                              file_url: petition.file_url || '',
                              academic_year: petition.academic_year || getCurrentAcademicYear(),
                              date_issued: petition.date_issued || new Date().toISOString().split('T')[0],
                            });
                            setModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setPetitionToDelete(petition.id!);
                            setDeleteConfirmOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <h2 className="text-base font-bold uppercase tracking-wider">{editingPetition ? 'แก้ไขหนังสือคำร้อง' : 'เพิ่มหนังสือคำร้องใหม่'}</h2>
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
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">วันที่ยื่นคำร้อง</label>
                        <input 
                          required
                          type="date" 
                          value={formData.date_issued}
                          onChange={(e) => setFormData({...formData, date_issued: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">เรื่องของคำร้อง</label>
                        <select 
                          value={formData.topic}
                          onChange={(e) => setFormData({...formData, topic: e.target.value as any})}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                        >
                          <option value="ลาออก">ลาออก</option>
                          <option value="พักการเรียน">พักการเรียน</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">สถานะผู้ยื่นคำร้อง</label>
                        <select 
                          value={formData.applicant_status}
                          onChange={(e) => setFormData({...formData, applicant_status: e.target.value as any})}
                          disabled={formData.topic === 'พักการเรียน'}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="นักศึกษา">นักศึกษา</option>
                          {(formData.topic !== 'พักการเรียน') && (
                            <option value="อาจารย์">อาจารย์</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">ชื่อ</label>
                        <input 
                          required
                          type="text" 
                          value={formData.first_name}
                          onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                          placeholder="ชื่อ..."
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">นามสกุล</label>
                        <input 
                          required
                          type="text" 
                          value={formData.last_name}
                          onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                          placeholder="นามสกุล..."
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-0.5">รหัสนักศึกษา / รหัสพนักงาน</label>
                      <input 
                        required
                        type="text" 
                        value={formData.identifier}
                        onChange={(e) => setFormData({...formData, identifier: e.target.value})}
                        placeholder="เช่น 12345678"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-shadow"
                      />
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
                    {editingPetition ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                  </button>
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
              <p className="text-sm text-slate-500 font-medium mb-6 uppercase tracking-tight">คุณต้องการลบคำร้องนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
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

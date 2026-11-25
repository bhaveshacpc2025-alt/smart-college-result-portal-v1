import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeCanvas } from 'qrcode.react';
import {
  PlusCircle,
  QrCode,
  KeyRound,
  CheckSquare,
  UserPlus,
  ListChecks,
  Rocket,
  CheckCircle2,
  History,
  Settings,
  Trash2,
  Copy,
  Download,
  Upload,
  ShieldAlert,
  Check,
  X,
} from 'lucide-react';
import { apiRequest } from '../utils/api';

const DEFAULT_BOUNDARIES = [
  { grade: 'AA', minPercentage: 85, label: 'Outstanding' },
  { grade: 'AB', minPercentage: 75, label: 'Excellent' },
  { grade: 'BB', minPercentage: 65, label: 'Very Good' },
  { grade: 'BC', minPercentage: 55, label: 'Good' },
  { grade: 'CC', minPercentage: 40, label: 'Satisfactory' },
  { grade: 'FF', minPercentage: 0, label: 'Fail' },
];

export default function HodPortal({ classes, auditLogs, onRefresh }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'create' | 'overview' | 'permissions' | 'enrollments' | 'settings' | 'audit'
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  // Create Class Form State
  const [className, setClassName] = useState('');
  const [courseProgram, setCourseProgram] = useState('');
  const [semesterYear, setSemesterYear] = useState('');
  const [examMonthYear, setExamMonthYear] = useState('');
  const [passingPercentage, setPassingPercentage] = useState(40);
  const [preparedBy, setPreparedBy] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [dateOfIssue, setDateOfIssue] = useState(new Date().toISOString().slice(0, 10));
  const [whitelistText, setWhitelistText] = useState('');
  const [subjects, setSubjects] = useState([
    { code: 'CS501', name: 'Operating Systems', maxMarks: 100 },
    { code: 'CS502', name: 'Database Management Systems', maxMarks: 100 },
  ]);
  const [gradeBoundaries, setGradeBoundaries] = useState(DEFAULT_BOUNDARIES);

  // Edit Settings Form State
  const [editSettings, setEditSettings] = useState(null);

  const qrContainerRef = useRef(null);

  const activeClass = classes.find((c) => c.id === selectedClassId) || classes[0] || null;

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleExcelWhitelist = async (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const extracted = [];
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          const val = String(cell || '').trim().toUpperCase();
          if (val && !['ENROLLMENT', 'ENROLLMENT NO', 'ENROLLMENT NO.', 'ID', 'ROLL NO'].includes(val)) {
            extracted.push(val);
          }
        }
      }
      const unique = [...new Set(extracted)];
      setter((prev) => {
        const merged = [...new Set([...prev.split(/[\n,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean), ...unique])];
        return merged.join('\n');
      });
      showToast('success', `Imported ${unique.length} enrollment numbers from ${file.name}.`);
    } catch (err) {
      showToast('error', `Failed to parse file: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await apiRequest('/api/hod/classes', {
        method: 'POST',
        body: JSON.stringify({
          className,
          courseProgram,
          semesterYear,
          examMonthYear,
          passingPercentage: Number(passingPercentage),
          preparedBy,
          checkedBy,
          dateOfIssue,
          whitelist: whitelistText,
          subjects,
          gradeBoundaries,
        }),
      });
      showToast('success', `Class "${data.class.className}" created! Invite Code: ${data.class.inviteCode}`);
      setSelectedClassId(data.class.id);
      setActiveTab('overview');
      setClassName('');
      setCourseProgram('');
      setSemesterYear('');
      setExamMonthYear('');
      setWhitelistText('');
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const openSettingsForActive = () => {
    if (!activeClass) return;
    setEditSettings({
      id: activeClass.id,
      version: activeClass.version,
      className: activeClass.className,
      courseProgram: activeClass.courseProgram,
      semesterYear: activeClass.semesterYear,
      examMonthYear: activeClass.examMonthYear,
      passingPercentage: activeClass.passingPercentage,
      preparedBy: activeClass.preparedBy,
      checkedBy: activeClass.checkedBy,
      dateOfIssue: activeClass.dateOfIssue,
      whitelistText: (activeClass.whitelist || []).join('\n'),
      gradeBoundaries: activeClass.gradeBoundaries || DEFAULT_BOUNDARIES,
      subjects: activeClass.subjects.map((s) => ({ id: s.id, code: s.code, name: s.name, maxMarks: s.maxMarks })),
    });
    setActiveTab('settings');
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!editSettings) return;
    setBusy(true);
    try {
      await apiRequest(`/api/hod/classes/${editSettings.id}/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          version: editSettings.version,
          className: editSettings.className,
          courseProgram: editSettings.courseProgram,
          semesterYear: editSettings.semesterYear,
          examMonthYear: editSettings.examMonthYear,
          passingPercentage: Number(editSettings.passingPercentage),
          preparedBy: editSettings.preparedBy,
          checkedBy: editSettings.checkedBy,
          dateOfIssue: editSettings.dateOfIssue,
          whitelist: editSettings.whitelistText,
          gradeBoundaries: editSettings.gradeBoundaries,
          subjects: editSettings.subjects,
        }),
      });
      showToast('success', 'Class grading rules & signatory parameters updated across all portals.');
      await onRefresh();
      setActiveTab('overview');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePermissionDecision = async (permissionId, action) => {
    setBusy(true);
    try {
      await apiRequest(`/api/hod/permissions/${permissionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      showToast('success', `Subject permission ${action === 'APPROVE' ? 'approved' : 'rejected'}.`);
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEnrollmentDecision = async (enrollmentId, action) => {
    setBusy(true);
    try {
      await apiRequest(`/api/hod/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      showToast('success', `Student enrollment ${action === 'APPROVE' ? 'accepted' : 'rejected'}.`);
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeployFinalResult = async () => {
    if (!activeClass) return;
    setBusy(true);
    try {
      await apiRequest(`/api/hod/classes/${activeClass.id}/deploy`, {
        method: 'POST',
      });
      showToast('success', `Official Final Results deployed for ${activeClass.className}! All student report cards unlocked.`);
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadQrImage = () => {
    const canvas = qrContainerRef.current?.querySelector('canvas');
    if (!canvas || !activeClass) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeClass.inviteCode}_Class_QR.png`;
    a.click();
  };

  const copyInviteLink = (cls) => {
    const link = `${window.location.origin}/?join=${cls.inviteCode}`;
    navigator.clipboard?.writeText(link);
    showToast('success', `Copied invite link (${cls.inviteCode}) to clipboard.`);
  };

  const pendingPermissionsCount = classes.reduce(
    (acc, c) => acc + c.permissions.filter((p) => p.status === 'PENDING').length,
    0
  );
  const pendingEnrollmentsCount = classes.reduce(
    (acc, c) => acc + c.enrollments.filter((e) => e.status === 'PENDING').length,
    0
  );

  const navTabs = [
    { id: 'overview', label: 'Class Tracker & Deploy', icon: ListChecks },
    { id: 'create', label: 'Create New Class', icon: PlusCircle },
    { id: 'permissions', label: 'Subject Permissions', icon: KeyRound, badge: pendingPermissionsCount },
    { id: 'enrollments', label: 'Student Enrollments', icon: UserPlus, badge: pendingEnrollmentsCount },
    { id: 'audit', label: 'Audit Logs', icon: History, badge: auditLogs.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between shadow-sm ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
                  active
                    ? 'bg-navy-900 text-white shadow'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                      active ? 'bg-gold-500 text-navy-900' : 'bg-navy-900 text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {classes.length > 0 && activeTab !== 'create' && (
          <div className="flex items-center gap-2">
            <select
              value={activeClass?.id || ''}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl bg-white text-navy-900 outline-none focus:ring-2 focus:ring-navy-700"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className} ({c.inviteCode})
                </option>
              ))}
            </select>
            {activeClass && (
              <button
                type="button"
                onClick={openSettingsForActive}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
              >
                <Settings className="w-4 h-4" />
                Grading Rules
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State prompting Create New Class */}
      {classes.length === 0 && activeTab !== 'create' && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-navy-900/10 text-navy-900 flex items-center justify-center mx-auto">
            <PlusCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-navy-900">No Classes Created Yet</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Start by creating your first Class / Semester, registering subjects, uploading the valid enrollment whitelist, and configuring dynamic grading rules.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-semibold text-sm shadow"
          >
            <PlusCircle className="w-4 h-4" />
            Create Your First Class
          </button>
        </div>
      )}

      {/* TAB: CREATE NEW CLASS */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateClass} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <PlusCircle className="w-6 h-6 text-navy-900" />
            <div>
              <h2 className="text-lg font-bold text-navy-900">Create New Class &amp; Grading Parameters</h2>
              <p className="text-xs text-slate-500">
                Configure class metadata, subjects, enrollment whitelist, dynamic grade boundaries, and official signatories.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Division Name *</label>
              <input
                type="text"
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. B.Tech CSE Sem-5 Div-A"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-navy-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Course / Program *</label>
              <input
                type="text"
                required
                value={courseProgram}
                onChange={(e) => setCourseProgram(e.target.value)}
                placeholder="e.g. B.Tech Computer Engineering"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-navy-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Semester / Year *</label>
              <input
                type="text"
                required
                value={semesterYear}
                onChange={(e) => setSemesterYear(e.target.value)}
                placeholder="e.g. Semester V / 2026"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-navy-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Examination Month &amp; Year *</label>
              <input
                type="text"
                required
                value={examMonthYear}
                onChange={(e) => setExamMonthYear(e.target.value)}
                placeholder="e.g. November 2026"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-navy-700"
              />
            </div>
          </div>

          {/* Subjects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy-900">Registered Subjects (Code, Name, Max Marks)</h3>
              <button
                type="button"
                onClick={() => setSubjects([...subjects, { code: '', name: '', maxMarks: 100 }])}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Subject
              </button>
            </div>
            <div className="space-y-2">
              {subjects.map((subj, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    required
                    value={subj.code}
                    onChange={(e) => {
                      const next = [...subjects];
                      next[idx].code = e.target.value;
                      setSubjects(next);
                    }}
                    placeholder="Code (e.g. CS501)"
                    className="col-span-3 px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    required
                    value={subj.name}
                    onChange={(e) => {
                      const next = [...subjects];
                      next[idx].name = e.target.value;
                      setSubjects(next);
                    }}
                    placeholder="Subject Name"
                    className="col-span-6 px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={subj.maxMarks}
                    onChange={(e) => {
                      const next = [...subjects];
                      next[idx].maxMarks = Number(e.target.value);
                      setSubjects(next);
                    }}
                    placeholder="Max Marks"
                    className="col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                  <button
                    type="button"
                    disabled={subjects.length <= 1}
                    onClick={() => setSubjects(subjects.filter((_, i) => i !== idx))}
                    className="col-span-1 p-2 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-30 flex justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Whitelist + Grading Rules */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-navy-900">
                  Whitelist of Valid Enrollment Numbers
                </label>
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Import Excel / CSV
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleExcelWhitelist(e, setWhitelistText)}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Paste Enrollment Numbers separated by commas or new lines. Outsiders not on this list are blocked from joining.
              </p>
              <textarea
                rows={5}
                value={whitelistText}
                onChange={(e) => setWhitelistText(e.target.value)}
                placeholder={'ENR2026001\nENR2026002\nENR2026003'}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-navy-700"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-navy-900">Dynamic Grading &amp; Passing Threshold</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600">Pass %:</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={passingPercentage}
                    onChange={(e) => setPassingPercentage(Number(e.target.value))}
                    className="w-20 px-2.5 py-1 text-sm border border-slate-300 rounded-lg font-bold text-navy-900"
                  />
                </div>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {gradeBoundaries.map((b, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={b.grade}
                      onChange={(e) => {
                        const next = [...gradeBoundaries];
                        next[i].grade = e.target.value.toUpperCase();
                        setGradeBoundaries(next);
                      }}
                      placeholder="Grade"
                      className="col-span-3 px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg"
                    />
                    <div className="col-span-4 flex items-center gap-1">
                      <span className="text-xs text-slate-500">≥</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={b.minPercentage}
                        onChange={(e) => {
                          const next = [...gradeBoundaries];
                          next[i].minPercentage = Number(e.target.value);
                          setGradeBoundaries(next);
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                    <input
                      type="text"
                      value={b.label || ''}
                      onChange={(e) => {
                        const next = [...gradeBoundaries];
                        next[i].label = e.target.value;
                        setGradeBoundaries(next);
                      }}
                      placeholder="Label"
                      className="col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setGradeBoundaries(gradeBoundaries.filter((_, idx) => idx !== i))}
                      className="col-span-1 text-rose-500 hover:text-rose-700 flex justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setGradeBoundaries([...gradeBoundaries, { grade: 'C', minPercentage: 45, label: 'Pass' }])}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                + Add Grade Tier
              </button>
            </div>
          </div>

          {/* Signatory Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Prepared By (Report Card)</label>
              <input
                type="text"
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="e.g. Exam Cell Coordinator"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Checked By (Report Card)</label>
              <input
                type="text"
                value={checkedBy}
                onChange={(e) => setCheckedBy(e.target.value)}
                placeholder="e.g. HOD / Verification Officer"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Issue</label>
              <input
                type="date"
                value={dateOfIssue}
                onChange={(e) => setDateOfIssue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-semibold text-sm shadow-md"
            >
              {busy ? 'Creating Class...' : 'Create Class & Generate QR'}
            </button>
          </div>
        </form>
      )}

      {/* TAB: OVERVIEW (QR + Subject Lock Tracker + Synchronized Deploy) */}
      {activeTab === 'overview' && activeClass && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Generate Class QR & Link */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <QrCode className="w-5 h-5 text-navy-900" />
              <h2 className="text-base font-bold text-navy-900">Class QR &amp; Invite Link</h2>
            </div>

            <div
              ref={qrContainerRef}
              className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center gap-3"
            >
              <QRCodeCanvas
                value={`${window.location.origin}/?join=${activeClass.inviteCode}`}
                size={180}
                level="M"
                includeMargin={true}
              />
              <div className="text-center">
                <p className="text-xs text-slate-500">Class Invite Code</p>
                <p className="text-lg font-mono font-extrabold text-navy-900 tracking-wider">
                  {activeClass.inviteCode}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => copyInviteLink(activeClass)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Copy className="w-4 h-4" />
                Copy Invite Link
              </button>
              <button
                type="button"
                onClick={downloadQrImage}
                className="px-3 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Download QR PNG
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Course:</span>
                <span className="font-semibold text-slate-800">{activeClass.courseProgram}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Semester:</span>
                <span className="font-semibold text-slate-800">{activeClass.semesterYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pass Threshold:</span>
                <span className="font-semibold text-slate-800">{activeClass.passingPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Whitelisted IDs:</span>
                <span className="font-semibold text-slate-800">{activeClass.whitelist?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Approved Students:</span>
                <span className="font-semibold text-emerald-700">{activeClass.approvedStudentsCount}</span>
              </div>
            </div>
          </div>

          {/* Right 2 Cols: Subject Lock Status Tracker + Verify & Deploy */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ListChecks className="w-5 h-5 text-navy-900" />
                  <div>
                    <h2 className="text-base font-bold text-navy-900">Subject Lock Status Tracker</h2>
                    <p className="text-xs text-slate-500">
                      {activeClass.lockedSubjectsCount} of {activeClass.totalSubjectsCount} subjects locked &amp; submitted
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    activeClass.isDeployed
                      ? 'bg-emerald-100 text-emerald-800'
                      : activeClass.allSubjectsLocked
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {activeClass.isDeployed
                    ? 'Results Deployed'
                    : activeClass.allSubjectsLocked
                    ? 'Ready for Deployment'
                    : 'Awaiting Subject Locks'}
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {activeClass.subjects.map((subj) => {
                  const statusBadge =
                    subj.status === 'LOCKED'
                      ? { label: 'Locked & Submitted', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
                      : subj.status === 'IN_PROGRESS'
                      ? { label: 'In Progress', cls: 'bg-amber-100 text-amber-800 border-amber-200' }
                      : { label: 'Pending Professor', cls: 'bg-slate-100 text-slate-600 border-slate-200' };

                  return (
                    <div key={subj.id} className="p-4 flex flex-wrap items-center justify-between gap-3 bg-white">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-navy-900 text-white">
                            {subj.code}
                          </span>
                          <span className="font-semibold text-sm text-slate-900">{subj.name}</span>
                          <span className="text-xs text-slate-500">(Max: {subj.maxMarks})</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {subj.assignedProfessorName
                            ? `Assigned: ${subj.assignedProfessorName} (${subj.assignedProfessorIdentifier}) • Graded: ${subj.marksEnteredCount}/${subj.approvedStudentsCount}`
                            : 'No professor assigned yet — professor must scan QR & request permission.'}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Verify & Deploy Final Result Card */}
              <div
                className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  activeClass.isDeployed
                    ? 'bg-emerald-50 border-emerald-200'
                    : activeClass.allSubjectsLocked
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {activeClass.isDeployed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Rocket className="w-5 h-5 text-navy-900" />
                    )}
                    <h3 className="font-bold text-sm text-navy-900">
                      {activeClass.isDeployed
                        ? 'Final Results Deployed Simultaneously'
                        : 'Verify & Deploy Final Result'}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    {activeClass.isDeployed
                      ? `Deployed on ${new Date(activeClass.deployedAt).toLocaleString()}. All approved students can view & download Official Report Cards.`
                      : activeClass.allSubjectsLocked
                      ? '100% of subjects are Locked & Submitted. Click Deploy to unlock all student report cards simultaneously.'
                      : `Synchronized Release Rule: Strictly disabled until 100% of registered subjects (${activeClass.lockedSubjectsCount}/${activeClass.totalSubjectsCount}) are Locked & Submitted.`}
                  </p>
                </div>

                {!activeClass.isDeployed && (
                  <button
                    type="button"
                    disabled={!activeClass.allSubjectsLocked || busy}
                    onClick={handleDeployFinalResult}
                    className="shrink-0 px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center gap-2 shadow transition-all"
                  >
                    <Rocket className="w-4 h-4" />
                    Deploy Final Result
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: SUBJECT PERMISSIONS */}
      {activeTab === 'permissions' && activeClass && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <CheckSquare className="w-5 h-5 text-navy-900" />
            <h2 className="text-base font-bold text-navy-900">
              Professor Subject Permission Requests — {activeClass.className}
            </h2>
          </div>

          {activeClass.permissions.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No professor subject requests received for this class yet. Share the Class Invite Code ({activeClass.inviteCode}) or QR with faculty.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {activeClass.permissions.map((perm) => (
                <div key={perm.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-navy-900 text-white">
                        {perm.subjectCode}
                      </span>
                      <span className="font-bold text-sm text-slate-900">{perm.subjectName}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Requested by <strong>{perm.professorName}</strong> ({perm.professorIdentifier})
                      {perm.professorDepartment ? ` • ${perm.professorDepartment}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {perm.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlePermissionDecision(perm.id, 'APPROVE')}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlePermissionDecision(perm.id, 'REJECT')}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          perm.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {perm.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: STUDENT ENROLLMENTS */}
      {activeTab === 'enrollments' && activeClass && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-navy-900" />
            <h2 className="text-base font-bold text-navy-900">
              Student Enrollment Requests — {activeClass.className}
            </h2>
          </div>

          {activeClass.enrollments.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No student enrollment requests yet. Students can scan the Class QR or enter {activeClass.inviteCode}.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {activeClass.enrollments.map((enr) => (
                <div key={enr.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-navy-900 border border-slate-300">
                        {enr.enrollmentNo}
                      </span>
                      <span className="font-bold text-sm text-slate-900">{enr.studentName}</span>
                      {enr.whitelistMatched ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                          Whitelist Verified
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold inline-flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          Manual Check
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Requested: {new Date(enr.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {enr.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleEnrollmentDecision(enr.id, 'APPROVE')}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleEnrollmentDecision(enr.id, 'REJECT')}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          enr.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {enr.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: EDIT CLASS SETTINGS & GRADING RULES */}
      {activeTab === 'settings' && editSettings && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Settings className="w-5 h-5 text-navy-900" />
              <h2 className="text-lg font-bold text-navy-900">Edit Dynamic Grading Rules &amp; Signatories</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Percentage (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={editSettings.passingPercentage}
                onChange={(e) => setEditSettings({ ...editSettings, passingPercentage: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Prepared By</label>
              <input
                type="text"
                value={editSettings.preparedBy}
                onChange={(e) => setEditSettings({ ...editSettings, preparedBy: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Checked By</label>
              <input
                type="text"
                value={editSettings.checkedBy}
                onChange={(e) => setEditSettings({ ...editSettings, checkedBy: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Issue</label>
              <input
                type="date"
                value={editSettings.dateOfIssue}
                onChange={(e) => setEditSettings({ ...editSettings, dateOfIssue: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          {/* Subject Max Marks */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-navy-900">Subject Max Marks</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {editSettings.subjects.map((s, idx) => (
                <div key={s.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-navy-900">{s.code}</p>
                    <p className="text-xs text-slate-600 truncate">{s.name}</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={s.maxMarks}
                    onChange={(e) => {
                      const next = [...editSettings.subjects];
                      next[idx].maxMarks = Number(e.target.value);
                      setEditSettings({ ...editSettings, subjects: next });
                    }}
                    className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-lg font-semibold text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Grade Boundaries & Whitelist */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-navy-900">Custom Grade Boundaries</h3>
              {editSettings.gradeBoundaries.map((b, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={b.grade}
                    onChange={(e) => {
                      const next = [...editSettings.gradeBoundaries];
                      next[idx].grade = e.target.value.toUpperCase();
                      setEditSettings({ ...editSettings, gradeBoundaries: next });
                    }}
                    className="col-span-3 px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg"
                  />
                  <div className="col-span-4 flex items-center gap-1">
                    <span className="text-xs text-slate-500">≥</span>
                    <input
                      type="number"
                      value={b.minPercentage}
                      onChange={(e) => {
                        const next = [...editSettings.gradeBoundaries];
                        next[idx].minPercentage = Number(e.target.value);
                        setEditSettings({ ...editSettings, gradeBoundaries: next });
                      }}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <input
                    type="text"
                    value={b.label || ''}
                    onChange={(e) => {
                      const next = [...editSettings.gradeBoundaries];
                      next[idx].label = e.target.value;
                      setEditSettings({ ...editSettings, gradeBoundaries: next });
                    }}
                    className="col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditSettings({
                        ...editSettings,
                        gradeBoundaries: editSettings.gradeBoundaries.filter((_, i) => i !== idx),
                      })
                    }
                    className="col-span-1 text-rose-500 flex justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-bold text-navy-900 mb-1">Valid Enrollment Whitelist</label>
              <textarea
                rows={5}
                value={editSettings.whitelistText}
                onChange={(e) => setEditSettings({ ...editSettings, whitelistText: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-semibold text-sm shadow"
            >
              {busy ? 'Saving...' : 'Save Parameters & Sync All Portals'}
            </button>
          </div>
        </form>
      )}

      {/* TAB: IMMUTABLE AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-navy-900" />
            <div>
              <h2 className="text-base font-bold text-navy-900">Immutable Mark Manipulation Audit Logs</h2>
              <p className="text-xs text-slate-500">
                Chronological trace of every mark entry, manual edit, and bulk Excel import across classes.
              </p>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No mark entries or edits recorded yet.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-900 text-white uppercase">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Professor</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Student (Enrollment No.)</th>
                    <th className="px-4 py-3 text-center">Old Marks</th>
                    <th className="px-4 py-3 text-center">New Marks</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{log.professorName}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-navy-900">{log.subjectCode}</span> — {log.subjectName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold">{log.studentEnrollmentNo}</span> ({log.studentName})
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-500">
                        {log.oldMarks === null || log.oldMarks === undefined ? '—' : log.oldMarks}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-navy-900">{log.newMarks}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                          {log.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

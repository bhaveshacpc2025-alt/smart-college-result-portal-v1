import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  ScanLine,
  QrCode,
  FolderClock,
  Trophy,
  FileSpreadsheet,
  Edit3,
  Sparkles,
  Lock,
  CheckCircle2,
  Clock,
  Download,
  Save,
  X,
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import QrScannerModal from '../components/QrScannerModal';

function computeClientGrade(marks, maxMarks, passingPct, boundaries) {
  if (marks === '' || marks === null || marks === undefined) return { grade: '—', result: '—' };
  const val = Number(marks);
  if (!Number.isFinite(val)) return { grade: '—', result: '—' };
  const pct = (val / (maxMarks || 100)) * 100;
  const passed = pct + 1e-9 >= (passingPct ?? 40);
  const sorted = [...(boundaries || [])].sort((a, b) => b.minPercentage - a.minPercentage);
  const failGrade = sorted[sorted.length - 1]?.grade || 'FF';
  let grade = failGrade;
  if (passed) {
    const match = sorted.find((b) => pct + 1e-9 >= b.minPercentage);
    grade = match ? match.grade : failGrade;
  }
  return { grade, result: passed ? 'PASS' : 'FAIL' };
}

export default function ProfessorPortal({ workspaces, pendingRequests, onRefresh, initialInviteCode = '' }) {
  const [viewMode, setViewMode] = useState('active'); // 'active' | 'archive'
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [draftRows, setDraftRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const activeWorkspaces = workspaces.filter((w) => !w.classInfo.isDeployed && w.subject.status !== 'LOCKED');
  const archivedWorkspaces = workspaces.filter((w) => w.classInfo.isDeployed || w.subject.status === 'LOCKED');

  const displayedList = viewMode === 'archive' ? archivedWorkspaces : activeWorkspaces;
  const currentWorkspace =
    displayedList.find((w) => w.subject.id === selectedSubjectId) ||
    displayedList[0] ||
    workspaces[0] ||
    null;

  useEffect(() => {
    if (currentWorkspace) {
      setDraftRows(
        currentWorkspace.students.map((s) => ({
          ...s,
          marksDraft: s.marksObtained === '' || s.marksObtained === null ? '' : String(s.marksObtained),
          remarkDraft: s.aiRemark || '',
        }))
      );
    } else {
      setDraftRows([]);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (initialInviteCode) {
      handleLookupClass(initialInviteCode);
    }
  }, [initialInviteCode]);

  const handleLookupClass = async (code) => {
    setBusy(true);
    try {
      const data = await apiRequest(`/api/professor/classes/lookup?code=${encodeURIComponent(code)}`);
      setLookupResult(data);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRequestPermission = async (classId, subjectId) => {
    setBusy(true);
    try {
      await apiRequest('/api/professor/request-permission', {
        method: 'POST',
        body: JSON.stringify({ classId, subjectId }),
      });
      showToast('success', 'Subject permission request sent to HOD! You will be notified once approved.');
      await handleLookupClass(lookupResult.classInfo.inviteCode);
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  // Live Top-Right Class Topper computation reacting immediately as marks are typed!
  const liveTopper = useMemo(() => {
    if (!currentWorkspace) return null;
    const valid = draftRows
      .filter((r) => r.marksDraft !== '' && Number.isFinite(Number(r.marksDraft)))
      .map((r) => ({
        name: r.studentName,
        enrollmentNo: r.enrollmentNo,
        marksObtained: Number(r.marksDraft),
      }));
    if (valid.length === 0) return null;
    const best = valid.reduce((a, b) => (b.marksObtained > a.marksObtained ? b : a));
    return {
      ...best,
      maxMarks: currentWorkspace.subject.maxMarks,
      percentage: Number(((best.marksObtained / currentWorkspace.subject.maxMarks) * 100).toFixed(1)),
    };
  }, [draftRows, currentWorkspace]);

  const handleSaveMarks = async () => {
    if (!currentWorkspace) return;
    const entries = draftRows
      .filter((r) => r.marksDraft !== '')
      .map((r) => ({
        studentId: r.studentId,
        marksObtained: Number(r.marksDraft),
        aiRemark: r.remarkDraft,
        markVersion: r.markVersion,
      }));

    if (entries.length === 0) {
      showToast('error', 'Enter marks for at least one student before saving.');
      return;
    }

    setBusy(true);
    try {
      await apiRequest(`/api/professor/subjects/${currentWorkspace.subject.id}/marks`, {
        method: 'PUT',
        body: JSON.stringify({ entries, action: 'ENTRY' }),
      });
      showToast('success', 'Marks saved to database and logged in HOD Audit Logs.');
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAutoRemarks = async () => {
    if (!currentWorkspace) return;
    setBusy(true);
    try {
      // Save unsaved numeric marks first if any
      const unsaved = draftRows
        .filter((r) => r.marksDraft !== '')
        .map((r) => ({
          studentId: r.studentId,
          marksObtained: Number(r.marksDraft),
          aiRemark: r.remarkDraft,
          markVersion: r.markVersion,
        }));
      if (unsaved.length > 0) {
        await apiRequest(`/api/professor/subjects/${currentWorkspace.subject.id}/marks`, {
          method: 'PUT',
          body: JSON.stringify({ entries: unsaved, action: 'ENTRY' }),
        });
      }
      await apiRequest(`/api/professor/subjects/${currentWorkspace.subject.id}/auto-remarks`, {
        method: 'POST',
      });
      showToast('success', 'AI Auto-Remarks generated instantaneously for all graded students!');
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLockSubject = async () => {
    if (!currentWorkspace) return;
    setBusy(true);
    try {
      // Ensure latest draft marks are saved first
      const entries = draftRows
        .filter((r) => r.marksDraft !== '')
        .map((r) => ({
          studentId: r.studentId,
          marksObtained: Number(r.marksDraft),
          aiRemark: r.remarkDraft,
          markVersion: r.markVersion,
        }));
      if (entries.length > 0) {
        await apiRequest(`/api/professor/subjects/${currentWorkspace.subject.id}/marks`, {
          method: 'PUT',
          body: JSON.stringify({ entries, action: 'ENTRY' }),
        });
      }

      await apiRequest(`/api/professor/subjects/${currentWorkspace.subject.id}/lock`, {
        method: 'POST',
      });
      showToast(
        'success',
        `${currentWorkspace.subject.code} Locked & Submitted! HOD's Subject Lock Status Tracker updated.`
      );
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadSampleExcel = () => {
    if (!currentWorkspace) return;
    const rows = currentWorkspace.students.map((s) => ({
      'Enrollment No': s.enrollmentNo,
      'Student Name': s.studentName,
      'Marks Obtained': s.marksObtained !== '' ? s.marksObtained : 0,
    }));
    if (rows.length === 0) {
      rows.push({ 'Enrollment No': 'ENR2026001', 'Student Name': 'Sample Student', 'Marks Obtained': 85 });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, currentWorkspace.subject.code);
    XLSX.writeFile(wb, `${currentWorkspace.subject.code}_Marks_Template.xlsx`);
  };

  const handleUploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      const entries = [];
      for (const row of rows) {
        const keys = Object.keys(row);
        const enrKey = keys.find((k) => /enroll|roll|id/i.test(k));
        const markKey = keys.find((k) => /mark|score|obtained/i.test(k));
        if (!enrKey || !markKey) continue;
        const enrollmentNo = String(row[enrKey] || '').trim().toUpperCase();
        const marksObtained = Number(row[markKey]);
        if (enrollmentNo && Number.isFinite(marksObtained)) {
          const matchedRow = currentWorkspace.students.find((s) => s.enrollmentNo === enrollmentNo);
          entries.push({
            enrollmentNo,
            studentId: matchedRow?.studentId,
            marksObtained,
            markVersion: matchedRow?.markVersion ?? 0,
          });
        }
      }

      if (entries.length === 0) {
        throw new Error('No valid Enrollment No & Marks columns found in uploaded sheet.');
      }

      await apiRequest(`/api/professor/subjects/${currentWorkspace.subject.id}/marks`, {
        method: 'PUT',
        body: JSON.stringify({ entries, action: 'BULK_IMPORT' }),
      });
      showToast('success', `Bulk imported marks for ${entries.length} students from ${file.name}.`);
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

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
          <button type="button" onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow"
          >
            <ScanLine className="w-4 h-4 text-gold-300" />
            <QrCode className="w-4 h-4" />
            Join Class via QR
          </button>

          <button
            type="button"
            onClick={() => setViewMode('active')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 ${
              viewMode === 'active' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Active Subjects ({activeWorkspaces.length})
          </button>

          <button
            type="button"
            onClick={() => setViewMode('archive')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 ${
              viewMode === 'archive' ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FolderClock className="w-4 h-4" />
            Previous Classes Archive ({archivedWorkspaces.length})
          </button>
        </div>

        {displayedList.length > 0 && (
          <select
            value={currentWorkspace?.subject.id || ''}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl bg-white text-navy-900"
          >
            {displayedList.map((w) => (
              <option key={w.subject.id} value={w.subject.id}>
                {w.subject.code} — {w.subject.name} ({w.classInfo.className})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Class Lookup / Subject Selection Panel after QR / Invite Code */}
      {lookupResult && (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-md p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Class Found • {lookupResult.classInfo.inviteCode}
              </span>
              <h3 className="text-lg font-bold text-navy-900">{lookupResult.classInfo.className}</h3>
              <p className="text-xs text-slate-500">
                {lookupResult.classInfo.courseProgram} • {lookupResult.classInfo.semesterYear} • {lookupResult.classInfo.examMonthYear}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLookupResult(null)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lookupResult.subjects.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-navy-900 text-white">
                    {s.code}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 mt-1.5">{s.name}</h4>
                  <p className="text-xs text-slate-500">Max Marks: {s.maxMarks}</p>
                </div>

                {s.isAssignedToMe ? (
                  <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Approved &amp; Active
                  </span>
                ) : s.isAssignedToOther ? (
                  <span className="text-xs font-semibold text-slate-500">Assigned to another professor</span>
                ) : s.myPermissionStatus === 'PENDING' ? (
                  <span className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Pending HOD Approval
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRequestPermission(lookupResult.classInfo.id, s.id)}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                  >
                    Request Subject Permission
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Subject Requests Banner */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs text-amber-900">
            <strong>Pending / Recent Subject Requests:</strong>{' '}
            {pendingRequests
              .map((p) => `${p.subjectCode} (${p.className}) — ${p.status}`)
              .join(' | ')}
          </div>
        </div>
      )}

      {/* Empty Workspace State */}
      {!currentWorkspace && !lookupResult && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <QrCode className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {viewMode === 'archive' ? 'No Archived Subjects Yet' : 'Join a Class to Begin Grading'}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Scan your HOD&apos;s Class QR code or paste the Invite Code to claim your subject. Once approved by HOD, your student roster and Excel grading sheet unlock here.
          </p>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-semibold text-sm shadow"
          >
            <ScanLine className="w-4 h-4" />
            Join Class via QR / Code
          </button>
        </div>
      )}

      {/* Main Marks Entry & Top-Right Class Topper Workspace */}
      {currentWorkspace && (
        <div className="space-y-5">
          {/* Header + Pinned Top-Right Class Topper Widget */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-navy-900 text-white">
                      {currentWorkspace.subject.code}
                    </span>
                    <h2 className="text-xl font-bold text-navy-900">{currentWorkspace.subject.name}</h2>
                    {currentWorkspace.subject.status === 'LOCKED' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Locked &amp; Submitted
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentWorkspace.classInfo.className} • {currentWorkspace.classInfo.semesterYear} • Max Marks:{' '}
                    <strong>{currentWorkspace.subject.maxMarks}</strong> • Pass Threshold:{' '}
                    <strong>{currentWorkspace.classInfo.passingPercentage}%</strong>
                  </p>
                </div>
              </div>

              {/* Workspace Tools Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  Upload Excel / Bulk Import
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadExcel} />
                </label>

                <button
                  type="button"
                  onClick={handleDownloadSampleExcel}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Sample Excel Template
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAutoRemarks}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  AI Auto-Remarks
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveMarks}
                  className="px-3.5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {currentWorkspace.subject.status === 'LOCKED' ? 'Save Authorized Edit' : 'Save Marks'}
                </button>

                {currentWorkspace.subject.status !== 'LOCKED' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleLockSubject}
                    className="ml-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow"
                  >
                    <Lock className="w-4 h-4" />
                    Lock &amp; Submit Subject Marks
                  </button>
                )}
              </div>
            </div>

            {/* TOP-RIGHT CLASS TOPPER WIDGET */}
            <div className="lg:col-span-4 bg-gradient-to-br from-navy-900 to-navy-800 text-white rounded-2xl border-2 border-gold-500/60 shadow-lg p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gold-300">
                  Live Class Topper
                </span>
                <div className="w-9 h-9 rounded-xl bg-gold-500/20 border border-gold-300/40 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-gold-300" />
                </div>
              </div>
              {liveTopper ? (
                <div className="mt-3">
                  <p className="text-lg font-extrabold truncate">{liveTopper.name}</p>
                  <p className="text-xs font-mono text-slate-300">{liveTopper.enrollmentNo}</p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gold-300">{liveTopper.marksObtained}</span>
                    <span className="text-xs text-slate-300">
                      / {liveTopper.maxMarks} ({liveTopper.percentage}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-xs text-slate-300">
                  Enter or import student marks to view the live Class Topper automatically.
                </div>
              )}
            </div>
          </div>

          {/* Interactive Spreadsheet Marks Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {draftRows.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No HOD-approved students in this class yet. Once HOD accepts student enrollment requests, they appear here automatically.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-navy-900 text-white text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3">Enrollment No.</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3 w-36">
                        Marks (/{currentWorkspace.subject.maxMarks})
                      </th>
                      <th className="px-4 py-3 text-center w-24">Grade</th>
                      <th className="px-4 py-3 text-center w-24">Status</th>
                      <th className="px-4 py-3">AI Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draftRows.map((row, idx) => {
                      const calc = computeClientGrade(
                        row.marksDraft,
                        currentWorkspace.subject.maxMarks,
                        currentWorkspace.classInfo.passingPercentage,
                        currentWorkspace.classInfo.gradeBoundaries
                      );
                      return (
                        <tr key={row.studentId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-navy-900">
                            {row.enrollmentNo}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{row.studentName}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              min={0}
                              max={currentWorkspace.subject.maxMarks}
                              step="0.5"
                              value={row.marksDraft}
                              onChange={(e) => {
                                const next = [...draftRows];
                                next[idx].marksDraft = e.target.value;
                                setDraftRows(next);
                              }}
                              placeholder="0"
                              className="w-28 px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-navy-700 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-navy-900">{calc.grade}</td>
                          <td className="px-4 py-3 text-center">
                            {calc.result !== '—' ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  calc.result === 'PASS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {calc.result}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              value={row.remarkDraft}
                              onChange={(e) => {
                                const next = [...draftRows];
                                next[idx].remarkDraft = e.target.value;
                                setDraftRows(next);
                              }}
                              placeholder="Click 'AI Auto-Remarks' or type custom remark..."
                              className="w-full min-w-[260px] px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCodeDetected={handleLookupClass}
        title="Join Class via QR / Invite Code"
      />
    </div>
  );
}

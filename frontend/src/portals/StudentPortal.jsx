import React, { useState, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import {
  Layers,
  CalendarRange,
  QrCode,
  PlusSquare,
  Clock,
  FileText,
  Award,
  Download,
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Target,
  X,
  ArrowLeft,
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import QrScannerModal from '../components/QrScannerModal';
import OfficialReportCard from '../components/OfficialReportCard';

export default function StudentPortal({ dashboard, onRefresh, initialInviteCode = '' }) {
  const [activeTab, setActiveTab] = useState('classes'); // 'classes' | 'report' | 'insights'
  const [selectedClassId, setSelectedClassId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [toast, setToast] = useState(null);
  const reportCardRef = useRef(null);

  const classes = dashboard?.classes || [];
  const insights = dashboard?.insights || null;

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (initialInviteCode) {
      handleJoinClass(initialInviteCode);
    }
  }, [initialInviteCode]);

  const handleJoinClass = async (inviteCode) => {
    setBusy(true);
    try {
      const data = await apiRequest('/api/student/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });
      showToast(
        'success',
        `Enrollment request sent for ${data.enrollment.className}! Waiting for HOD approval.`
      );
      await onRefresh();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectedClass = classes.find((c) => c.classId === selectedClassId) || classes.find((c) => c.reportCard) || null;

  const handleOpenReportCard = (cls) => {
    setSelectedClassId(cls.classId);
    setActiveTab('report');
  };

  const handleDownloadPdf = async () => {
    if (!reportCardRef.current || !selectedClass?.reportCard) return;
    setDownloadingPdf(true);
    try {
      const safeName = `${selectedClass.reportCard.student.enrollmentNo}_${selectedClass.className}`
        .replace(/[^a-zA-Z0-9_-]+/g, '_');
      await html2pdf()
        .set({
          margin: [4, 4, 4, 4],
          filename: `Result_${safeName}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fdfaf0' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all'] },
        })
        .from(reportCardRef.current)
        .save();
    } catch (err) {
      showToast('error', `PDF generation failed: ${err.message}`);
    } finally {
      setDownloadingPdf(false);
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

      {/* Top Student Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 ${
              activeTab === 'classes' ? 'bg-navy-900 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Semesters / Classes ({classes.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 ${
              activeTab === 'insights' ? 'bg-indigo-700 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BrainCircuit className="w-4 h-4" />
            AI Performance &amp; Weak-Area Insight
          </button>

          {selectedClass?.reportCard && (
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                activeTab === 'report' ? 'bg-amber-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Award className="w-4 h-4" />
              Official Report Card
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => setScannerOpen(true)}
          className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow"
        >
          <PlusSquare className="w-4 h-4 text-gold-300" />
          <QrCode className="w-4 h-4" />
          Add New Class (Scan QR)
        </button>
      </div>

      {/* TAB: CLASSES / SEMESTERS FOLDER GRID */}
      {activeTab === 'classes' && (
        <>
          {classes.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <QrCode className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Join Your First Class / Semester</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Scan your class QR code or paste the Invite Code shared by your HOD. Your private academic transcript will unlock here as soon as all subjects are finalized and deployed.
              </p>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-semibold text-sm shadow"
              >
                <PlusSquare className="w-4 h-4" />
                Add New Class (Scan QR)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {classes.map((cls) => {
                const isDeployed = cls.enrollmentStatus === 'APPROVED' && cls.isDeployed;
                const isPendingHod = cls.enrollmentStatus === 'PENDING';
                const isRejected = cls.enrollmentStatus === 'REJECTED';

                return (
                  <div
                    key={cls.enrollmentId}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-10 h-10 rounded-xl bg-navy-900/10 text-navy-900 flex items-center justify-center shrink-0">
                          <CalendarRange className="w-5 h-5" />
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                            isDeployed
                              ? 'bg-emerald-100 text-emerald-800'
                              : isRejected
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isDeployed ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {isDeployed
                            ? 'Result Deployed'
                            : isRejected
                            ? 'Rejected'
                            : isPendingHod
                            ? 'Pending HOD Verification'
                            : 'Awaiting Result Deployment'}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-base text-navy-900">{cls.className}</h3>
                        <p className="text-xs text-slate-600 mt-0.5">{cls.courseProgram}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {cls.semesterYear} • {cls.examMonthYear}
                        </p>
                      </div>

                      {!isDeployed && cls.enrollmentStatus === 'APPROVED' && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                            <span>Subjects Locked by Faculty</span>
                            <span>
                              {cls.lockedSubjectsCount} / {cls.totalSubjectsCount}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-navy-900 transition-all duration-300"
                              style={{
                                width: `${
                                  cls.totalSubjectsCount > 0
                                    ? Math.round((cls.lockedSubjectsCount / cls.totalSubjectsCount) * 100)
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {cls.statusLabel}
                          </p>
                        </div>
                      )}

                      {isDeployed && cls.reportCard && (
                        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-slate-600">Score: </span>
                            <strong className="text-navy-900">
                              {cls.reportCard.summary.totalObtained}/{cls.reportCard.summary.totalMax} (
                              {cls.reportCard.summary.overallPercentage}%)
                            </strong>
                          </div>
                          <span
                            className={`font-extrabold ${
                              cls.reportCard.summary.resultStatus === 'PASS'
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {cls.reportCard.summary.resultStatus}
                          </span>
                        </div>
                      )}
                    </div>

                    {isDeployed && cls.reportCard ? (
                      <button
                        type="button"
                        onClick={() => handleOpenReportCard(cls)}
                        className="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                      >
                        <FileText className="w-4 h-4 text-gold-300" />
                        View Official Report Card
                      </button>
                    ) : (
                      <div className="py-2 px-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-medium text-center">
                        {isPendingHod
                          ? 'Waiting for HOD to accept enrollment'
                          : isRejected
                          ? 'Contact HOD regarding whitelist'
                          : 'Report card unlocks upon HOD deployment'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB: OFFICIAL REPORT CARD + PDF EXPORT */}
      {activeTab === 'report' && selectedClass?.reportCard && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('classes')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Classes
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={handleDownloadPdf}
                className="px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow"
              >
                <Download className="w-4 h-4 text-gold-300" />
                {downloadingPdf ? 'Generating A4 PDF...' : 'Download PDF Report Card'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto py-4 bg-slate-200/70 rounded-2xl border border-slate-300">
            <OfficialReportCard reportCard={selectedClass.reportCard} cardRef={reportCardRef} />
          </div>
        </div>
      )}

      {/* TAB: AI PERFORMANCE & WEAK-AREA INSIGHT */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {!insights || insights.totalEvaluatedClasses === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
              <BrainCircuit className="w-12 h-12 text-indigo-600 mx-auto" />
              <h3 className="text-lg font-bold text-navy-900">AI Insights Unlock After Result Deployment</h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Once your HOD deploys final results for at least one class/semester, this analytical engine compares your marks against cohort averages and calculates target scores.
              </p>
            </div>
          ) : (
            <>
              {/* Top Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Cumulative Percentage</p>
                  <p className="text-3xl font-black text-navy-900 mt-1">{insights.overallPercentage}%</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Across {insights.totalEvaluatedClasses} deployed semester(s)
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Estimated CGPA (10-pt)</p>
                  <p className="text-3xl font-black text-indigo-700 mt-1">{insights.overallCgpa}</p>
                  <p className="text-xs text-slate-500 mt-1">Normalized across deployed transcripts</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Priority Focus Subjects</p>
                  <p className="text-3xl font-black text-amber-600 mt-1">{insights.weakAreas.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Subjects below 60% or trailing cohort average</p>
                </div>
              </div>

              {/* Target Recommendations */}
              {insights.targetRecommendations.map((rec, i) => (
                <div key={i} className="bg-gradient-to-r from-navy-900 to-indigo-900 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-300">
                      <Target className="w-4 h-4" />
                      Next Academic Milestone: {rec.milestone}
                    </div>
                    <p className="text-sm text-slate-100 leading-relaxed">{rec.guidance}</p>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weak Subjects & Exact Target Scores */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h3 className="text-base font-bold text-navy-900">Weak Areas &amp; Score Gap Analysis</h3>
                  </div>
                  {insights.weakAreas.length === 0 ? (
                    <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
                      Great work! You have no failing or lagging subjects compared to cohort averages.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insights.weakAreas.map((w, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-mono text-xs font-bold text-navy-900">{w.subjectCode}</span>{' '}
                              <span className="font-bold text-sm text-slate-900">{w.subjectName}</span>
                              <p className="text-[11px] text-slate-500">{w.semesterYear}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                w.severity === 'CRITICAL'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {w.percentage}% ({w.grade})
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[11px] bg-white p-2 rounded-lg border border-slate-200">
                            <div>
                              <span className="text-slate-500">Your Score:</span>{' '}
                              <strong>
                                {w.marksObtained}/{w.maxMarks}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Class Avg:</span>{' '}
                              <strong>{w.classAveragePercentage}%</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Gap:</span>{' '}
                              <strong className={w.gapFromAvg < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                {w.gapFromAvg > 0 ? `+${w.gapFromAvg}%` : `${w.gapFromAvg}%`}
                              </strong>
                            </div>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">{w.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Strongest Subjects */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-base font-bold text-navy-900">Top Performing Subjects</h3>
                  </div>
                  {insights.strengths.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">
                      Score 75%+ in any subject to highlight your strongest academic areas here.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {insights.strengths.map((s, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono text-xs font-bold text-navy-900">{s.subjectCode}</span>{' '}
                              <span className="font-bold text-sm text-slate-900">{s.subjectName}</span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                              {s.percentage}% ({s.grade})
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-emerald-100 overflow-hidden">
                            <div
                              className="h-full bg-emerald-600"
                              style={{ width: `${Math.min(100, s.percentage)}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-600">
                            {s.gapFromAvg >= 0
                              ? `+${s.gapFromAvg}% above cohort average (${s.classAveragePercentage}%)`
                              : `Cohort average: ${s.classAveragePercentage}%`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCodeDetected={handleJoinClass}
        title="Add New Class (Scan QR or Enter Invite Code)"
      />
    </div>
  );
}

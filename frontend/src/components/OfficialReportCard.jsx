import React from 'react';

/**
 * Official Academic Report Card matching the traditional navy & gold double-corner-framed
 * parchment certificate blueprint. Uses explicit hex colors so html2pdf.js / html2canvas
 * renders a clean, single-page A4 PDF without CSS color parsing errors.
 */
export default function OfficialReportCard({ reportCard, cardRef }) {
  if (!reportCard) return null;
  const { student, classInfo, subjects, summary } = reportCard;

  const remarksWithText = subjects.filter((s) => s.aiRemark && s.aiRemark.trim().length > 0);

  return (
    <div
      ref={cardRef}
      style={{
        width: '790px',
        minHeight: '1080px',
        backgroundColor: '#fdfaf0',
        color: '#111827',
        fontFamily: 'Georgia, "Times New Roman", serif',
        position: 'relative',
        padding: '22px',
        boxSizing: 'border-box',
        margin: '0 auto',
      }}
    >
      {/* Ornate Navy & Gold Double-Corner Certificate Border Frame */}
      <div
        style={{
          position: 'relative',
          border: '4px solid #142a52',
          backgroundColor: '#fdfaf0',
          padding: '6px',
          minHeight: '1036px',
          boxSizing: 'border-box',
        }}
      >
        {/* Gold Inner Frame */}
        <div
          style={{
            position: 'relative',
            border: '2px solid #b8912e',
            padding: '26px 30px 24px 30px',
            minHeight: '1016px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Decorative Corner Brackets (SVG overlays matching blueprint) */}
          <svg
            width="92"
            height="92"
            viewBox="0 0 92 92"
            style={{ position: 'absolute', top: '-4px', left: '-4px', pointerEvents: 'none' }}
          >
            <polygon points="0,0 92,0 64,22 22,22 22,64 0,92" fill="#142a52" />
            <polygon points="0,0 78,0 58,15 15,15 15,58 0,78" fill="none" stroke="#c8a243" strokeWidth="2.5" />
          </svg>
          <svg
            width="92"
            height="92"
            viewBox="0 0 92 92"
            style={{ position: 'absolute', top: '-4px', right: '-4px', transform: 'scaleX(-1)', pointerEvents: 'none' }}
          >
            <polygon points="0,0 92,0 64,22 22,22 22,64 0,92" fill="#142a52" />
            <polygon points="0,0 78,0 58,15 15,15 15,58 0,78" fill="none" stroke="#c8a243" strokeWidth="2.5" />
          </svg>
          <svg
            width="92"
            height="92"
            viewBox="0 0 92 92"
            style={{ position: 'absolute', bottom: '-4px', left: '-4px', transform: 'scaleY(-1)', pointerEvents: 'none' }}
          >
            <polygon points="0,0 92,0 64,22 22,22 22,64 0,92" fill="#142a52" />
            <polygon points="0,0 78,0 58,15 15,15 15,58 0,78" fill="none" stroke="#c8a243" strokeWidth="2.5" />
          </svg>
          <svg
            width="92"
            height="92"
            viewBox="0 0 92 92"
            style={{ position: 'absolute', bottom: '-4px', right: '-4px', transform: 'scale(-1,-1)', pointerEvents: 'none' }}
          >
            <polygon points="0,0 92,0 64,22 22,22 22,64 0,92" fill="#142a52" />
            <polygon points="0,0 78,0 58,15 15,15 15,58 0,78" fill="none" stroke="#c8a243" strokeWidth="2.5" />
          </svg>

          <div>
            {/* Top Header: Left Academic Gold-and-Navy Ribbon Seal + Bold RESULT Title */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                paddingTop: '6px',
                paddingBottom: '14px',
              }}
            >
              {/* Gold & Navy Emblem Seal with Ribbon */}
              <div style={{ position: 'absolute', left: '16px', top: '0px' }}>
                <svg width="78" height="96" viewBox="0 0 78 96">
                  {/* Ribbons */}
                  <polygon points="24,62 14,93 26,85 35,93 38,65" fill="#142a52" stroke="#c8a243" strokeWidth="1.5" />
                  <polygon points="54,62 64,93 52,85 43,93 40,65" fill="#142a52" stroke="#c8a243" strokeWidth="1.5" />
                  {/* Scalloped Outer Gold Ring */}
                  <circle cx="39" cy="37" r="31" fill="#c8a243" stroke="#8f6d1b" strokeWidth="2" />
                  <circle cx="39" cy="37" r="25" fill="#142a52" stroke="#f0d98c" strokeWidth="1.5" />
                  <circle cx="39" cy="37" r="19" fill="none" stroke="#c8a243" strokeWidth="1" strokeDasharray="2 2" />
                  {/* Open Book Emblem */}
                  <path
                    d="M27,32 Q33,29 39,33 Q45,29 51,32 L51,44 Q45,41 39,45 Q33,41 27,44 Z"
                    fill="#f8e8b0"
                    stroke="#c8a243"
                    strokeWidth="1"
                  />
                  <line x1="39" y1="33" x2="39" y2="45" stroke="#142a52" strokeWidth="1.2" />
                </svg>
              </div>

              <div style={{ textAlign: 'center', paddingLeft: '36px' }}>
                <div
                  style={{
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    fontSize: '42px',
                    fontWeight: '900',
                    color: '#142a52',
                    letterSpacing: '4px',
                    lineHeight: '1.05',
                  }}
                >
                  RESULT
                </div>
                <div
                  style={{
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    color: '#1e293b',
                    letterSpacing: '1.3px',
                    marginTop: '4px',
                  }}
                >
                  STATEMENT OF MARKS / ACADEMIC TRANSCRIPT
                </div>
              </div>
            </div>

            {/* Navy Banner: STUDENT DETAILS */}
            <div
              style={{
                backgroundColor: '#142a52',
                color: '#ffffff',
                textAlign: 'center',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontWeight: '700',
                fontSize: '13px',
                letterSpacing: '1.5px',
                padding: '6px 12px',
                marginTop: '8px',
                marginBottom: '14px',
              }}
            >
              STUDENT DETAILS
            </div>

            {/* Underlined Student Details Grid */}
            <div
              style={{
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '12.5px',
                color: '#1e293b',
                display: 'grid',
                gridTemplateColumns: '1.15fr 0.85fr',
                rowGap: '10px',
                columnGap: '24px',
                marginBottom: '18px',
                padding: '0 4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Student Name:</span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1.5px solid #334155',
                    paddingBottom: '2px',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  {student.name}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Enrollment No.:</span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1.5px solid #334155',
                    paddingBottom: '2px',
                    fontWeight: '700',
                    color: '#142a52',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                  }}
                >
                  {student.enrollmentNo}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Course / Program:</span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1.5px solid #334155',
                    paddingBottom: '2px',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  {classInfo.courseProgram}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Semester / Year:</span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1.5px solid #334155',
                    paddingBottom: '2px',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  {classInfo.semesterYear}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', gridColumn: 'span 2' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Examination Month &amp; Year:</span>
                <span
                  style={{
                    minWidth: '220px',
                    borderBottom: '1.5px solid #334155',
                    paddingBottom: '2px',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  {classInfo.examMonthYear}
                </span>
              </div>
            </div>

            {/* Subject Marks Table */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#142a52', color: '#ffffff' }}>
                  <th style={{ border: '1.5px solid #142a52', padding: '8px 6px', width: '13%', textAlign: 'center' }}>
                    Subject Code
                  </th>
                  <th style={{ border: '1.5px solid #142a52', padding: '8px 10px', width: '43%', textAlign: 'center' }}>
                    Subject Name
                  </th>
                  <th style={{ border: '1.5px solid #142a52', padding: '8px 6px', width: '11%', textAlign: 'center' }}>
                    Max Marks
                  </th>
                  <th style={{ border: '1.5px solid #142a52', padding: '8px 6px', width: '13%', textAlign: 'center' }}>
                    Marks Obtained
                  </th>
                  <th style={{ border: '1.5px solid #142a52', padding: '8px 6px', width: '9%', textAlign: 'center' }}>
                    Grade
                  </th>
                  <th style={{ border: '1.5px solid #142a52', padding: '8px 6px', width: '11%', textAlign: 'center' }}>
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subj, idx) => (
                  <tr
                    key={subj.subjectId || idx}
                    style={{ backgroundColor: idx % 2 === 0 ? '#fdfaf0' : '#f7f3e4' }}
                  >
                    <td
                      style={{
                        border: '1px solid #1e293b',
                        padding: '8px 6px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#142a52',
                      }}
                    >
                      {subj.code}
                    </td>
                    <td style={{ border: '1px solid #1e293b', padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>
                      {subj.name}
                    </td>
                    <td style={{ border: '1px solid #1e293b', padding: '8px 6px', textAlign: 'center' }}>
                      {subj.maxMarks}
                    </td>
                    <td style={{ border: '1px solid #1e293b', padding: '8px 6px', textAlign: 'center', fontWeight: '700' }}>
                      {subj.marksObtained}
                    </td>
                    <td
                      style={{
                        border: '1px solid #1e293b',
                        padding: '8px 6px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#142a52',
                      }}
                    >
                      {subj.grade}
                    </td>
                    <td
                      style={{
                        border: '1px solid #1e293b',
                        padding: '8px 6px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: subj.passed ? '#166534' : '#b91c1c',
                      }}
                    >
                      {subj.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Navy Banner: SUMMARY */}
            <div
              style={{
                backgroundColor: '#142a52',
                color: '#ffffff',
                textAlign: 'center',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontWeight: '700',
                fontSize: '13px',
                letterSpacing: '1.5px',
                padding: '6px 12px',
                marginBottom: '12px',
              }}
            >
              SUMMARY
            </div>

            <div
              style={{
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '12.5px',
                color: '#1e293b',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '12px',
                padding: '0 4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', maxWidth: '340px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Grand Total:</span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1.5px solid #334155',
                    paddingBottom: '2px',
                    fontWeight: '700',
                    color: '#142a52',
                  }}
                >
                  {summary.totalObtained} / {summary.totalMax}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', maxWidth: '340px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Percentage / CGPA:</span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1.5px solid #334155',
                    paddingBottom: '2px',
                    fontWeight: '700',
                    color: '#142a52',
                  }}
                >
                  {summary.overallPercentage}% / {summary.cgpa} CGPA
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', maxWidth: '340px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Result Status:</span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1.5px solid #334155',
                    paddingBottom: '2px',
                    fontWeight: '800',
                    color: summary.resultStatus === 'PASS' ? '#166534' : '#b91c1c',
                  }}
                >
                  {summary.resultStatus} (Min Passing: {classInfo.passingPercentage}%)
                </span>
              </div>
            </div>

            {/* AI Remarks & Behavioral Evaluation Note */}
            <div
              style={{
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8f5e8',
                padding: '10px 12px',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '11px',
                lineHeight: '1.45',
                color: '#334155',
              }}
            >
              <div style={{ fontWeight: '700', color: '#142a52', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                AI Remarks &amp; Behavioral Evaluation
              </div>
              {remarksWithText.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {remarksWithText.slice(0, 4).map((s) => (
                    <div key={s.subjectId}>
                      <strong style={{ color: '#142a52' }}>{s.code}:</strong> {s.aiRemark}
                    </div>
                  ))}
                  {remarksWithText.length > 4 && (
                    <div style={{ color: '#64748b', fontStyle: 'italic' }}>
                      + {remarksWithText.length - 4} additional subject evaluations recorded in portal.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  Overall academic standing: <strong>{summary.overallPercentage}%</strong> ({summary.resultStatus}). Passed{' '}
                  {summary.passedSubjectsCount} of {summary.totalSubjectsCount} registered subjects.
                </div>
              )}
            </div>
          </div>

          {/* Footer Signature Block with Central Circular Grey Stamp Seal */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              paddingTop: '18px',
              paddingLeft: '4px',
              paddingRight: '4px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '12px',
              color: '#1e293b',
            }}
          >
            {/* Left Signatories */}
            <div style={{ width: '240px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Prepared By:</span>
                <span style={{ flex: 1, borderBottom: '1.5px solid #334155', paddingBottom: '2px', fontWeight: '600' }}>
                  {classInfo.preparedBy || 'Examination Cell'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Checked By:</span>
                <span style={{ flex: 1, borderBottom: '1.5px solid #334155', paddingBottom: '2px', fontWeight: '600' }}>
                  {classInfo.checkedBy || 'HOD Verification'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Date of Issue:</span>
                <span style={{ flex: 1, borderBottom: '1.5px solid #334155', paddingBottom: '2px', fontWeight: '600' }}>
                  {classInfo.dateOfIssue || (classInfo.deployedAt ? String(classInfo.deployedAt).slice(0, 10) : new Date().toISOString().slice(0, 10))}
                </span>
              </div>
            </div>

            {/* Central Circular Grey Embossed Stamp Seal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="96" height="96" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="#d1d5db" stroke="#6b7280" strokeWidth="2.5" strokeDasharray="3 2" />
                <circle cx="50" cy="50" r="37" fill="#9ca3af" stroke="#4b5563" strokeWidth="1.5" />
                <circle cx="50" cy="50" r="28" fill="#e5e7eb" stroke="#6b7280" strokeWidth="1" />
                <text x="50" y="47" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#374151" fontFamily="Arial">
                  VERIFIED
                </text>
                <text x="50" y="57" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#4b5563" fontFamily="Arial">
                  OFFICIAL SEAL
                </text>
              </svg>
            </div>

            {/* Right Signatory */}
            <div style={{ width: '215px', textAlign: 'center', paddingBottom: '4px' }}>
              <div
                style={{
                  borderBottom: '1.5px solid #1e293b',
                  height: '28px',
                  marginBottom: '6px',
                  fontFamily: 'Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: '15px',
                  color: '#142a52',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: '2px',
                }}
              >
                Sd/- Controller
              </div>
              <div style={{ fontWeight: '700', fontSize: '12px', color: '#142a52' }}>
                {classInfo.controllerTitle || 'Controller of Examinations'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

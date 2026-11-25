export const DEFAULT_GRADE_BOUNDARIES = [
  { grade: 'AA', minPercentage: 85, label: 'Outstanding' },
  { grade: 'AB', minPercentage: 75, label: 'Excellent' },
  { grade: 'BB', minPercentage: 65, label: 'Very Good' },
  { grade: 'BC', minPercentage: 55, label: 'Good' },
  { grade: 'CC', minPercentage: 40, label: 'Satisfactory' },
  { grade: 'FF', minPercentage: 0, label: 'Fail' },
];

export function normalizeGradeBoundaries(boundaries) {
  if (!Array.isArray(boundaries) || boundaries.length === 0) {
    return DEFAULT_GRADE_BOUNDARIES;
  }
  return boundaries
    .map((b) => ({
      grade: String(b.grade || '').trim().toUpperCase(),
      minPercentage: Number(b.minPercentage ?? 0),
      label: String(b.label || '').trim(),
    }))
    .filter((b) => b.grade.length > 0 && Number.isFinite(b.minPercentage))
    .sort((a, b) => b.minPercentage - a.minPercentage);
}

export function calculateSubjectResult(marksObtained, maxMarks, passingPercentage, gradeBoundaries) {
  const safeMax = Number(maxMarks) > 0 ? Number(maxMarks) : 100;
  const safeMarks = Number(marksObtained ?? 0);
  const pct = (safeMarks / safeMax) * 100;
  const passThreshold = Number(passingPercentage ?? 40);
  const passed = pct + 1e-9 >= passThreshold;

  const sorted = normalizeGradeBoundaries(gradeBoundaries);
  const failGrade = sorted[sorted.length - 1]?.grade || 'FF';

  let grade = failGrade;
  if (passed) {
    const matched = sorted.find((b) => pct + 1e-9 >= b.minPercentage);
    grade = matched ? matched.grade : failGrade;
    // Guard against custom boundary table where a passing percentage hits the lowest fail grade
    if (grade === failGrade && sorted.length > 1 && pct + 1e-9 >= passThreshold) {
      const aboveZero = sorted.filter((b) => b.minPercentage > 0);
      if (aboveZero.length > 0) {
        const fallbackPass = aboveZero.find((b) => pct + 1e-9 >= b.minPercentage) || aboveZero[aboveZero.length - 1];
        grade = fallbackPass.grade;
      }
    }
  }

  return {
    percentage: Number(pct.toFixed(2)),
    grade,
    result: passed ? 'PASS' : 'FAIL',
    passed,
  };
}

export function computeOverallSummary(subjectRows, passingPercentage, gradeBoundaries) {
  const totalMax = subjectRows.reduce((acc, s) => acc + Number(s.maxMarks || 0), 0);
  const totalObtained = subjectRows.reduce((acc, s) => acc + Number(s.marksObtained || 0), 0);
  const overallPercentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
  const cgpa = Number(Math.min(10, overallPercentage / 10).toFixed(2));
  const allSubjectsPassed = subjectRows.length > 0 && subjectRows.every((s) => s.passed);
  const overallPassed =
    allSubjectsPassed && overallPercentage + 1e-9 >= Number(passingPercentage ?? 40);

  const overallGradeCalc = calculateSubjectResult(
    totalObtained,
    totalMax || 100,
    passingPercentage,
    gradeBoundaries
  );

  return {
    totalObtained: Number(totalObtained.toFixed(2)),
    totalMax,
    overallPercentage,
    cgpa,
    overallGrade: overallPassed ? overallGradeCalc.grade : (normalizeGradeBoundaries(gradeBoundaries).at(-1)?.grade || 'FF'),
    resultStatus: overallPassed ? 'PASS' : 'FAIL',
    passedSubjectsCount: subjectRows.filter((s) => s.passed).length,
    totalSubjectsCount: subjectRows.length,
  };
}

export function generateDeterministicRemark({
  studentName,
  subjectName,
  marksObtained,
  maxMarks,
  classAverage,
  topperMarks,
  passingPercentage,
}) {
  const safeMax = Number(maxMarks) > 0 ? Number(maxMarks) : 100;
  const marks = Number(marksObtained ?? 0);
  const pct = (marks / safeMax) * 100;
  const avg = Number(classAverage ?? marks);
  const topper = Number(topperMarks ?? marks);
  const passPct = Number(passingPercentage ?? 40);
  const firstName = String(studentName || 'Student').trim().split(/\s+/)[0];
  const deltaFromAvg = Number((marks - avg).toFixed(1));
  const gapFromTopper = Number((topper - marks).toFixed(1));

  if (marks === topper && pct >= 85) {
    return `Exemplary mastery in ${subjectName}! ${firstName} leads the cohort (${pct.toFixed(1)}%), demonstrating strong analytical rigor and consistent academic discipline.`;
  }
  if (pct >= 85) {
    return `Distinction-level performance in ${subjectName} (${pct.toFixed(1)}%, +${Math.max(0, deltaFromAvg)} vs. class avg). Keep refining edge-case problem solving to challenge the top rank (gap: ${gapFromTopper} marks).`;
  }
  if (pct >= 75) {
    return `Commendable command over ${subjectName} (${pct.toFixed(1)}%). Performs confidently ${deltaFromAvg >= 0 ? `${deltaFromAvg} marks above` : `${Math.abs(deltaFromAvg)} marks below`} class average; targeted revision can push into the 85%+ distinction tier.`;
  }
  if (pct >= 60) {
    return `Solid grasp of core ${subjectName} concepts (${pct.toFixed(1)}%). ${deltaFromAvg >= 0 ? 'Tracking above cohort average' : `Trailing class average by ${Math.abs(deltaFromAvg)} marks`}; structured practice on high-weightage modules will elevate consistency.`;
  }
  if (pct >= passPct) {
    return `Satisfactory pass in ${subjectName} (${pct.toFixed(1)}%), ${deltaFromAvg >= 0 ? 'aligned with' : `${Math.abs(deltaFromAvg)} marks below`} the cohort mean. Recommend regular problem-solving drills and doubt-clearing sessions to build stronger margin above passing criteria.`;
  }
  const passMarksNeeded = Math.ceil((passPct / 100) * safeMax);
  const deficit = Math.max(1, Number((passMarksNeeded - marks).toFixed(1)));
  return `Needs focused academic intervention in ${subjectName} (${pct.toFixed(1)}%, ${deficit} marks short of ${passPct}% passing benchmark). Prioritize foundational concepts, guided tutorials, and weekly mock assessments.`;
}

export function generateStudentInsights(classReports) {
  if (!Array.isArray(classReports) || classReports.length === 0) {
    return {
      overallCgpa: 0,
      overallPercentage: 0,
      totalEvaluatedClasses: 0,
      weakAreas: [],
      strengths: [],
      targetRecommendations: [],
      semesterTrend: [],
    };
  }

  const allSubjects = [];
  const semesterTrend = [];

  for (const report of classReports) {
    semesterTrend.push({
      classId: report.classInfo.id,
      className: report.classInfo.className,
      semesterYear: report.classInfo.semesterYear,
      examMonthYear: report.classInfo.examMonthYear,
      percentage: report.summary.overallPercentage,
      cgpa: report.summary.cgpa,
      resultStatus: report.summary.resultStatus,
    });

    for (const subj of report.subjects) {
      const gapFromAvg = Number((subj.percentage - (subj.classAveragePercentage ?? subj.percentage)).toFixed(2));
      allSubjects.push({
        className: report.classInfo.className,
        semesterYear: report.classInfo.semesterYear,
        subjectCode: subj.code,
        subjectName: subj.name,
        marksObtained: subj.marksObtained,
        maxMarks: subj.maxMarks,
        percentage: subj.percentage,
        grade: subj.grade,
        passed: subj.passed,
        passingPercentage: report.classInfo.passingPercentage,
        classAveragePercentage: subj.classAveragePercentage ?? subj.percentage,
        classTopperPercentage: subj.classTopperPercentage ?? subj.percentage,
        gapFromAvg,
      });
    }
  }

  const avgPct = Number(
    (
      classReports.reduce((acc, r) => acc + r.summary.overallPercentage, 0) /
      classReports.length
    ).toFixed(2)
  );
  const overallCgpa = Number(Math.min(10, avgPct / 10).toFixed(2));

  const weakAreas = allSubjects
    .filter((s) => !s.passed || s.gapFromAvg < -5 || s.percentage < 60)
    .sort((a, b) => a.percentage - b.percentage)
    .map((s) => {
      const targetPct = !s.passed
        ? Math.max(s.passingPercentage + 10, 55)
        : Math.min(90, Math.max(75, Math.ceil(s.classAveragePercentage + 5)));
      const targetMarks = Math.min(s.maxMarks, Math.ceil((targetPct / 100) * s.maxMarks));
      const marksGainNeeded = Math.max(0, Number((targetMarks - s.marksObtained).toFixed(1)));
      return {
        ...s,
        severity: !s.passed ? 'CRITICAL' : s.gapFromAvg < -10 ? 'HIGH' : 'MODERATE',
        targetPercentage: targetPct,
        targetMarks,
        marksGainNeeded,
        recommendation: !s.passed
          ? `Below passing threshold (${s.passingPercentage}%). Aim for at least ${targetMarks}/${s.maxMarks} (${targetPct}%) in re-assessment or upcoming term.`
          : `Trails cohort average by ${Math.abs(s.gapFromAvg).toFixed(1)}%. Adding +${marksGainNeeded} marks (${targetMarks}/${s.maxMarks}) lifts this subject above cohort benchmark.`,
      };
    });

  const strengths = allSubjects
    .filter((s) => s.passed && s.percentage >= 75)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  // Target recommendations for raising overall percentage/CGPA
  const nextMilestonePct = avgPct < 60 ? 60 : avgPct < 75 ? 75 : avgPct < 85 ? 85 : 90;
  const targetRecommendations = [
    {
      milestone: `${nextMilestonePct}% Overall (${(nextMilestonePct / 10).toFixed(1)} CGPA)`,
      currentPercentage: avgPct,
      percentageGap: Math.max(0, Number((nextMilestonePct - avgPct).toFixed(2))),
      guidance:
        avgPct >= 90
          ? 'Maintaining elite 9.0+ CGPA standing across semesters.'
          : `To lift your cumulative average from ${avgPct}% to ${nextMilestonePct}%, target +${Math.max(
              1,
              (nextMilestonePct - avgPct).toFixed(1)
            )}% across your next semester subjects, starting with ${
              weakAreas[0]?.subjectName || allSubjects[0]?.subjectName || 'core modules'
            }.`,
    },
  ];

  return {
    overallCgpa,
    overallPercentage: avgPct,
    totalEvaluatedClasses: classReports.length,
    weakAreas,
    strengths,
    targetRecommendations,
    semesterTrend,
  };
}

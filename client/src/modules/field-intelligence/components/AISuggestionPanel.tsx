import React, { useMemo } from 'react';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface PanelProps {
  draftReport?: Partial<FieldIntelligenceReport>;
  savedInsights?: Array<{
    insightType: string;
    observation: string;
    reasoning?: string;
    severity: string;
  }>;
}

// ── Score computation (mirrors service.js logic) ──────────────────────────────
function computeScores(r: Partial<FieldIntelligenceReport>) {
  const pValue = parseFloat(String(r.potentialBusinessValue || 0));
  const expMonthly = parseFloat(String(r.expectedMonthlyBusiness || 0));
  const monthlyCons = parseFloat(String(r.monthlyConsumption || 0));
  const credit = parseInt(String(r.creditDays || 0), 10);
  const outstanding = parseFloat(String(r.outstandingAmount || 0));
  const reliability = parseInt(String(r.paymentReliability || 10), 10);
  const urgency = parseInt(String(r.followupUrgencyScore || 0), 10);
  const conversion = parseInt(String(r.conversionProbability || 0), 10);
  const longTerm = parseInt(String(r.longTermPotential || 0), 10);
  const dealerConf = parseInt(String(r.dealerConfidence || 5), 10);

  const moodBoost = r.customerMood === 'Highly Interested' ? 20
    : r.customerMood === 'Neutral' ? 5
    : r.customerMood === 'Dissatisfied' ? 10 : 0;

  const interestScore = Math.min(100, Math.round((conversion * 0.4) + (longTerm * 5) + moodBoost));

  const paymentRiskScore = Math.min(100, Math.round(
    (credit > 90 ? 40 : credit > 60 ? 20 : 5) +
    ((10 - reliability) * 5) +
    (outstanding >= 500000 ? 30 : outstanding >= 200000 ? 15 : 0)
  ));

  const competitorCount = Array.isArray(r.competitors) ? r.competitors.length : 0;
  const competitorThreatScore = Math.min(100, Math.round(
    (competitorCount * 20) +
    (r.currentSupplier?.trim() ? 25 : 0) +
    ((10 - dealerConf) * 3)
  ));

  const followupScore = Math.min(100, urgency * 10);

  const businessPotentialScore = Math.min(100, Math.round(
    (pValue >= 5000000 ? 40 : pValue >= 1000000 ? 25 : pValue >= 500000 ? 15 : 5) +
    (expMonthly >= 500000 ? 30 : expMonthly >= 200000 ? 20 : expMonthly >= 50000 ? 10 : 0) +
    (longTerm * 3)
  ));

  return { interestScore, paymentRiskScore, competitorThreatScore, followupScore, businessPotentialScore };
}

// ── Insight generation (mirrors service.js) ────────────────────────────────
function generateInsights(r: Partial<FieldIntelligenceReport>) {
  const list: Array<{ insightType: string; observation: string; reasoning: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = [];
  const s = computeScores(r);
  const pValue = parseFloat(String(r.potentialBusinessValue || 0));
  const conversion = parseInt(String(r.conversionProbability || 0), 10);
  const longTerm = parseInt(String(r.longTermPotential || 0), 10);
  const urgency = parseInt(String(r.followupUrgencyScore || 0), 10);
  const credit = parseInt(String(r.creditDays || 0), 10);
  const reliability = parseInt(String(r.paymentReliability || 10), 10);
  const outstanding = parseFloat(String(r.outstandingAmount || 0));
  const monthlyCons = parseFloat(String(r.monthlyConsumption || 0));
  const expMonthly = parseFloat(String(r.expectedMonthlyBusiness || 0));
  const visitType = (r.visitType || '').toLowerCase();
  const competitorCount = Array.isArray(r.competitors) ? r.competitors.length : 0;
  const relStrength = parseInt(String(r.relationshipStrength || 5), 10);

  if ((pValue >= 1000000 && conversion >= 50) || longTerm >= 8) {
    list.push({ insightType: 'Strategic Opportunity', observation: `Strategic Account: ₹${pValue.toLocaleString('en-IN')} potential`, reasoning: `LT Potential ${longTerm}/10 · Conversion ${conversion}%`, severity: 'high' });
  }
  if (s.paymentRiskScore >= 50 || credit > 90 || reliability <= 4 || outstanding >= 500000) {
    list.push({ insightType: 'Payment Risk', observation: `Payment Risk Score: ${s.paymentRiskScore}/100`, reasoning: `${credit}d credit · ₹${outstanding.toLocaleString('en-IN')} outstanding · Reliability ${reliability}/10`, severity: s.paymentRiskScore >= 70 ? 'critical' : 'high' });
  }
  if (s.businessPotentialScore >= 60 || monthlyCons >= 500000 || expMonthly >= 200000) {
    list.push({ insightType: 'High Potential Customer', observation: `Business Potential: ${s.businessPotentialScore}/100`, reasoning: `Consumption ₹${monthlyCons.toLocaleString('en-IN')}/mo · Target ₹${expMonthly.toLocaleString('en-IN')}`, severity: 'high' });
  }
  if (s.competitorThreatScore >= 40) {
    list.push({ insightType: 'Competitor Weakness', observation: `Competitor Threat: ${s.competitorThreatScore}/100`, reasoning: `${competitorCount} competitor(s) identified · Supplier: ${r.currentSupplier || 'N/A'}`, severity: s.competitorThreatScore >= 70 ? 'critical' : 'medium' });
  }
  if (s.followupScore >= 70 || r.status === 'Trial Running') {
    list.push({ insightType: 'Urgent Followup', observation: `Follow-up Urgency: ${s.followupScore}/100`, reasoning: `Executive score ${urgency}/10 · Status: ${r.status}`, severity: s.followupScore >= 90 ? 'critical' : 'high' });
  }
  if (s.interestScore >= 70 && conversion >= 60) {
    list.push({ insightType: 'Strategic Opportunity', observation: `High order probability (Interest: ${s.interestScore}/100)`, reasoning: `Mood: ${r.customerMood} · Conversion: ${conversion}% – Send quotation now`, severity: 'high' });
  }
  if (visitType.includes('complaint')) {
    list.push({ insightType: 'Urgent Followup', observation: 'Complaint Visit – 48hr resolution required', reasoning: 'Escalate to Technical team immediately', severity: 'critical' });
  }
  if (visitType.includes('dealer') && relStrength < 5) {
    list.push({ insightType: 'Competitor Weakness', observation: 'Dealer relationship weak – competitor risk', reasoning: `Relationship: ${relStrength}/10 – Offer scheme discussion`, severity: 'high' });
  }
  if (visitType.includes('industrial') && r.trialApproved) {
    list.push({ insightType: 'Strategic Opportunity', observation: 'Industrial trial approved – high conversion', reasoning: 'Assign technical support for trial phase', severity: 'high' });
  }
  if (visitType.includes('technical')) {
    list.push({ insightType: 'Urgent Followup', observation: 'Technical Visit – send TDS within 24 hours', reasoning: 'Follow-up with product data sheets and support contact', severity: 'medium' });
  }
  if (visitType.includes('architect') && r.sampleGiven) {
    list.push({ insightType: 'Strategic Opportunity', observation: 'Samples given – track shade approval in 5 days', reasoning: 'Architect influence on project spec is critical', severity: 'medium' });
  }
  return list;
}

const ScoreBar: React.FC<{ label: string; score: number; invertColor?: boolean }> = ({
  label, score, invertColor = false,
}) => {
  const pct = score;
  const goodScore = invertColor ? 100 - score : score;
  const color = goodScore >= 70 ? 'bg-green-500' : goodScore >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-gray-600">{label}</span>
        <span className="font-bold text-gray-800">{score}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export const AISuggestionPanel: React.FC<PanelProps> = ({ draftReport, savedInsights }) => {
  const { insights, scores } = useMemo(() => {
    if (savedInsights) return { insights: savedInsights, scores: null };
    if (!draftReport) return { insights: [], scores: null };
    return {
      insights: generateInsights(draftReport),
      scores: computeScores(draftReport),
    };
  }, [draftReport, savedInsights]);

  const severityColors: Record<string, string> = {
    low: 'bg-blue-50 border-blue-200 text-blue-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    high: 'bg-orange-50 border-orange-200 text-orange-800',
    critical: 'bg-red-50 border-red-200 text-red-800',
  };

  const severityIcons: Record<string, string> = {
    low: 'ℹ️', medium: '⚡', high: '🔥', critical: '🚨',
  };

  return (
    <div className="card p-5 border-primary-100 bg-primary-50/20 mb-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-primary-100 flex items-center gap-2">
        <span className="bg-primary-500 text-white p-1 rounded-md">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </span>
        AI Intelligence Panel
      </h3>

      {/* Composite Score Dashboard */}
      {scores && (
        <div className="space-y-2.5 mb-5 p-3 bg-white rounded-lg border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Composite Scores</p>
          <ScoreBar label="Interest Score" score={scores.interestScore} />
          <ScoreBar label="Business Potential" score={scores.businessPotentialScore} />
          <ScoreBar label="Payment Risk" score={scores.paymentRiskScore} invertColor />
          <ScoreBar label="Competitor Threat" score={scores.competitorThreatScore} invertColor />
          <ScoreBar label="Follow-up Urgency" score={scores.followupScore} invertColor />
        </div>
      )}

      {/* Insights */}
      {insights.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          Fill in visit details to generate intelligence insights.
        </p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`border p-3 rounded-lg shadow-sm ${severityColors[insight.severity] || 'bg-gray-50 border-gray-200'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  {severityIcons[insight.severity]} {insight.insightType}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-extrabold uppercase bg-white/70">
                  {insight.severity}
                </span>
              </div>
              <h4 className="font-bold text-sm mb-0.5">{insight.observation}</h4>
              {insight.reasoning && <p className="text-xs opacity-90">{insight.reasoning}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default AISuggestionPanel;

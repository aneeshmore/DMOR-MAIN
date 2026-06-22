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

export const AISuggestionPanel: React.FC<PanelProps> = ({ draftReport, savedInsights }) => {
  const insights = useMemo(() => {
    if (savedInsights) return savedInsights;
    if (!draftReport) return [];

    // Real-time client-side evaluation of business rules
    const list: Array<{
      insightType: string;
      observation: string;
      reasoning: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }> = [];
    const pValue = parseFloat(String(draftReport.potentialBusinessValue || 0));
    const expMonthly = parseFloat(String(draftReport.expectedMonthlyBusiness || 0));
    const monthlyCons = parseFloat(String(draftReport.monthlyConsumption || 0));
    const credit = parseInt(String(draftReport.creditDays || 0), 10);
    const outstanding = parseFloat(String(draftReport.outstandingAmount || 0));
    const reliability = parseInt(String(draftReport.paymentReliability || 10), 10);
    const urgency = parseInt(String(draftReport.followupUrgencyScore || 0), 10);
    const conversion = parseInt(String(draftReport.conversionProbability || 0), 10);
    const longTerm = parseInt(String(draftReport.longTermPotential || 0), 10);

    // 1. Strategic Opportunity
    if ((pValue >= 1000000 && conversion >= 50) || longTerm >= 8) {
      list.push({
        insightType: 'Strategic Opportunity',
        observation: `Strategic Account Opportunity detected: Potential value ₹${pValue.toLocaleString('en-IN')}`,
        reasoning: `High strategic fit with long-term potential score of ${longTerm}/10 and conversion probability of ${conversion}%.`,
        severity: 'high',
      });
    }

    // 2. Payment Risk
    if (credit > 90 || reliability <= 4 || outstanding >= 500000) {
      list.push({
        insightType: 'Payment Risk',
        observation: 'Warning: High payment/credit terms risk detected',
        reasoning: `Account terms check: ${credit} credit days requested, ₹${outstanding.toLocaleString('en-IN')} current outstanding, payment reliability rating is ${reliability}/10.`,
        severity: 'critical',
      });
    }

    // 3. High Potential Customer
    if (monthlyCons >= 500000 || expMonthly >= 200000) {
      list.push({
        insightType: 'High Potential Customer',
        observation: `High-Consumption Target: Est. consumption ₹${monthlyCons.toLocaleString('en-IN')}/mo`,
        reasoning: `Monthly purchase potential exceeds baseline thresholds. Expected monthly sales value target ₹${expMonthly.toLocaleString('en-IN')}.`,
        severity: 'high',
      });
    }

    // 4. Competitor Weakness
    if (draftReport.currentSupplier && draftReport.currentSupplier.trim().length > 0) {
      list.push({
        insightType: 'Competitor Weakness',
        observation: `Supplier displacement strategy: Target ${draftReport.currentSupplier}`,
        reasoning: `Analysis of current systems indicates potential entry points through specialized shade match or faster lead times.`,
        severity: 'medium',
      });
    }

    // 5. Urgent Followup
    if (urgency >= 7 || draftReport.status === 'Trial Running') {
      list.push({
        insightType: 'Urgent Followup',
        observation: 'Urgent follow-up requested by executive',
        reasoning: `Executive urgency rating is ${urgency}/10. Active workflows (such as Trial Running) demand immediate support.`,
        severity: 'high',
      });
    }

    return list;
  }, [draftReport, savedInsights]);

  return (
    <div className="card p-6 border-primary-100 bg-primary-50/20 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-primary-100 flex items-center gap-2">
        <span className="bg-primary-500 text-white p-1 rounded-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </span>
        AI Suggestion & Insight Panel (Rule-Based)
      </h3>

      {insights.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          Fill out technical and commercial form details to generate insights.
        </p>
      ) : (
        <div className="space-y-4 animate-fade-in">
          {insights.map((insight, idx) => {
            const severityColors =
              {
                low: 'bg-blue-50 border-blue-200 text-blue-800',
                medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                high: 'bg-orange-50 border-orange-200 text-orange-800',
                critical: 'bg-red-50 border-red-200 text-red-800',
              }[insight.severity] || 'bg-gray-50 border-gray-200 text-gray-800';

            return (
              <div key={idx} className={`border p-4 rounded-lg shadow-sm ${severityColors}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {insight.insightType}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-extrabold uppercase bg-white/70">
                    {insight.severity}
                  </span>
                </div>
                <h4 className="font-bold text-sm mb-1">{insight.observation}</h4>
                {insight.reasoning && <p className="text-xs opacity-90">{insight.reasoning}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default AISuggestionPanel;

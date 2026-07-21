import React, { useMemo, useState, useEffect, useRef } from 'react';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';
import { fieldIntelligenceApi } from '../services/fieldIntelligenceApi';
import { showToast } from '@/utils/toast';
import { Sparkles, MessageSquare, Send, StopCircle, RefreshCw } from 'lucide-react';

interface PanelProps {
  draftReport?: Partial<FieldIntelligenceReport>;
  savedInsights?: Array<{
    insightType: string;
    observation: string;
    reasoning?: string;
    severity: string;
  }>;
  customerHistory?: any[];
}

const normalizeScore = (v: any): number => {
  const n = Number(v);
  if (isNaN(n) || !isFinite(n)) return 5;
  if (n > 10) return n / 10;
  return n;
};

const computeHealthScore = (v: any): number => {
  if (!v) return 50;
  const scores = [
    { val: v.relationshipStrength, wt: 3.0 },
    { val: v.paymentReliability, wt: 2.5 },
    { val: v.dealerConfidence, wt: 1.5 },
    { val: v.technicalCapability, wt: 1.5 },
    { val: v.longTermPotential, wt: 1.5 },
  ];
  let weightedSum = 0;
  let totalWeight = 0;
  scores.forEach(s => {
    if (s.val !== null && s.val !== undefined && s.val !== '' && s.val !== 'N/A') {
      const val = normalizeScore(s.val);
      weightedSum += val * s.wt;
      totalWeight += s.wt;
    }
  });
  if (totalWeight === 0) return 50;
  return Math.round((weightedSum / totalWeight) * 10);
};

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

  const moodBoost =
    r.customerMood === 'Highly Interested'
      ? 20
      : r.customerMood === 'Neutral'
        ? 5
        : r.customerMood === 'Dissatisfied'
          ? 10
          : 0;

  const interestScore = Math.min(100, Math.round(conversion * 0.4 + longTerm * 5 + moodBoost));

  const paymentRiskScore = Math.min(
    100,
    Math.round(
      (credit > 90 ? 40 : credit > 60 ? 20 : 5) +
        (10 - reliability) * 5 +
        (outstanding >= 500000 ? 30 : outstanding >= 200000 ? 15 : 0)
    )
  );

  const competitorCount = Array.isArray(r.competitors) ? r.competitors.length : 0;
  const competitorThreatScore = Math.min(
    100,
    Math.round(competitorCount * 20 + (r.currentSupplier?.trim() ? 25 : 0) + (10 - dealerConf) * 3)
  );

  const followupScore = Math.min(100, urgency * 10);

  const businessPotentialScore = Math.min(
    100,
    Math.round(
      (pValue >= 5000000 ? 40 : pValue >= 1000000 ? 25 : pValue >= 500000 ? 15 : 5) +
        (expMonthly >= 500000 ? 30 : expMonthly >= 200000 ? 20 : expMonthly >= 50000 ? 10 : 0) +
        longTerm * 3
    )
  );

  return {
    interestScore,
    paymentRiskScore,
    competitorThreatScore,
    followupScore,
    businessPotentialScore,
  };
}

// ── Insight generation (mirrors service.js) ────────────────────────────────
function generateInsights(r: Partial<FieldIntelligenceReport>) {
  const list: Array<{
    insightType: string;
    observation: string;
    reasoning: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];
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
    list.push({
      insightType: 'Strategic Opportunity',
      observation: `Strategic Account: ₹${pValue.toLocaleString('en-IN')} potential`,
      reasoning: `LT Potential ${longTerm}/10 · Conversion ${conversion}%`,
      severity: 'high',
    });
  }
  if (s.paymentRiskScore >= 50 || credit > 90 || reliability <= 4 || outstanding >= 500000) {
    list.push({
      insightType: 'Payment Risk',
      observation: `Payment Risk Score: ${s.paymentRiskScore}/100`,
      reasoning: `${credit}d credit · ₹${outstanding.toLocaleString('en-IN')} outstanding · Reliability ${reliability}/10`,
      severity: s.paymentRiskScore >= 70 ? 'critical' : 'high',
    });
  }
  if (s.businessPotentialScore >= 60 || monthlyCons >= 500000 || expMonthly >= 200000) {
    list.push({
      insightType: 'High Potential Customer',
      observation: `Business Potential: ${s.businessPotentialScore}/100`,
      reasoning: `Consumption ₹${monthlyCons.toLocaleString('en-IN')}/mo · Target ₹${expMonthly.toLocaleString('en-IN')}`,
      severity: 'high',
    });
  }
  if (s.competitorThreatScore >= 40) {
    list.push({
      insightType: 'Competitor Weakness',
      observation: `Competitor Threat: ${s.competitorThreatScore}/100`,
      reasoning: `${competitorCount} competitor(s) identified · Supplier: ${r.currentSupplier || 'N/A'}`,
      severity: s.competitorThreatScore >= 70 ? 'critical' : 'medium',
    });
  }
  if (s.followupScore >= 70 || r.status === 'Trial Running') {
    list.push({
      insightType: 'Urgent Followup',
      observation: `Follow-up Urgency: ${s.followupScore}/100`,
      reasoning: `Executive score ${urgency}/10 · Status: ${r.status}`,
      severity: s.followupScore >= 90 ? 'critical' : 'high',
    });
  }
  if (s.interestScore >= 70 && conversion >= 60) {
    list.push({
      insightType: 'Strategic Opportunity',
      observation: `High order probability (Interest: ${s.interestScore}/100)`,
      reasoning: `Mood: ${r.customerMood} · Conversion: ${conversion}% – Send quotation now`,
      severity: 'high',
    });
  }
  if (visitType.includes('complaint')) {
    list.push({
      insightType: 'Urgent Followup',
      observation: 'Complaint Visit – 48hr resolution required',
      reasoning: 'Escalate to Technical team immediately',
      severity: 'critical',
    });
  }
  if (visitType.includes('dealer') && relStrength < 5) {
    list.push({
      insightType: 'Competitor Weakness',
      observation: 'Dealer relationship weak – competitor risk',
      reasoning: `Relationship: ${relStrength}/10 – Offer scheme discussion`,
      severity: 'high',
    });
  }
  if (visitType.includes('industrial') && r.trialApproved) {
    list.push({
      insightType: 'Strategic Opportunity',
      observation: 'Industrial trial approved – high conversion',
      reasoning: 'Assign technical support for trial phase',
      severity: 'high',
    });
  }
  if (visitType.includes('technical')) {
    list.push({
      insightType: 'Urgent Followup',
      observation: 'Technical Visit – send TDS within 24 hours',
      reasoning: 'Follow-up with product data sheets and support contact',
      severity: 'medium',
    });
  }
  if (visitType.includes('architect') && r.sampleGiven) {
    list.push({
      insightType: 'Strategic Opportunity',
      observation: 'Samples given – track shade approval in 5 days',
      reasoning: 'Architect influence on project spec is critical',
      severity: 'medium',
    });
  }
  return list;
}

const ScoreBar: React.FC<{ label: string; score: number; invertColor?: boolean }> = ({
  label,
  score,
  invertColor = false,
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
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export const AISuggestionPanel: React.FC<PanelProps> = ({
  draftReport,
  savedInsights,
  customerHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'insights' | 'chat'>('insights');
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAbortController, setChatAbortController] = useState<AbortController | null>(null);

  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  const customerName = draftReport?.customerName || '';
  const customerId = draftReport?.customerId;

  // Initialize welcome message for the selected customer
  useEffect(() => {
    if (customerName) {
      setChatMessages([
        {
          role: 'assistant',
          content: `Hello! I am your PaintOS AI Assistant. I have analyzed ${customerName}'s historical visit reports, competitor presence, trial status, and discussions. Ask me anything about this account.`,
          timestamp: new Date(),
        },
      ]);
    } else {
      setChatMessages([]);
    }
  }, [customerName]);

  // Dynamically load historical AI insights for the latest completed report
  useEffect(() => {
    const fetchInsights = async () => {
      const latestSubmitted = (customerHistory || []).find((v: any) => v.status === 'Submitted');
      if (latestSubmitted?.id) {
        try {
          setAiLoading(true);
          const result = await fieldIntelligenceApi.getReportAiInsights(latestSubmitted.id);
          setAiInsights(result);
        } catch (err) {
          console.error('Failed to fetch AI insights in panel', err);
        } finally {
          setAiLoading(false);
        }
      } else {
        setAiInsights(null);
      }
    };
    fetchInsights();
  }, [customerHistory]);

  // Auto-scroll chat window
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const { insights, scores, healthScore, trendLabel } = useMemo(() => {
    if (savedInsights)
      return { insights: savedInsights, scores: null, healthScore: 50, trendLabel: 'Stable —' };
    if (!draftReport)
      return { insights: [], scores: null, healthScore: 50, trendLabel: 'Stable —' };

    // Compute actual historical trend
    let computedTrend = 'Stable —';
    const submitted = (customerHistory || []).filter((v: any) => v.status === 'Submitted');
    if (submitted.length > 1) {
      const latestH = computeHealthScore(submitted[0]);
      const priorH = computeHealthScore(submitted[1]);
      const diff = latestH - priorH;
      if (diff >= 3) computedTrend = 'Improving ↑';
      else if (diff <= -3) computedTrend = 'Declining ↓';
    }

    return {
      insights: generateInsights(draftReport),
      scores: computeScores(draftReport),
      healthScore: computeHealthScore(draftReport),
      trendLabel: computedTrend,
    };
  }, [draftReport, savedInsights, customerHistory]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const text = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    const userMsg = { role: 'user' as const, content: text, timestamp: new Date() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);

    const abortCtrl = new AbortController();
    setChatAbortController(abortCtrl);

    const placeholderMsg = { role: 'assistant' as const, content: '', timestamp: new Date() };
    setChatMessages(prev => [...prev, placeholderMsg]);

    try {
      const apiHistory = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fieldIntelligenceApi.chatWithCompanyCopilot(
        customerName,
        customerId,
        apiHistory,
        abortCtrl.signal
      );

      if (!response.ok) {
        throw new Error('Connection failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const textChunk = parsed.choices?.[0]?.delta?.content || '';
                accumulated += textChunk;

                setChatMessages(prev => {
                  const copy = [...prev];
                  if (copy.length > 0) {
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content: accumulated,
                    };
                  }
                  return copy;
                });
              } catch {
                // ignore json parse errors
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast.error('Chat stopped.');
      } else {
        setChatMessages(prev => {
          const copy = [...prev];
          if (copy.length > 0) {
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content:
                '⚠️ Failed to connect to PaintOS AI engine. Please verify network or API keys.',
            };
          }
          return copy;
        });
      }
    } finally {
      setChatLoading(false);
      setChatAbortController(null);
    }
  };

  const severityColors: Record<string, string> = {
    low: 'bg-blue-50 border-blue-200 text-blue-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    high: 'bg-orange-50 border-orange-200 text-orange-800',
    critical: 'bg-red-50 border-red-200 text-red-800',
  };

  const severityIcons: Record<string, string> = {
    low: 'ℹ️',
    medium: '⚡',
    high: '🔥',
    critical: '🚨',
  };

  return (
    <div className="card p-4 border border-indigo-150 bg-indigo-50/10 mb-6 flex flex-col min-h-[400px]">
      {/* Dynamic Tab switching */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 border border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('insights')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'insights'
              ? 'bg-white text-[var(--primary)] shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50/50'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Insights
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'chat'
              ? 'bg-white text-[var(--primary)] shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50/50'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          PaintOS AI Chat
        </button>
      </div>

      {activeTab === 'insights' ? (
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[var(--primary)]" />
                Intelligence Dashboard
              </span>
              {aiLoading && <RefreshCw className="h-3 w-3 animate-spin text-gray-400" />}
            </h3>

            {/* Composite Score Dashboard using historical data */}
            {scores && (
              <div className="space-y-2.5 mb-4 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">
                    Historical AI Analytics
                  </p>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.25 rounded border ${
                      trendLabel.includes('Improving')
                        ? 'bg-green-50 text-green-700 border-green-150'
                        : trendLabel.includes('Declining')
                          ? 'bg-red-50 text-red-700 border-red-150'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    Trend: {trendLabel}
                  </span>
                </div>

                <ScoreBar label="Customer Health" score={healthScore} />
                <ScoreBar label="Buying Intent" score={draftReport?.conversionProbability || 0} />
                <ScoreBar label="Risk Score" score={scores.paymentRiskScore} invertColor />
                <ScoreBar label="Opportunity Score" score={scores.businessPotentialScore} />
                <ScoreBar
                  label="Competitor Threat"
                  score={scores.competitorThreatScore}
                  invertColor
                />
                <ScoreBar label="Follow-up Priority" score={scores.followupScore} invertColor />
              </div>
            )}

            {/* AI Executive Summary from actual backend model insights */}
            {aiInsights?.executiveBrief && (
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs mb-4">
                <span className="text-[9px] font-bold text-indigo-750 uppercase tracking-wider block mb-1">
                  AI Executive Summary
                </span>
                <p className="text-slate-800 font-medium leading-relaxed">
                  {aiInsights.executiveBrief}
                </p>
              </div>
            )}

            {/* Insights list */}
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {insights.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4 italic">
                  No historical alerts generated.
                </p>
              ) : (
                insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`border p-2.5 rounded-lg shadow-sm ${severityColors[insight.severity] || 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                        {severityIcons[insight.severity]} {insight.insightType}
                      </span>
                      <span className="text-[8px] px-1 py-0.25 rounded-full font-extrabold uppercase bg-white/70">
                        {insight.severity}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-gray-850 mb-0.5 leading-tight">
                      {insight.observation}
                    </h4>
                    {insight.reasoning && (
                      <p className="text-[10px] opacity-90 leading-snug">{insight.reasoning}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* PaintOS AI Chat Assistant interface */
        <div className="flex-1 flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-gray-800 mb-2 pb-1.5 border-b border-gray-200 flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-[var(--primary)]" />
            PaintOS AI Assistant
          </h3>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-2.5 mb-3 bg-gray-50/50 border rounded-xl space-y-3 max-h-[280px]">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col max-w-[90%] ${
                  msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div
                  className={`px-3 py-2 rounded-xl text-xs leading-relaxed font-semibold shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-650 text-white rounded-tr-none'
                      : 'bg-white text-gray-800 border border-gray-250 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content || '▋'}</p>
                </div>
                <span className="text-[9px] text-gray-400 mt-1 font-bold">
                  {msg.role === 'user' ? 'You' : 'PaintOS AI'}
                </span>
              </div>
            ))}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSendChat} className="flex gap-1.5 pt-2 border-t">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              disabled={chatLoading}
              placeholder="Ask PaintOS AI..."
              className="flex-1 border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] disabled:bg-gray-50"
            />
            {chatLoading ? (
              <button
                type="button"
                onClick={() => chatAbortController?.abort()}
                className="bg-red-50 text-red-650 hover:bg-red-100 border border-red-200 px-3 rounded-lg flex items-center justify-center transition-colors"
              >
                <StopCircle className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="bg-indigo-650 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold px-3.5 rounded-lg flex items-center justify-center transition-all shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
export default AISuggestionPanel;

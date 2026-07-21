import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  Calendar,
  Package,
  DollarSign,
  MapPin,
  Phone,
  Mail,
  Hash,
  Clock,
  BarChart3,
  Eye,
  Edit,
  AlertTriangle,
  Award,
  Activity,
  ThumbsUp,
  MessageSquare,
  Shield,
  FileText,
  User,
  Copy,
  Trash,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { showToast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-blue-50 text-blue-700 border-blue-100',
  Approved: 'bg-green-50 text-green-700 border-green-100',
  Qualified: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  'Proposal Sent': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Trial Running': 'bg-pink-50 text-pink-700 border-pink-100',
  Negotiation: 'bg-orange-50 text-orange-700 border-orange-100',
  Won: 'bg-green-50 text-green-700 border-green-100',
  Lost: 'bg-red-50 text-red-700 border-red-100',
  Archived: 'bg-gray-200 text-gray-800 border-gray-300',
};

export const getScoreColorClass = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-450 border-gray-200';
  const scoreNum = Number(score);
  if (isNaN(scoreNum)) return 'bg-gray-100 text-gray-450 border-gray-200';
  if (scoreNum >= 8) return 'bg-green-100 text-green-800 border-green-200';
  if (scoreNum >= 5) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

const getCounterStrategy = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('asian')) {
    return 'Highlight DMOR PU 7038 shade accuracy, demonstrate faster drying time, and offer volume rebates.';
  }
  if (lower.includes('berger')) {
    return "Promote DMOR premium primer adhesion performance and contrast Berger's current drying time challenges.";
  }
  if (lower.includes('dulux')) {
    return 'Offer local depot turnaround time advantages and highlight superior hardener formulations.';
  }
  return 'Provide targeted pilot trial volumes at introductory discount margins and lead with technical service.';
};

const formatDate = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '—';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '—';

  const day = date.getDate();
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

const Chip: React.FC<{ label: string }> = ({ label }) =>
  label ? (
    <span className="inline-block bg-primary-50 text-[var(--primary)] text-xs font-semibold px-2.5 py-1 rounded-full mr-1.5 mb-1.5 border border-primary-100 hover:bg-primary-100 transition-colors">
      {label}
    </span>
  ) : null;

const InfoRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value?: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 px-2 rounded-lg transition-colors">
    {icon && <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>}
    <span className="text-xs font-bold text-gray-500 w-36 flex-shrink-0 uppercase tracking-wider">
      {label}
    </span>
    <span className="text-sm text-gray-800 font-semibold">{value || '—'}</span>
  </div>
);

// Helper for parsing raw text message chunks into paragraph elements
const MessageFormatter: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  // Format citations e.g. [Visit #1]
  const renderCitations = (txt: string) => {
    const citationRegex =
      /(\[(?:Visit\s*#\d+|FIR\s*Report|Customer\s*Master|Previous\s*Follow-up)\])/g;
    const parts = txt.split(citationRegex);
    return parts.map((part, idx) => {
      if (citationRegex.test(part)) {
        const cleanLabel = part.slice(1, -1);
        return (
          <span
            key={idx}
            className="inline-flex items-center mx-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-150"
            title={`Referenced: ${cleanLabel} CRM records`}
          >
            📌 {cleanLabel}
          </span>
        );
      }
      // Simple inline bolding support
      const boldParts = part.split(/(\*\*.*?\*\*)/g);
      return boldParts.map((bp, bidx) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return (
            <strong key={bidx} className="font-extrabold text-gray-800">
              {bp.slice(2, -2)}
            </strong>
          );
        }
        return bp;
      });
    });
  };

  const paragraphs = content.split('\n\n');
  return (
    <div className="space-y-3">
      {paragraphs.map((p, index) => {
        const isList = p.trim().startsWith('-') || p.trim().startsWith('*');
        if (isList) {
          const listItems = p
            .split('\n')
            .map(li => li.replace(/^[-*]\s*/, '').trim())
            .filter(Boolean);
          return (
            <ul key={index} className="list-disc pl-5 space-y-1 text-gray-700 text-sm">
              {listItems.map((item, lidx) => (
                <li key={lidx}>{renderCitations(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-gray-750 text-sm leading-relaxed">
            {renderCitations(p)}
          </p>
        );
      })}
    </div>
  );
};

const normalizeScore = (v: any): number => {
  if (v === null || v === undefined || v === '' || v === 'N/A') return 5;
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

export const CustomerDashboardPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'timeline' | 'chat'>(
    'overview'
  );

  // API State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Chart States
  const [activeTrendMetric, setActiveTrendMetric] = useState<'conversion' | 'relationship'>(
    'conversion'
  );
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  // Chat Copilot States
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchDashboardData = async () => {
    if (!customerId || isNaN(Number(customerId))) {
      setError('Invalid customerId');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await fieldIntelligenceApi.getCustomerDashboard(Number(customerId));
      if (!result || !result.profile) {
        setError('Customer record not found');
      } else {
        setData(result);
        if (result.visits && result.visits.length > 0) {
          const latestReport = result.visits[0];
          try {
            setAiLoading(true);
            const insights = await fieldIntelligenceApi.getReportAiInsights(latestReport.id);
            setAiInsights(insights);
          } catch (aiErr) {
            console.error('Failed to load dashboard AI insights:', aiErr);
          } finally {
            setAiLoading(false);
          }
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Customer record not found');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast.success('Copied to clipboard');
  };

  useEffect(() => {
    fetchDashboardData();
  }, [customerId]);

  // Handle Tab Greeting Init
  useEffect(() => {
    if (activeTab === 'chat' && messages.length === 0 && data?.profile) {
      setMessages([
        {
          role: 'assistant',
          content: `Hello! I am your **PaintOS Assistant**.\n\nI have fully loaded the CRM context for **${data.profile.customerName}** including **${data.visits?.length ?? 0}** visits, historical dynamic insights, competitor files, and objections.\n\nHow can I help you prepare for your next customer engagement today?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [activeTab, messages, data]);

  // Scroll to chat bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Safely extract profile/visits/etc.
  const profile = data?.profile || {};
  const analytics = data?.analytics || {};
  const sales = data?.sales || {};
  const products = data?.products || [];
  const visits = data?.visits || [];

  const chronologicalVisits = useMemo(() => {
    return [...visits].sort(
      (a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
    );
  }, [visits]);

  // 1. Health Score Ring Calculation
  const latestVisit = visits[0] || {};
  const relStrength = normalizeScore(latestVisit.relationshipStrength);
  const paymentReliability = normalizeScore(latestVisit.paymentReliability);
  const dealerConfidence = normalizeScore(latestVisit.dealerConfidence);
  const technicalCapability = normalizeScore(latestVisit.technicalCapability);
  const longTermPotential = normalizeScore(latestVisit.longTermPotential);
  const urgency = normalizeScore(latestVisit.followupUrgencyScore);

  const healthScore = computeHealthScore(latestVisit);

  let healthStatus = 'Healthy';
  let healthColor = 'text-green-600 border-green-200 bg-green-50';
  let healthProgressColor = 'stroke-green-600';
  if (healthScore < 45) {
    healthStatus = 'At-Risk';
    healthColor = 'text-red-600 border-red-200 bg-red-50';
    healthProgressColor = 'stroke-red-600';
  } else if (healthScore < 70) {
    healthStatus = 'Moderate';
    healthColor = 'text-amber-600 border-amber-200 bg-amber-50';
    healthProgressColor = 'stroke-amber-600';
  }

  // 2. Health Trend calculation (compare latest vs prior visit)
  let healthTrend = 'Stable';
  let trendIndicator = '—';
  let trendColor = 'text-gray-500';
  if (visits.length > 1) {
    const priorVisit = visits[1];
    const priorHealth = computeHealthScore(priorVisit);
    const healthDiff = healthScore - priorHealth;
    if (healthDiff >= 3) {
      healthTrend = 'Improving';
      trendIndicator = '↑';
      trendColor = 'text-green-600';
    } else if (healthDiff <= -3) {
      healthTrend = 'Declining';
      trendIndicator = '↓';
      trendColor = 'text-red-600';
    }
  }

  // 3. Engagement & Stability Metrics
  const engagement = visits.length < 3 ? 'Low' : visits.length < 8 ? 'Moderate' : 'High';

  // Stability standard deviation of health scores
  let stabilityLabel = 'Stable';
  if (visits.length <= 1) {
    stabilityLabel = 'N/A';
  } else {
    const healthScores = visits.map((v: any) => computeHealthScore(v));
    const avgHealth = healthScores.reduce((a: number, b: number) => a + b, 0) / healthScores.length;
    const sqDiffs = healthScores.map((s: number) => Math.pow(s - avgHealth, 2));
    const variance = sqDiffs.reduce((a: number, b: number) => a + b, 0) / healthScores.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev < 5) stabilityLabel = 'Highly Stable';
    else if (stdDev > 12) stabilityLabel = 'Fluctuating';
  }

  // Days since last visit
  const daysSinceLastVisit = latestVisit.visitDate
    ? Math.floor((Date.now() - new Date(latestVisit.visitDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // 4. Natural Language Health Summary generator
  const naturalLanguageHealthSummary = useMemo(() => {
    if (visits.length === 0)
      return 'No visit reports have been logged to compile customer health data.';
    const parts = [];
    parts.push(
      `**${profile.customerName}** has a customer health score of **${healthScore}%**, classified as **${healthStatus}**.`
    );

    if (daysSinceLastVisit !== null) {
      parts.push(`The last visit was logged **${daysSinceLastVisit} days ago**.`);
    }

    if (paymentReliability <= 4) {
      parts.push(
        'Warning: Payment reliability rating is currently critical, requiring close monitoring of outstanding balances.'
      );
    } else {
      parts.push('Payment patterns appear stable based on logged executive ratings.');
    }

    if (relStrength >= 8) {
      parts.push(
        'The relationship strength is exceptionally strong, reflecting active engagement and high trust levels.'
      );
    } else if (relStrength < 5) {
      parts.push(
        'Relationship parameters indicate a potential displacement threat from competitor brands.'
      );
    }

    if (sales.outstandingAmount && Number(sales.outstandingAmount) > 0) {
      parts.push(
        `Current CRM records report an outstanding balance of **₹${Number(sales.outstandingAmount).toLocaleString('en-IN')}**.`
      );
    }

    return parts.join(' ');
  }, [
    visits,
    profile,
    healthScore,
    healthStatus,
    daysSinceLastVisit,
    paymentReliability,
    relStrength,
    sales,
  ]);

  const resolvedIssues = useMemo(() => {
    if (visits.length <= 1) return [];
    const latestChallenges = visits[0]?.technicalChallenges || [];
    const pastChallenges = Array.from(
      new Set(visits.slice(1).flatMap((v: any) => v.technicalChallenges || []))
    );
    return pastChallenges.filter((c: any) => !latestChallenges.includes(c));
  }, [visits]);

  const pendingTechSupportCount = useMemo(() => {
    return (visits.flatMap((v: any) => v.followups || []) || []).filter(
      (f: any) => f.status === 'Open' && /tech|trial|sample|shade/i.test(f.notes || '')
    ).length;
  }, [visits]);

  const uniqueActiveTrials = useMemo(() => {
    const trials: string[] = [];
    visits.forEach((v: any) => {
      if (v.trialApproved || v.status === 'Trial Running') {
        const types = v.paintRequirementTypes || [];
        types.forEach((t: string) => {
          if (t && !trials.includes(t)) {
            trials.push(t);
          }
        });
        if (types.length === 0) {
          const fallback = 'Premium Coatings';
          if (!trials.includes(fallback)) {
            trials.push(fallback);
          }
        }
      }
    });
    return trials;
  }, [visits]);

  const competitorsList = useMemo(() => {
    const detailList = data?.competitorsDetail || [];
    const map: Record<
      string,
      {
        name: string;
        count: number;
        strengths: string[];
        weaknesses: string[];
        reasonsUsing: string[];
        reasonsShift: string[];
      }
    > = {};

    detailList.forEach((c: any) => {
      const name = c.competitorName;
      if (!map[name]) {
        map[name] = {
          name,
          count: 0,
          strengths: [],
          weaknesses: [],
          reasonsUsing: [],
          reasonsShift: [],
        };
      }
      map[name].count += 1;
      if (c.strengths) map[name].strengths.push(c.strengths);
      if (c.weaknesses) map[name].weaknesses.push(c.weaknesses);
      if (c.reasonUsingCompetitor) map[name].reasonsUsing.push(c.reasonUsingCompetitor);
      if (c.reasonShiftToUs) map[name].reasonsShift.push(c.reasonShiftToUs);
    });

    return Object.values(map);
  }, [data?.competitorsDetail]);

  // SVG Trend Chart calculations
  const chartWidth = 600;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const points = useMemo(() => {
    return chronologicalVisits.map((visit, index) => {
      const x =
        chronologicalVisits.length > 1
          ? paddingX + (index * (chartWidth - 2 * paddingX)) / (chronologicalVisits.length - 1)
          : chartWidth / 2;

      let value = 0;
      if (activeTrendMetric === 'conversion') {
        const rawConversion = Number(visit.conversionProbability);
        value = isNaN(rawConversion) ? 0 : Math.max(0, Math.min(100, rawConversion));
      } else {
        const rel = normalizeScore(visit.relationshipStrength);
        value = rel * 10;
      }

      const y = chartHeight - paddingY - (value * (chartHeight - 2 * paddingY)) / 100;
      return { x, y, value, visit };
    });
  }, [chronologicalVisits, activeTrendMetric]);

  // Aggregated Competitors from timeline
  const competitorAggregation = useMemo(() => {
    const map: Record<string, { count: number; strengths: Set<string>; weaknesses: Set<string> }> =
      {};
    visits.forEach((v: any) => {
      if (v.competitors && Array.isArray(v.competitors)) {
        v.competitors.forEach((c: any) => {
          if (!c.brandName) return;
          const name = c.brandName.trim();
          if (!map[name]) {
            map[name] = { count: 0, strengths: new Set(), weaknesses: new Set() };
          }
          map[name].count += 1;
          if (c.strengths) map[name].strengths.add(c.strengths);
          if (c.weaknesses) map[name].weaknesses.add(c.weaknesses);
        });
      } else if (v.currentSupplier) {
        const name = v.currentSupplier.trim();
        if (!map[name]) {
          map[name] = { count: 0, strengths: new Set(), weaknesses: new Set() };
        }
        map[name].count += 1;
      }
    });
    return Object.entries(map).map(([name, obj]) => ({
      name,
      count: obj.count,
      strengths: Array.from(obj.strengths).join('; ') || 'N/A',
      weaknesses: Array.from(obj.weaknesses).join('; ') || 'N/A',
    }));
  }, [visits]);

  // Aggregated Substrates and Substrate challenges
  const substrateAgg = useMemo(() => {
    const list: string[] = [];
    visits.forEach((v: any) => {
      if (v.surfaceTypes && Array.isArray(v.surfaceTypes)) {
        v.surfaceTypes.forEach((s: string) => {
          if (s && !list.includes(s)) list.push(s);
        });
      }
    });
    return list;
  }, [visits]);

  const challengesAgg = useMemo(() => {
    const list: string[] = [];
    visits.forEach((v: any) => {
      if (v.technicalChallenges && Array.isArray(v.technicalChallenges)) {
        v.technicalChallenges.forEach((s: string) => {
          if (s && !list.includes(s)) list.push(s);
        });
      }
    });
    return list;
  }, [visits]);

  // Early returns can safely be checked here AFTER all hooks are defined
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 border-t-2" />
        <span className="text-gray-500 font-bold text-sm tracking-wide">
          Retrieving Customer Intelligence...
        </span>
      </div>
    );
  }

  if (error || !data) {
    const isAccessDenied =
      error?.toLowerCase().includes('access denied') ||
      error?.toLowerCase().includes('permission') ||
      error?.toLowerCase().includes('forbidden');
    return (
      <div className="card p-8 text-center border-red-200 bg-red-50 text-red-700 max-w-md mx-auto mt-12 shadow-lg rounded-2xl">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-red-500 animate-bounce" />
        <h3 className="font-extrabold text-xl mb-1.5">
          {isAccessDenied ? 'ACCESS DENIED' : 'Customer record not found'}
        </h3>
        <p className="text-sm mb-5 text-red-650 font-semibold">
          {isAccessDenied
            ? 'You do not have permission to view this customer dashboard.'
            : 'The requested customer record does not exist or has been deleted.'}
        </p>
        <button
          onClick={() => navigate('/operations/field-intelligence')}
          className="btn bg-[var(--primary)] text-white px-5 py-2.5 font-bold shadow-md rounded-xl transition-all cursor-pointer"
        >
          Back to SMART CRM
        </button>
      </div>
    );
  }

  // 5. AI Chat actions
  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = { role: 'user' as const, content: chatInput, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    const controller = new AbortController();
    setAbortController(controller);

    const placeholder = { role: 'assistant' as const, content: '', timestamp: new Date() };
    setMessages(prev => [...prev, placeholder]);

    try {
      const apiMessages = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fieldIntelligenceApi.chatWithCompanyCopilot(
        profile?.customerName || 'Customer',
        customerId ? Number(customerId) : undefined,
        apiMessages,
        controller.signal
      );

      if (!response.ok) {
        let errMessage = response.statusText || 'Paint OS AI stream connection failed';
        try {
          const errData = await response.json();
          if (errData?.message) errMessage = errData.message;
        } catch {
          // fallback to statusText
        }
        throw new Error(errMessage);
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

                setMessages(prev => {
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
                // Ignore parse errors on partial streams
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast.error('Generation stopped.');
      } else {
        setMessages(prev => {
          const copy = [...prev];
          if (copy.length > 0) {
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content: `⚠️ **Paint OS AI Integration Unavailable**\n\nThe backend AI services are currently unconfigured or offline.\n\n*Error details: ${err.message}*`,
            };
          }
          return copy;
        });
      }
    } finally {
      setChatLoading(false);
      setAbortController(null);
    }
  };

  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setChatLoading(false);
      setAbortController(null);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Hello! I am your **PaintOS Assistant**.\n\nI have fully loaded the CRM context for **${profile.customerName}** including **${visits.length}** visits, historical dynamic insights, competitor files, and objections.\n\nHow can I help you prepare for your next customer engagement today?`,
        timestamp: new Date(),
      },
    ]);
  };

  const getLinePath = () => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    return points.reduce(
      (acc, c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`),
      ''
    );
  };

  const getAreaPath = () => {
    if (points.length === 0) return '';
    const line = getLinePath();
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const baseY = chartHeight - paddingY;
    return `${line} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in text-gray-800">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/operations/field-intelligence')}
            className="p-2 rounded-lg border border-gray-250 hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors shadow-sm cursor-pointer"
            title="Back to List"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="h-6 w-6 text-[var(--primary)]" />
              {profile.customerName}
            </h1>
            <p className="text-xs text-gray-450 mt-0.5 font-semibold">
              Customer Intelligence Dashboard · Account #{customerId}
            </p>
          </div>
        </div>

        <div className="flex bg-gray-100/80 p-0.75 rounded-xl border border-gray-200 text-xs font-bold self-stretch sm:self-auto">
          {[
            { id: 'overview', label: 'Overview', icon: <Building2 className="h-3.5 w-3.5" /> },
            { id: 'metrics', label: 'Metrics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
            { id: 'timeline', label: 'Timeline', icon: <Calendar className="h-3.5 w-3.5" /> },
            { id: 'chat', label: 'Paint OS AI', icon: <MessageSquare className="h-3.5 w-3.5" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-gray-950 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────────── */}

      {/* ═ Tab 1: Overview ════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Health Ring Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card p-5 border border-gray-200 bg-white rounded-2xl shadow-sm text-center">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 text-left border-b pb-2">
                Customer Health Index
              </h3>

              <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="72" cy="72" r="60" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    fill="none"
                    className={`${healthProgressColor} transition-all duration-700 ease-out`}
                    strokeWidth="10"
                    strokeDasharray={377}
                    strokeDashoffset={377 - (377 * healthScore) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-extrabold text-gray-900 leading-none">
                    {healthScore}%
                  </span>
                  <span className="block text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                    Health Index
                  </span>
                </div>
              </div>

              <div className="mt-4 flex justify-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${healthColor}`}>
                  Status: {healthStatus}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border border-gray-200 bg-gray-55/50 ${trendColor}`}
                >
                  Trend: {trendIndicator} {healthTrend}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 border-t pt-4 text-left">
                <div>
                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    Stability
                  </span>
                  <span className="text-xs font-bold text-gray-800 mt-0.5 block">
                    {stabilityLabel}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    Engagement
                  </span>
                  <span className="text-xs font-bold text-gray-800 mt-0.5 block">{engagement}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    Last Visit
                  </span>
                  <span className="text-xs font-bold text-gray-800 mt-0.5 block">
                    {daysSinceLastVisit !== null ? `${daysSinceLastVisit} days ago` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Brief */}
            <div className="card p-5 border border-gray-200 bg-white rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 border-b pb-2 flex items-center gap-1.5">
                <Shield className="h-4.5 w-4.5 text-[var(--primary)]" />
                Contact Profile
              </h3>
              <div className="space-y-0.5">
                <InfoRow label="Met Person" value={profile.contactPerson} />
                <InfoRow label="Designation" value={profile.designation} />
                <InfoRow label="Business Cat" value={profile.businessCategory} />
                <InfoRow label="Mobile No" value={profile.mobile} />
                <InfoRow label="GSTIN" value={profile.gstNumber} />
                <InfoRow
                  label="Outstanding"
                  value={
                    sales.outstandingAmount
                      ? `₹${Number(sales.outstandingAmount).toLocaleString('en-IN')}`
                      : '₹0'
                  }
                />
              </div>
            </div>
          </div>

          {/* Center/Right Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Natural language summary */}
            <div className="card p-5 border border-gray-200 bg-gradient-to-r from-indigo-50/40 to-primary-50/20 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                Executive Health Summary
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {naturalLanguageHealthSummary}
              </p>
            </div>

            {/* 8 Executive Decision Cards Grid */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Shield className="h-4.5 w-4.5 text-indigo-650" />
                Executive Decision Support Console
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Customer Health */}
                <div className="card p-4 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Customer Health
                      </h4>
                      <Activity className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="text-[10px] text-gray-450 font-semibold italic mb-1.5">
                      How strong is the customer relationship?
                    </p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-extrabold text-gray-900">{healthScore}%</span>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        {healthStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {aiInsights?.customerHealthScore?.reason ||
                        `Relationship is ${stabilityLabel.toLowerCase()} with an engagement frequency rated as "${engagement}".`}
                    </p>
                  </div>
                </div>

                {/* 2. Buying Intent */}
                <div className="card p-4 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Buying Intent
                      </h4>
                      <TrendingUp className="h-4 w-4 text-indigo-500" />
                    </div>
                    <p className="text-[10px] text-gray-450 font-semibold italic mb-1.5">
                      Is the customer likely to place an order?
                    </p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-extrabold text-gray-900">
                        {latestVisit.conversionProbability || 0}%
                      </span>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        {latestVisit.customerMood || 'Neutral'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {aiInsights?.salesProbability?.reason ||
                        `Representative reports ${latestVisit.conversionProbability || 0}% probability based on discussion notes.`}
                    </p>
                  </div>
                </div>

                {/* 3. Risks & Objections */}
                <div className="card p-4 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Risks & Objections
                      </h4>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <p className="text-[10px] text-gray-450 font-semibold italic mb-1.5">
                      What could stop or delay the deal?
                    </p>
                    <div className="mb-2 space-y-1">
                      <div className="text-xs text-gray-700">
                        Outstanding:{' '}
                        <strong className="text-red-700">
                          ₹{Number(sales.outstandingAmount || 0).toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <div className="text-xs text-gray-700">
                        Credit Terms: <strong>{sales.creditDays || 0} Days</strong>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      {aiInsights?.objectionsDetected?.length > 0 ? (
                        aiInsights.objectionsDetected.slice(0, 2).map((obj: string, i: number) => (
                          <div
                            key={i}
                            className="text-red-650 flex items-start gap-1 font-semibold"
                          >
                            <span>•</span> <span>{obj}</span>
                          </div>
                        ))
                      ) : latestVisit.riskFactors ? (
                        <div className="text-red-650 flex items-start gap-1 font-semibold">
                          <span>•</span> <span>{latestVisit.riskFactors}</span>
                        </div>
                      ) : (
                        <p className="text-gray-600 italic">No major buying objections flagged.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Opportunities & Growth */}
                <div className="card p-4 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Opportunities & Growth
                      </h4>
                      <Award className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="text-[10px] text-gray-450 font-semibold italic mb-1.5">
                      What product ranges should we upsell next?
                    </p>
                    <div className="text-xs font-bold text-gray-800 mb-1.5">
                      Est. Value: ₹
                      {Number(sales.potentialBusinessValue || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      {aiInsights?.crossSellingOpportunities?.length > 0 ? (
                        aiInsights.crossSellingOpportunities
                          .slice(0, 2)
                          .map((opp: any, i: number) => (
                            <div key={i} className="text-gray-700 leading-tight">
                              <span className="font-semibold text-indigo-700">
                                • {opp.opportunity}:
                              </span>{' '}
                              <span className="text-[11px] text-gray-500">{opp.reason}</span>
                            </div>
                          ))
                      ) : (
                        <p className="text-gray-550 italic">
                          Explore waterproofing or protective coatings expansion.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. Competitor Threat */}
                <div className="card p-4 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Competitor Threat
                      </h4>
                      <Package className="h-4 w-4 text-purple-500" />
                    </div>
                    <p className="text-[10px] text-gray-450 font-semibold italic mb-1.5">
                      Who are we competing against?
                    </p>
                    <div className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-150 inline-block mb-2">
                      Current Supplier: {sales.currentSupplier || 'N/A'}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {aiInsights?.competitorInsights ||
                        `Active pricing and supply threats from ${sales.currentSupplier || 'local paint brands'}.`}
                    </p>
                  </div>
                </div>

                {/* 6. Next Executive Action */}
                <div className="card p-4 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Next Executive Action
                      </h4>
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="text-[10px] text-gray-450 font-semibold italic mb-1.5">
                      What must the executive execute next?
                    </p>
                    {aiInsights?.aiExecutiveSummary?.nextExecutiveAction ? (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-2.5">
                        <p className="text-xs font-bold text-blue-800 leading-normal">
                          {aiInsights.aiExecutiveSummary.nextExecutiveAction}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600 leading-relaxed italic">
                        No immediate directive. Conduct regular billing outstanding follow-up.
                      </p>
                    )}
                  </div>
                </div>

                {/* 7. Technical Status */}
                <div className="card p-4 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Technical Status
                      </h4>
                      <ThumbsUp className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="text-[10px] text-gray-450 font-semibold italic mb-1.5">
                      Are technical parameters/trials approved?
                    </p>
                    <div className="flex gap-2 mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${latestVisit.trialApproved ? 'bg-green-50 text-green-700 border-green-150' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      >
                        Trial: {latestVisit.trialApproved ? 'Approved' : 'Pending'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${latestVisit.sampleGiven ? 'bg-blue-50 text-blue-700 border-blue-150' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      >
                        Sample: {latestVisit.sampleGiven ? 'Provided' : 'No'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {aiInsights?.aiExecutiveSummary?.technicalStatus ||
                        (latestVisit.technicalChallenges?.length > 0
                          ? `Unresolved: ${latestVisit.technicalChallenges.join(', ')}.`
                          : 'No critical trials active.')}
                    </p>
                  </div>
                </div>

                {/* 8. Commercial Readiness */}
                <div className="card p-4 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Commercial Readiness
                      </h4>
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="text-[10px] text-gray-450 font-semibold italic mb-1.5">
                      Is price or supply contract negotiation complete?
                    </p>
                    <div className="text-xs text-gray-600 mb-2 space-y-0.5">
                      <div>
                        Rate:{' '}
                        <strong>
                          ₹{Number(sales.currentPurchaseRate || 0).toLocaleString('en-IN')}/L
                        </strong>
                      </div>
                      <div>
                        Expected:{' '}
                        <strong>
                          ₹{Number(sales.expectedRate || 0).toLocaleString('en-IN')}/L
                        </strong>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {aiInsights?.aiExecutiveSummary?.commercialReadiness ||
                        'Negotiating volume discount and rebate credit structure.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═ Tab 2: Metrics ═════════════════════════════════════════════════════ */}
      {activeTab === 'metrics' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Charts section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-5 border border-gray-200 bg-white rounded-2xl shadow-sm relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <Activity className="h-4.5 w-4.5 text-indigo-600" />
                    Relationship & Probability Trends
                  </h3>
                  <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                    Visual tracker across visits. Hover points for parameters.
                  </p>
                </div>

                {visits.length >= 2 && (
                  <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-[10px] font-bold">
                    <button
                      onClick={() => {
                        setActiveTrendMetric('conversion');
                        setHoveredPoint(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeTrendMetric === 'conversion'
                          ? 'bg-white text-gray-950 shadow-sm border border-gray-200'
                          : 'text-gray-500'
                      }`}
                    >
                      Conversion %
                    </button>
                    <button
                      onClick={() => {
                        setActiveTrendMetric('relationship');
                        setHoveredPoint(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeTrendMetric === 'relationship'
                          ? 'bg-white text-gray-950 shadow-sm border border-gray-200'
                          : 'text-gray-500'
                      }`}
                    >
                      Relationship (x10)
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Empty states for metrics */}
              {visits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertTriangle className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm font-bold text-gray-550">No visit data available.</p>
                </div>
              ) : visits.length === 1 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4">
                  <Activity className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm font-bold text-gray-500">
                    Trend graph requires at least 2 visits
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Only 1 visit report has been recorded for this customer.
                  </p>
                </div>
              ) : (
                <div className="relative mt-2">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-auto overflow-visible"
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal gridlines */}
                    {[0, 25, 50, 75, 100].map(yVal => {
                      const gridY =
                        chartHeight - paddingY - (yVal * (chartHeight - 2 * paddingY)) / 100;
                      return (
                        <g key={yVal}>
                          <line
                            x1={paddingX}
                            y1={gridY}
                            x2={chartWidth - paddingX}
                            y2={gridY}
                            stroke="#f1f5f9"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={paddingX - 10}
                            y={gridY + 4}
                            textAnchor="end"
                            className="text-[9px] font-bold fill-gray-400"
                          >
                            {yVal}%
                          </text>
                        </g>
                      );
                    })}

                    {/* X axis labels */}
                    {chronologicalVisits.map((visit, i) => {
                      const x =
                        paddingX +
                        (i * (chartWidth - 2 * paddingX)) / (chronologicalVisits.length - 1);
                      return (
                        <text
                          key={visit.id}
                          x={x}
                          y={chartHeight - paddingY + 18}
                          textAnchor="middle"
                          className="text-[8px] font-bold fill-gray-400"
                        >
                          {new Date(visit.visitDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </text>
                      );
                    })}

                    {/* Area under line */}
                    <path d={getAreaPath()} fill="url(#chartGradient)" />

                    {/* Trend line */}
                    <path d={getLinePath()} fill="none" stroke="var(--primary)" strokeWidth="3" />

                    {/* Points */}
                    {points.map((pt, i) => (
                      <g key={i}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={hoveredPoint?.visit?.id === pt.visit.id ? '7' : '5'}
                          className="fill-white stroke-[var(--primary)] stroke-2 cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredPoint(pt)}
                        />
                      </g>
                    ))}
                  </svg>

                  {/* Tooltip info */}
                  <div className="mt-4 p-3 bg-gray-50 border rounded-xl text-xs min-h-[64px] flex flex-col justify-center">
                    {hoveredPoint ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase">
                            Date / ID
                          </span>
                          <strong className="text-gray-800 font-bold block">
                            {formatDate(hoveredPoint.visit.visitDate)}
                          </strong>
                          <span className="text-[10px] text-[var(--primary)] block font-semibold">
                            {hoveredPoint.visit.reportNumber}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase">
                            Conversion
                          </span>
                          <strong className="text-gray-800 font-bold block">
                            {hoveredPoint.visit.conversionProbability ?? 0}%
                          </strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase">
                            Rel Strength
                          </span>
                          <strong className="text-gray-800 font-bold block">
                            {hoveredPoint.visit.relationshipStrength ?? 0}/10
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center font-medium italic text-[11px]">
                        Hover over circles on the trend line above to inspect individual visit
                        metrics.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Competitive Intelligence aggregation */}
            <div className="card p-5 border border-gray-200 bg-white rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-1.5">
                <Package className="h-4.5 w-4.5 text-purple-650" />
                Competitive Intelligence
              </h3>

              {competitorsList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {competitorsList.map((c, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 border border-gray-250 p-4 rounded-xl space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-gray-800 text-sm">{c.name}</h4>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                              c.count > 2 ||
                              sales.currentSupplier?.toLowerCase().includes(c.name.toLowerCase())
                                ? 'bg-red-50 text-red-700 border border-red-150'
                                : 'bg-amber-50 text-amber-700 border border-amber-150'
                            }`}
                          >
                            Threat:{' '}
                            {c.count > 2 ||
                            sales.currentSupplier?.toLowerCase().includes(c.name.toLowerCase())
                              ? 'High'
                              : 'Medium'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-semibold block">
                          Visits Encountered: {c.count}
                        </span>

                        <div className="mt-2 space-y-1.5 text-xs text-gray-700">
                          <div>
                            <span className="font-semibold text-gray-450 block text-[10px] uppercase">
                              Why Customer Prefers Them
                            </span>
                            <p className="mt-0.5 font-medium">
                              {c.reasonsUsing.filter(Boolean).join('; ') ||
                                'Long-term relationship or price schemes.'}
                            </p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-450 block text-[10px] uppercase">
                              DMOR Competitive Advantage
                            </span>
                            <p className="mt-0.5 font-medium">
                              {c.reasonsShift.filter(Boolean).join('; ') ||
                                'Superior coating durability & custom hardener formulation.'}
                            </p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-450 block text-[10px] uppercase">
                              Risk Analysis
                            </span>
                            <p className="mt-0.5 font-medium">
                              {c.strengths.filter(Boolean).join('; ') ||
                                'Competitor offers high volume rebates & extended credit terms.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-gray-200">
                        <span className="font-bold text-purple-750 block text-[9px] uppercase tracking-wider mb-1">
                          Suggested Strategy
                        </span>
                        <p className="text-xs text-purple-900 bg-purple-50/50 p-2 rounded border border-purple-100 font-semibold leading-relaxed">
                          {getCounterStrategy(c.name)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-450 italic text-center py-4">
                  No competitors registered in historical logs.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: analytics aggregates */}
          <div className="space-y-6">
            {/* Customer Engagement Summary */}
            <div className="card p-5 border border-gray-200 bg-white rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3 border-b pb-2">
                Customer Engagement Summary
              </h3>
              <div className="space-y-1">
                <InfoRow label="Relationship Age" value={analytics.relationshipAge || 'N/A'} />
                <InfoRow label="Total Visits" value={analytics.totalVisits} />
                <InfoRow
                  label="Avg Days Between Visits"
                  value={analytics.avgGapDays ? `${analytics.avgGapDays} days` : 'N/A'}
                />
                <InfoRow
                  label="Last Meeting"
                  value={daysSinceLastVisit !== null ? `${daysSinceLastVisit} days ago` : 'N/A'}
                />
                <InfoRow
                  label="Follow-up Compliance"
                  value={analytics.followupCompliance || '100%'}
                />
                <InfoRow
                  label="Sales Activity Trend"
                  value={
                    <span
                      className={`font-bold ${
                        analytics.salesActivityTrend === 'Increasing'
                          ? 'text-green-600'
                          : analytics.salesActivityTrend === 'Declining'
                            ? 'text-red-600'
                            : 'text-gray-600'
                      }`}
                    >
                      {analytics.salesActivityTrend || 'Stable'}
                    </span>
                  }
                />
              </div>
            </div>

            {/* Product Interest & Technical Summary */}
            <div className="card p-5 border border-gray-200 bg-white rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-1.5">
                <Award className="h-4.5 w-4.5 text-indigo-650" />
                Product Interest & Technical Summary
              </h3>

              <div className="space-y-4 text-xs">
                {/* Most Discussed Products */}
                <div>
                  <span className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                    Most Discussed Products
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {products.paintRequirementTypes?.length > 0 ? (
                      products.paintRequirementTypes.map((p: string, idx: number) => (
                        <span
                          key={idx}
                          className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100"
                        >
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 italic">None logged</span>
                    )}
                  </div>
                </div>

                {/* Highest Purchase Interest */}
                <div>
                  <span className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                    Highest Purchase Interest
                  </span>
                  {aiInsights?.recommendedProducts?.length > 0 ? (
                    <div className="space-y-1 mt-1">
                      {aiInsights.recommendedProducts.slice(0, 2).map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-emerald-50/70 text-emerald-800 font-semibold p-2 rounded border border-emerald-150 leading-tight"
                        >
                          <span className="font-bold">{item.product}</span> –{' '}
                          <span className="text-[10px] text-emerald-600">{item.reason}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">No recommendations available.</span>
                  )}
                </div>

                {/* Active Trial Products */}
                <div>
                  <span className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                    Active Trial Products
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {uniqueActiveTrials.length > 0 ? (
                      uniqueActiveTrials.map((t: string, idx: number) => (
                        <span
                          key={idx}
                          className="bg-pink-50 text-pink-700 font-bold px-2 py-0.5 rounded border border-pink-100"
                        >
                          {t} (Trial Running)
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 italic">No trials currently running.</span>
                    )}
                  </div>
                </div>

                {/* Technical Issues Summary */}
                <div className="border-t pt-3 mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                      Issues Raised
                    </span>
                    <div className="space-y-1">
                      {products.technicalChallenges?.length > 0 ? (
                        products.technicalChallenges.map((c: string, idx: number) => (
                          <span
                            key={idx}
                            className="bg-red-50 text-red-650 font-bold px-2 py-0.5 rounded border border-red-100 block text-center truncate"
                            title={c}
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-150 block text-center font-bold">
                          No issues
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                      Issues Resolved
                    </span>
                    <div className="space-y-1">
                      {resolvedIssues.length > 0 ? (
                        resolvedIssues.map((c: any, idx: number) => (
                          <span
                            key={idx}
                            className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-100 block text-center truncate"
                            title={c}
                          >
                            {c} (Resolved)
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-center block py-0.5">
                          None computed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pending Technical Support & Recommended Next Action */}
                <div className="border-t pt-3 mt-3 space-y-3">
                  {pendingTechSupportCount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">
                        Pending Tech Support
                      </span>
                      <span className="text-xs font-bold text-red-650 bg-red-50 border border-red-150 px-2 py-0.25 rounded-full">
                        {pendingTechSupportCount} Requests
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                      Recommended Next Tech Action
                    </span>
                    <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 border rounded-lg p-2 font-medium">
                      {aiInsights?.aiExecutiveSummary?.technicalStatus ||
                        'Continue monitoring site trial application and ensure shade match parameters are confirmed.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═ Tab 3: Timeline ════════════════════════════════════════════════════ */}
      {activeTab === 'timeline' && (
        <div className="card p-5 border border-gray-200 bg-white rounded-2xl shadow-sm animate-fade-in">
          <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2 flex items-center justify-between">
            <span>Chronological Visit Timeline</span>
            <span className="text-xs text-gray-450 font-semibold">
              {visits.length} Visit Reports
            </span>
          </h3>

          {visits.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Visit Date</th>
                    <th className="py-2.5 px-3">Report Number</th>
                    <th className="py-2.5 px-3">Visit Category</th>
                    <th className="py-2.5 px-3">Executive</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit: any) => (
                    <tr
                      key={visit.id}
                      className="border-b last:border-0 hover:bg-gray-55/50 transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-gray-850">
                        {formatDate(visit.visitDate)}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--primary)] font-bold">
                        {visit.reportNumber}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-700">
                        {visit.visitType || visit.visitCategory}
                      </td>
                      <td className="py-3 px-3 text-gray-600 font-medium">
                        {visit.executiveName || '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_BADGE[visit.status] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {visit.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => navigate(`/operations/field-intelligence/${visit.id}`)}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-950 transition-colors cursor-pointer"
                            title="View Detail"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {(user?.Role === 'Admin' ||
                            user?.Role === 'SuperAdmin' ||
                            (visit.status === 'Draft' &&
                              (Number(visit.executiveId) === Number(user?.EmployeeID) ||
                                Number(visit.createdBy) === Number(user?.EmployeeID)))) && (
                            <button
                              onClick={() =>
                                navigate(`/operations/field-intelligence/${visit.id}/edit`)
                              }
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-yellow-600 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-450 italic text-center py-6">
              No historical records logged for this company.
            </p>
          )}
        </div>
      )}

      {/* ═ Tab 4: Paint OS AI Chat ════════════════════════════════════════════ */}
      {activeTab === 'chat' && (
        <div className="card p-0 border border-gray-200 bg-white rounded-2xl shadow-sm flex flex-col h-[520px] overflow-hidden animate-fade-in">
          {/* Header Console controls */}
          <div className="bg-gray-50 border-b p-3.5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-gray-800">
                Paint OS AI Assistant Scoped Context
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClearChat}
                disabled={chatLoading}
                className="text-[10px] bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold hover:bg-gray-50 transition-colors disabled:opacity-60 cursor-pointer"
              >
                Clear Conversation
              </button>
            </div>
          </div>

          {/* Message timeline area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-white ${m.role === 'user' ? 'bg-primary-600' : 'bg-indigo-600'}`}
                >
                  {m.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-3.5 rounded-2xl shadow-sm relative border ${
                    m.role === 'user'
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)] rounded-tr-none'
                      : 'bg-white text-gray-850 border-gray-200 rounded-tl-none'
                  }`}
                >
                  {m.role === 'user' ? (
                    <p className="text-sm font-medium">{m.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none text-xs">
                      {m.content === '' && chatLoading ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.4s]" />
                        </div>
                      ) : (
                        <MessageFormatter content={m.content} />
                      )}
                    </div>
                  )}

                  {/* Actions (Copy message) */}
                  {m.content !== '' && m.role === 'assistant' && (
                    <button
                      onClick={() => handleCopyText(m.content)}
                      className="absolute right-2 bottom-1 p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-650 transition-colors"
                      title="Copy response"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Form input console */}
          <div className="border-t p-3 bg-white flex items-center gap-2">
            <input
              type="text"
              placeholder={
                chatLoading
                  ? 'Assistant generating response...'
                  : 'Ask Paint OS AI about customer dashboard profiles, competitors, or visits...'
              }
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSendChat();
              }}
              disabled={chatLoading}
              className="flex-1 px-4 py-2.5 border border-gray-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors disabled:opacity-65"
            />
            {chatLoading ? (
              <button
                onClick={handleStopGeneration}
                className="bg-red-50 text-red-650 hover:bg-red-100 border border-red-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() => handleSendChat()}
                disabled={!chatInput.trim()}
                className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Send
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboardPage;

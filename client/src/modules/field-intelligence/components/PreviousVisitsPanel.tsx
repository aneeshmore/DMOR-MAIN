import React, { useState } from 'react';
import { Eye, ChevronDown, ChevronUp, Calendar, User, Tag, FileText } from 'lucide-react';

interface PreviousVisitsPanelProps {
  history: any[];
}

export const PreviousVisitsPanel: React.FC<PreviousVisitsPanelProps> = ({ history }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (!history || history.length === 0) return null;

  // Take last 5 visits
  const displayHistory = history.slice(0, 5);

  return (
    <div className="card p-6 mb-6 border border-indigo-100 bg-gradient-to-r from-indigo-50/10 to-blue-50/10">
      <div className="flex justify-between items-center border-b pb-2 mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
          Previous Visits History ({history.length})
        </h3>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs font-semibold border border-gray-300 rounded-lg px-2.5 py-1 bg-white hover:bg-gray-50 text-gray-600 flex items-center gap-1 transition-colors cursor-pointer"
        >
          {isCollapsed ? (
            <>
              Show History <ChevronDown className="h-3 w-3" />
            </>
          ) : (
            <>
              Hide History <ChevronUp className="h-3 w-3" />
            </>
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
          {displayHistory.map((visit: any) => {
            const purposes: string[] = Array.isArray(visit.visitPurpose)
              ? visit.visitPurpose
              : typeof visit.visitPurpose === 'string'
                ? JSON.parse(visit.visitPurpose || '[]')
                : [];

            return (
              <div
                key={visit.id}
                className="p-4 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      {visit.visitType || 'Visit'}
                    </span>
                    <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(visit.visitDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {visit.executiveName || 'Unknown'}
                    </span>
                  </div>

                  {purposes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tag className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      {purposes.map((p, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium border border-gray-200"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {visit.discussionNotes && visit.discussionNotes.trim() !== '' && (
                    <div className="text-xs text-gray-600 flex items-start gap-1 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <FileText className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="line-clamp-2 leading-relaxed">
                        {visit.discussionNotes.replace(/\n\n\[Order Status:.*\]$/s, '')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 self-end md:self-center">
                  <a
                    href={`/operations/field-intelligence/${visit.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold border border-indigo-200 rounded-lg px-3 py-1.5 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-600 flex items-center gap-1 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Details
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PreviousVisitsPanel;

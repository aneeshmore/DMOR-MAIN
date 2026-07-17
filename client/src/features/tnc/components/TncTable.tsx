import React, { useMemo } from 'react';
import { Edit2, Trash2, FileText, Calendar, CreditCard, Truck, Tag, Search } from 'lucide-react';
import { Tnc } from '../types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface TncTableProps {
  data: Tnc[];
  onEdit: (tnc: Tnc) => void;
  onDelete: (id: number) => void;
}

// Type icons mapping
const getTypeIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'payment':
      return <CreditCard size={14} className="text-emerald-600" />;
    case 'delivery':
      return <Truck size={14} className="text-blue-600" />;
    default:
      return <Tag size={14} className="text-purple-600" />;
  }
};

const getTypeStyle = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'payment':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'delivery':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-purple-100 text-purple-700 border-purple-200';
  }
};

export const TncTable: React.FC<TncTableProps> = ({ data, onEdit, onDelete }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('all');

  // Get unique types
  const uniqueTypes = useMemo(() => {
    const types = new Set(data.map(t => t.type || 'General'));
    return Array.from(types).sort();
  }, [data]);

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch =
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.type || 'General').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = filterType === 'all' || (item.type || 'General') === filterType;

      return matchesSearch && matchesType;
    });
  }, [data, searchQuery, filterType]);

  // Group by type for stats
  const stats = useMemo(() => {
    const grouped: Record<string, number> = {};
    data.forEach(item => {
      const type = item.type || 'General';
      grouped[type] = (grouped[type] || 0) + 1;
    });
    return grouped;
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <div
          onClick={() => setFilterType('all')}
          className={`bg-[var(--surface)] p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
            filterType === 'all'
              ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20'
              : 'border-[var(--border)]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileText size={20} className="text-indigo-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">{data.length}</div>
              <div className="text-xs text-[var(--text-secondary)]">All Terms</div>
            </div>
          </div>
        </div>

        <div
          onClick={() => setFilterType('Payment')}
          className={`bg-[var(--surface)] p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
            filterType === 'Payment'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CreditCard size={20} className="text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{stats['Payment'] || 0}</div>
              <div className="text-xs text-[var(--text-secondary)]">Payment Terms</div>
            </div>
          </div>
        </div>

        <div
          onClick={() => setFilterType('Delivery')}
          className={`bg-[var(--surface)] p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
            filterType === 'Delivery'
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck size={20} className="text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats['Delivery'] || 0}</div>
              <div className="text-xs text-[var(--text-secondary)]">Delivery Terms</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Terms & Conditions Library
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {filteredData.length} of {data.length} terms shown
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
              />
              <input
                type="text"
                placeholder="Search terms..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] w-full md:w-64"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--surface-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold w-16 text-center">Sr. No.</th>
                <th className="p-4 font-semibold w-32">Type</th>
                <th className="p-4 font-semibold">Description</th>
                <th className="p-4 font-semibold w-40 hidden lg:table-cell">Last Updated</th>
                <th className="p-4 font-semibold w-32 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center">
                    <div className="flex flex-col items-center">
                      <FileText
                        size={48}
                        className="text-[var(--text-secondary)] opacity-30 mb-4"
                      />
                      <p className="text-lg font-medium text-[var(--text-secondary)]">
                        {data.length === 0 ? 'No terms added yet' : 'No matching terms found'}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {data.length === 0
                          ? 'Start by adding a payment or delivery term above'
                          : 'Try adjusting your search or filter'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr
                    key={item.tncId}
                    className="hover:bg-[var(--surface-secondary)] transition-colors group"
                  >
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--surface-secondary)] text-[var(--text-secondary)] font-mono text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant="secondary"
                        className={`${getTypeStyle(item.type)} flex items-center gap-1.5 w-fit`}
                      >
                        {getTypeIcon(item.type)}
                        {item.type || 'General'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <p className="text-[var(--text-primary)] font-medium leading-relaxed">
                        {item.description}
                      </p>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                        <Calendar size={14} />
                        {format(new Date(item.updatedAt), 'dd MMM yyyy')}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onEdit(item)}
                          className="p-2.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all hover:scale-105"
                          title="Edit Term"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(item.tncId)}
                          className="p-2.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all hover:scale-105"
                          title="Delete Term"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filteredData.length > 0 && (
          <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)] text-sm text-[var(--text-secondary)]">
            Showing {filteredData.length} of {data.length} terms
            {filterType !== 'all' && (
              <button
                onClick={() => setFilterType('all')}
                className="ml-2 text-[var(--primary)] hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

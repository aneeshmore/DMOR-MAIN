import React from 'react';
import { TestCertificateResult } from '../types/testCertificate.types';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface CertificateResultsTableProps {
  results: TestCertificateResult[];
  onChange: (results: TestCertificateResult[]) => void;
  readOnly?: boolean;
  batchSelected?: boolean;
}

export const CertificateResultsTable: React.FC<CertificateResultsTableProps> = ({
  results,
  onChange,
  readOnly = false,
  batchSelected = false,
}) => {
  const handleAddRow = () => {
    const newRow: TestCertificateResult = {
      propertyName: '',
      resultValue: '',
      specification: '',
      sortOrder: results.length,
      checked: true,
    };
    onChange([...results, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    const updated = results.filter((_, idx) => idx !== index);
    const reindexed = updated.map((item, idx) => ({ ...item, sortOrder: idx }));
    onChange(reindexed);
  };

  const handleCellChange = (index: number, field: keyof TestCertificateResult, value: any) => {
    const updated = results.map((row, idx) => {
      if (idx === index) {
        const updatedRow = { ...row, [field]: value };
        const paramNameLower = updatedRow.propertyName?.trim().toLowerCase() || '';

        if (paramNameLower === 'colour / shade' || paramNameLower === 'finish') {
          updatedRow.specification = updatedRow.resultValue || '';
        }
        return updatedRow;
      }
      return row;
    });
    onChange(updated);
  };

  const moveRow = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === results.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...results];

    // Swap items
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reindexed = updated.map((item, idx) => ({ ...item, sortOrder: idx }));
    onChange(reindexed);
  };

  // Header checkbox logic
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  const allChecked = results.length > 0 && results.every(r => r.checked);
  const someChecked = results.length > 0 && results.some(r => r.checked);
  const isIndeterminate = someChecked && !allChecked;

  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleHeaderCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const updated = results.map(r => ({ ...r, checked }));
    onChange(updated);
  };

  return (
    <div className="card bg-white p-6 border shadow-sm rounded-xl space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Test Results Specification Grid
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Only selected rows (checked) will be stored and printed on the certificate.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAddRow}
            className="btn bg-primary-500 hover:bg-primary-600 text-white text-xs px-3 py-1.5 flex items-center gap-1 shadow-sm transition-all rounded-lg font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Row
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse border border-gray-100 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider">
              {!readOnly && (
                <th className="py-3 px-4 border-b border-gray-100 w-16 text-center select-none">
                  <input
                    type="checkbox"
                    ref={headerCheckboxRef}
                    checked={allChecked}
                    onChange={handleHeaderCheckboxChange}
                    className="h-4.5 w-4.5 rounded border-gray-300 text-primary-500 focus:ring-primary-400 cursor-pointer"
                    title="Select / Deselect All"
                  />
                </th>
              )}
              <th className="py-3 px-4 border-b border-gray-100 w-1/3">Parameter</th>
              <th className="py-3 px-4 border-b border-gray-100 w-1/4">Specification</th>
              <th className="py-3 px-4 border-b border-gray-100 w-1/4">Result</th>
              {!readOnly && (
                <th className="py-3 px-4 border-b border-gray-100 w-32 text-center">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td
                  colSpan={readOnly ? 3 : 5}
                  className="py-10 text-center text-sm text-gray-400 italic bg-gray-50/20"
                >
                  No parameters added. Click &quot;Add Row&quot; to start adding test
                  specifications.
                </td>
              </tr>
            ) : (
              results.map((row, index) => {
                const paramNameLower = row.propertyName?.trim().toLowerCase() || '';
                return (
                  <tr
                    key={index}
                    className={`border-b border-gray-100 hover:bg-gray-50/40 transition-colors odd:bg-gray-50/10 ${
                      row.checked ? 'bg-primary-50/5' : ''
                    }`}
                  >
                    {!readOnly && (
                      <td className="py-3.5 px-4 border-r border-gray-50 text-center select-none">
                        <input
                          type="checkbox"
                          checked={!!row.checked}
                          onChange={e => handleCellChange(index, 'checked', e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-gray-300 text-primary-500 focus:ring-primary-400 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="py-3.5 px-4 border-r border-gray-50">
                      <input
                        type="text"
                        className="input py-1.5 px-3 text-sm rounded-lg border-gray-200 focus:ring-1 focus:ring-primary-400 font-medium text-black disabled:text-black"
                        style={{ color: 'black', WebkitTextFillColor: 'black', opacity: 1 }}
                        placeholder="e.g., Viscosity, Density..."
                        value={row.propertyName}
                        onChange={e => handleCellChange(index, 'propertyName', e.target.value)}
                        disabled={readOnly}
                      />
                    </td>
                    <td className="py-3.5 px-4 border-r border-gray-50">
                      <input
                        type="text"
                        className="input py-1.5 px-3 text-sm rounded-lg border-gray-200 focus:ring-1 focus:ring-primary-400 text-black disabled:text-black"
                        style={{ color: 'black', WebkitTextFillColor: 'black', opacity: 1 }}
                        placeholder="Enter specification..."
                        value={row.specification || ''}
                        onChange={e => handleCellChange(index, 'specification', e.target.value)}
                        disabled={
                          readOnly ||
                          paramNameLower === 'colour / shade' ||
                          paramNameLower === 'finish' ||
                          (batchSelected &&
                            (paramNameLower === 'density' ||
                              paramNameLower === 'viscosity' ||
                              paramNameLower === 'solid content'))
                        }
                      />
                    </td>
                    <td className="py-3.5 px-4 border-r border-gray-50">
                      {paramNameLower === 'finish' ? (
                        <select
                          value={row.resultValue || ''}
                          onChange={e => handleCellChange(index, 'resultValue', e.target.value)}
                          disabled={readOnly}
                          className="input py-1.5 px-2.5 text-sm rounded-lg border-gray-200 focus:ring-1 focus:ring-primary-400 font-semibold text-black disabled:text-black"
                          style={{ color: 'black', WebkitTextFillColor: 'black', opacity: 1 }}
                        >
                          <option value="">Select Finish...</option>
                          <option value="Matt">Matt</option>
                          <option value="Semi Glossy">Semi Glossy</option>
                          <option value="Glossy">Glossy</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="input py-1.5 px-3 text-sm rounded-lg border-gray-200 focus:ring-1 focus:ring-primary-400 font-semibold text-black disabled:text-black"
                          style={{ color: 'black', WebkitTextFillColor: 'black', opacity: 1 }}
                          placeholder="Enter result..."
                          value={row.resultValue}
                          onChange={e => handleCellChange(index, 'resultValue', e.target.value)}
                          disabled={
                            readOnly ||
                            (batchSelected &&
                              (paramNameLower === 'density' ||
                                paramNameLower === 'viscosity' ||
                                paramNameLower === 'solid content'))
                          }
                        />
                      )}
                    </td>
                    {!readOnly && (
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveRow(index, 'up')}
                            className="text-gray-400 hover:text-primary-600 disabled:opacity-30 p-1 hover:bg-gray-100 rounded-md transition-colors"
                            title="Move Up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === results.length - 1}
                            onClick={() => moveRow(index, 'down')}
                            className="text-gray-400 hover:text-primary-600 disabled:opacity-30 p-1 hover:bg-gray-100 rounded-md transition-colors"
                            title="Move Down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default CertificateResultsTable;

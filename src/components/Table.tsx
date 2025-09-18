import React from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T;
  render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
}

const Table = <T extends { id: string }>(
  { columns, data, isLoading = false }: TableProps<T>
): React.ReactElement => {
  
  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg shadow p-8 text-center text-gray-500">
        <p>Cargando...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-surface rounded-lg shadow p-8 text-center text-gray-500">
        <p>No se encontraron datos.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg shadow overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.accessor)}
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td
                  key={`${item.id}-${String(column.accessor)}`}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                >
                  {column.render ? column.render(item) : String(item[column.accessor])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;

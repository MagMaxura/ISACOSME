
import React from 'react';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, children }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
      <h2 className="text-2xl md:text-3xl font-bold text-on-surface mb-3 sm:mb-0">{title}</h2>
      <div className="flex items-center space-x-2">
        {children}
      </div>
    </div>
  );
};

export default PageHeader;

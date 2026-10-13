import React, { Suspense } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { LayoutProvider, useLayout } from '../../context/LayoutContext';
import '../../styles/MainLayout.css';

interface MainLayoutContentProps {
  children: React.ReactNode;
}

const MainLayoutContent: React.FC<MainLayoutContentProps> = ({ children }) => {
  const { isSidebarOpen } = useLayout();

  return (
    <div className="layout-container">
      <Header />
      <div className="layout-body">
        <Sidebar />
        <main className={`main-content ${!isSidebarOpen ? 'expanded' : ''}`}>
          <Suspense fallback={<div className="page-loader" role="status" aria-label="Carregando"><div className="page-loader-spinner" /></div>}>
            {children}
          </Suspense>
        </main>
      </div>

    </div>
  );
};

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <LayoutProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </LayoutProvider>
  );
};

export default MainLayout;

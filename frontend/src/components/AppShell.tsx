'use client';
import Sidebar from './Sidebar';
import PremiumHeader from './PremiumHeader';

interface Props {
  children: React.ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: Props) {
  return (
    <div className="shell-root">
      <Sidebar />
      {/* Ghost spacer: real flex child whose width matches the fixed sidebar,
          so shell-body is correctly offset without margin-left tricks */}
      <div className="shell-spacer" aria-hidden="true" />
      <div className="shell-body">
        <PremiumHeader title={title} />
        <main className="shell-main">
          {children}
        </main>
      </div>
    </div>
  );
}

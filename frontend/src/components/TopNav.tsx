import { Link, useLocation } from 'react-router-dom';
import { Zap } from 'lucide-react';

export function TopNav() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground tracking-tight">Clawkathon</span>
        </Link>
        {isHome && (
          <Link to="/jobs/new" className="btn-primary text-sm">
            New Job
          </Link>
        )}
      </div>
    </nav>
  );
}

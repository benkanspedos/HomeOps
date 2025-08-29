'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Server,
  DollarSign,
  Bell,
  Bot,
  Settings,
  Shield,
  Activity,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Network
} from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Services', href: '/dashboard/services', icon: Server },
  { name: 'System Monitoring', href: '/monitoring', icon: Monitor, badge: 'new' },
  { name: 'Task Delegation', href: '/delegation', icon: Network, badge: 'new' },
  { name: 'Accounts', href: '/accounts', icon: DollarSign },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Automations', href: '/automations', icon: Bot },
  { name: 'DNS Management', href: '/dns', icon: Shield },
  { name: 'Health', href: '/health', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        'fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-40',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || 
              (item.href === '/monitoring' && pathname.startsWith('/monitoring'));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors relative',
                  isActive
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon className={clsx('h-5 w-5', !isCollapsed && 'mr-3')} />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1">
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {isCollapsed && item.badge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p>Version 1.0.0</p>
              <p className="mt-1">Sprint 1 - Infrastructure</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
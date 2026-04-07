'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

export interface BreadcrumbItem {
  label: string;
  href: string;
  isCurrentPage: boolean;
}

// Map route segments to display names
const routeNameMap: Record<string, string> = {
  dashboard: '仪表盘',
  home: '首页',
  cellular: '蜂窝网络',
  sms: '短信中心',
  'custom-profiles': '自定义配置',
  'connection-scenarios': '连接场景',
  'cell-locking': '频段锁定',
  'tower-locking': '基站锁定',
  'frequency-locking': '频点锁定',
  'cell-scanner': '小区扫描',
  'neighbourcell-scanner': '邻区扫描',
  'frequency-calculator': '频点计算器',
  settings: '设置',
  'apn-management': 'APN 管理',
  'network-priority': '网络优先级',
  'imei-settings': 'IMEI 设置',
  'fplmn-settings': 'FPLMN 设置',
  'local-network': '本地网络',
  'ip-passthrough': 'IP 透传',
  'ttl-settings': 'TTL 与 MTU 设置',
  monitoring: '监控',
  latency: '延迟监控',
  logs: '日志',
  'email-alerts': '邮件告警',
  watchdog: '看门狗',
  'system-settings': '系统设置',
  'about-device': '关于设备',
  support: '支持',
};

export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();

  return useMemo(() => {
    // Remove leading/trailing slashes and split by '/'
    const segments = pathname.split('/').filter(Boolean);
    
    if (segments.length === 0) {
      return [];
    }

    // Build breadcrumb items
    const breadcrumbs: BreadcrumbItem[] = segments.map((segment, index) => {
      // Build the href by joining all segments up to current index
      const href = '/' + segments.slice(0, index + 1).join('/');
      
      // Get display name from map or capitalize the segment
      const label = routeNameMap[segment] || 
        segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      
      // Last segment is the current page
      const isCurrentPage = index === segments.length - 1;

      return {
        label,
        href,
        isCurrentPage,
      };
    });

    return breadcrumbs;
  }, [pathname]);
}

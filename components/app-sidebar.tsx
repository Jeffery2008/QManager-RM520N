"use client";

import * as React from "react";
import {
  LifeBuoy,
  PieChart,
  Settings2,
  HomeIcon,
  RadioTowerIcon,
  LucideSignal,
  MessageCircleIcon,
  DogIcon,
  GlobeIcon,
  RouterIcon,
  User2Icon,
  HeartIcon,
  ScanIcon,
  SettingsIcon,
  TerminalIcon,
  DownloadIcon,
  TerminalSquareIcon,
} from "lucide-react";

import QManagerLogo from "@/public/qmanager-logo.svg";

import { NavMain } from "@/components/nav-main";
import { NavLocalNetwork } from "@/components/nav-localNetwork";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { NavMonitoring } from "@/components/nav-monitoring";
import { NavCellular } from "@/components/nav-cellular";
import { NavSystem } from "@/components/nav-system";
import DonateDialog from "@/components/donate-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Image from "next/image";
import Link from "next/link";

const data = {
  user: {
    name: "管理员",
    avatar: QManagerLogo.src,
  },
  navMain: [
    {
      title: "首页",
      url: "/dashboard",
      icon: HomeIcon,
      isActive: true,
    },
  ],
  system: [
    {
      title: "系统设置",
      url: "/system-settings",
      icon: SettingsIcon,
      items: [
        {
          title: "日志",
          url: "/system-settings/logs",
        },
      ],
    },
    {
      title: "软件更新",
      url: "/system-settings/software-update",
      icon: DownloadIcon,
    },
    {
      title: "AT 终端",
      url: "/system-settings/at-terminal",
      icon: TerminalIcon,
    },
    {
      title: "Web 控制台",
      url: "/system-settings/web-console",
      icon: TerminalSquareIcon,
    },
  ],
  navSecondary: [
    {
      title: "关于设备",
      url: "/about-device",
      icon: RouterIcon,
    },
    {
      title: "支持",
      url: "/support",
      icon: LifeBuoy,
    },
    {
      title: "支持项目",
      url: "#",
      icon: HeartIcon,
    },
  ],
  cellular: [
    {
      title: "蜂窝信息",
      url: "/cellular",
      icon: RadioTowerIcon,
      items: [
        {
          title: "天线统计",
          url: "/cellular/antenna-statistics",
        },
        {
          title: "天线校准",
          url: "/cellular/antenna-alignment",
        }
      ],
    },
    {
      title: "短信中心",
      url: "/cellular/sms",
      icon: MessageCircleIcon,
    },
    {
      title: "自定义配置",
      url: "/cellular/custom-profiles",
      icon: User2Icon,
      items: [
        {
          title: "连接场景",
          url: "/cellular/custom-profiles/connection-scenarios",
        },
      ],
    },
    {
      title: "频段锁定",
      url: "/cellular/cell-locking",
      icon: LucideSignal,
      items: [
        {
          title: "基站锁定",
          url: "/cellular/cell-locking/tower-locking",
        },
        {
          title: "频点锁定",
          url: "/cellular/cell-locking/frequency-locking",
        },
      ],
    },
    {
      title: "小区扫描",
      url: "/cellular/cell-scanner",
      icon: ScanIcon,
      items: [
        {
          title: "邻区扫描",
          url: "/cellular/cell-scanner/neighbourcell-scanner",
        },
        {
          title: "频点计算器",
          url: "/cellular/cell-scanner/frequency-calculator",
        },
      ],
    },
    {
      title: "设置",
      url: "/cellular/settings",
      icon: Settings2,
      items: [
        {
          title: "APN 管理",
          url: "/cellular/settings/apn-management",
        },
        {
          title: "网络优先级",
          url: "/cellular/settings/network-priority",
        },
        {
          title: "IMEI 设置",
          url: "/cellular/settings/imei-settings",
        },
        {
          title: "FPLMN 设置",
          url: "/cellular/settings/fplmn-settings",
        },
      ],
    },
  ],
  localNetwork: [
    {
      title: "设置",
      url: "/local-network/ip-passthrough",
      icon: Settings2,
      items: [
        {
          title: "TTL 与 MTU 设置",
          url: "/local-network/ttl-settings",
        },
      ],
    },
  ],
  monitoring: [
    {
      title: "网络事件",
      url: "/monitoring",
      icon: PieChart,
      items: [
        {
          title: "延迟监控",
          url: "/monitoring/latency",
        },
        {
          title: "邮件告警",
          url: "/monitoring/email-alerts",
        },
        {
          title: "短信告警",
          url: "/monitoring/sms-alerts",
        },
      ],
    },
    {
      title: "看门狗",
      url: "/monitoring/watchdog",
      icon: DogIcon,
    },
    {
      title: "Tailscale VPN",
      url: "/monitoring/tailscale",
      icon: GlobeIcon,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [donateOpen, setDonateOpen] = React.useState(false);

  const navSecondaryItems = data.navSecondary.map((item) =>
    item.title === "支持项目"
      ? { ...item, onClick: () => setDonateOpen(true) }
      : item,
  );

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Image
                    src={QManagerLogo}
                    alt="QManager 标志"
                    className="size-full"
                    priority
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">QManager</span>
                  <span className="truncate text-xs">管理员</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavCellular cellular={data.cellular} />
        <NavLocalNetwork localNetwork={data.localNetwork} />
        <NavMonitoring monitoring={data.monitoring} />
        <NavSystem system={data.system} />
        <NavSecondary items={navSecondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <DonateDialog open={donateOpen} onOpenChange={setDonateOpen} />
    </Sidebar>
  );
}

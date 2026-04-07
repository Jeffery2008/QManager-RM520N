"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronsUpDown,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  Power,
  RefreshCw,
  Sun,
  Camera,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { logout } from "@/hooks/use-auth";
import { authFetch } from "@/lib/auth-fetch";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();

  // --- Display name from device hostname ---
  const [displayName, setDisplayName] = useState<string>(user.name);
  const [avatarSrc, setAvatarSrc] = useState<string>(() => {
    if (typeof window === "undefined") return user.avatar;
    return localStorage.getItem("qm_display_avatar") || user.avatar;
  });

  // Fetch hostname from system settings on mount
  useEffect(() => {
    authFetch("/cgi-bin/quecmanager/system/settings.sh")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.settings?.hostname) {
          setDisplayName(json.settings.hostname);
        }
      })
      .catch(() => {});
  }, []);

  // --- Dialog state ---
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [rebootDialogOpen, setRebootDialogOpen] = useState(false);
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // --- Name edit state ---
  const [nameInput, setNameInput] = useState(displayName);

  // --- Avatar upload ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      localStorage.setItem("qm_display_avatar", base64);
      setAvatarSrc(base64);
      toast.success("头像已更新。");
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  // --- Name save (updates device hostname) ---
  const [savingName, setSavingName] = useState(false);

  const handleNameSave = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setSavingName(true);
    try {
      const resp = await authFetch("/cgi-bin/quecmanager/system/settings.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_settings", hostname: name }),
      });
      const json = await resp.json();
      if (!json.success) {
        toast.error("更新显示名称失败。");
        return;
      }
      setDisplayName(name);
      setNameDialogOpen(false);
      toast.success("显示名称已更新。");
    } catch {
      toast.error("更新显示名称失败。");
    } finally {
      setSavingName(false);
    }
  };

  // --- Reboot (optimistic) ---
  // Navigate to the countdown page FIRST, then fire the reboot request.
  // This ensures the /reboot/ page loads from cache/memory before the
  // device goes offline. The backend delays reboot by 1s after responding.
  const handleReboot = async (e: React.MouseEvent) => {
    e.preventDefault();
    setRebooting(true);

    // Prepare session state for the countdown page
    sessionStorage.setItem("qm_rebooting", "1");
    document.cookie = "qm_logged_in=; Path=/; Max-Age=0";

    // Fire-and-forget: keepalive ensures the request survives page navigation.
    fetch("/cgi-bin/quecmanager/system/reboot.sh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reboot" }),
      keepalive: true,
    }).catch(() => {});

    // Navigate to countdown page immediately
    window.location.href = "/reboot/";
  };

  const handleReconnect = async (e: React.MouseEvent) => {
    e.preventDefault();
    setReconnecting(true);
    try {
      const resp = await authFetch("/cgi-bin/quecmanager/system/reboot.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconnect" }),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success("已开始重新连接网络，连接可能会短暂中断。");
      } else {
        toast.error("重新连接失败。");
      }
    } catch {
      toast.error("发送重新连接命令失败。");
    } finally {
      setReconnecting(false);
      setReconnectDialogOpen(false);
    }
  };

  const initials =
    displayName
      .split(/[-_ ]+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "QM";

  return (
    <>
      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatarSrc} alt={displayName} />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  {/* Clickable avatar with camera overlay */}
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    className="relative group shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="更换头像"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={avatarSrc} alt={displayName} />
                      <AvatarFallback className="rounded-lg">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="size-3.5 text-white" />
                    </div>
                  </button>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => {
                    setNameInput(displayName);
                    setNameDialogOpen(true);
                  }}
                >
                  <Pencil />
                  修改显示名称
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  <KeyRound />
                  修改密码
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setTheme(theme === "dark" ? "light" : "dark")
                  }
                >
                  <Sun className="dark:hidden" />
                  <Moon className="hidden dark:block" />
                  切换主题
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setReconnectDialogOpen(true)}
              >
                <RefreshCw />
                重新连接网络
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setRebootDialogOpen(true)}
              >
                <Power />
                重启设备
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout()}>
                <LogOut />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Change Display Name dialog */}
      <Dialog
        open={nameDialogOpen}
        onOpenChange={(open) => {
          setNameDialogOpen(open);
          if (!open) setNameInput(displayName);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>修改显示名称</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="输入名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSave();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNameDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleNameSave}
              disabled={!nameInput.trim() || nameInput.trim() === displayName || savingName}
            >
              {savingName ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />

      <AlertDialog open={reconnectDialogOpen} onOpenChange={(open) => {
        if (!reconnecting) setReconnectDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新连接网络</AlertDialogTitle>
            <AlertDialogDescription>
              这将先从网络注销再重新注册，以强制建立全新连接。期间网络会短暂中断。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reconnecting}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={reconnecting}
              onClick={handleReconnect}
            >
              {reconnecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  重连中...
                </>
              ) : (
                "重新连接"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rebootDialogOpen} onOpenChange={(open) => {
        if (!rebooting) setRebootDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重启设备</AlertDialogTitle>
            <AlertDialogDescription aria-live="polite">
              {rebooting
                ? "重启命令已发送，你即将被退出登录..."
                : "设备将会重启，在重新上线之前所有网络连接都会中断。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rebooting}>
              稍后再说
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={rebooting}
              onClick={handleReboot}
            >
              {rebooting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  重启中...
                </>
              ) : (
                "立即重启"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

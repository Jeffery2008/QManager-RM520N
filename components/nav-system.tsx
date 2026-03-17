"use client"

import * as React from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavSystem({
  system,
}: {
  system: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    disabled?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const rawPathname = usePathname()
  const pathname = rawPathname.endsWith('/') && rawPathname !== '/' ? rawPathname.slice(0, -1) : rawPathname
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    const states: Record<string, boolean> = {}
    system.forEach((item) => {
      states[item.title] = pathname === item.url || (!!item.items?.length && item.items.some(sub => pathname === sub.url || pathname.startsWith(sub.url + "/")))
    })
    setOpenItems(states)
  }, [pathname, system])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        System
      </SidebarGroupLabel>
      <SidebarMenu>
        {system.map((item) => {
          const isParentOrChildActive = pathname === item.url || (!!item.items?.length && item.items.some(sub => pathname === sub.url || pathname.startsWith(sub.url + "/")))

          return (
          <Collapsible
            key={item.title}
            asChild
            open={openItems[item.title] ?? false}
            onOpenChange={(isOpen) => setOpenItems((prev) => ({ ...prev, [item.title]: isOpen }))}
          >
            <SidebarMenuItem>
              {item.disabled ? (
                <SidebarMenuButton tooltip={item.title} disabled className="opacity-50 pointer-events-none">
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton asChild tooltip={item.title} isActive={isParentOrChildActive}>
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              )}
              {item.items?.length ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => {
                        const isSubItemActive = pathname === subItem.url || pathname.startsWith(subItem.url + "/")
                        return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isSubItemActive}>
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )})}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
        )})}
      </SidebarMenu>
    </SidebarGroup>
  )
}

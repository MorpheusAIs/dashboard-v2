"use client"

import * as React from "react"
import {
  CircleDollarSign,
  Cpu,
  Users,
  Wrench,
  Share2,
  BarChart,
} from "lucide-react"
import Image from "next/image"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"

const navigation = [
  {
    title: "Capital",
    url: "/capital",
    icon: CircleDollarSign,
  },
  {
    title: "Compute",
    url: "/compute",
    icon: Cpu,
  },
  {
    title: "Builders",
    url: "/builders",
    icon: Users,
  },
  // {
  //   title: "MOR20",
  //   url: "/mor20",
  //   icon: Wrench,
  //   disabled: true,
  // },
  // {
  //   title: "Referrals",
  //   url: "/referrals",
  //   icon: Share2,
  //   disabled: true,
  // },
  // {
  //   title: "Metrics",
  //   url: "/metrics",
  //   icon: BarChart,
  //   disabled: true,
  // },
]

export function AppSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  
  // Check for visual width of the sidebar to determine if it's collapsed
  useEffect(() => {
    if (!sidebarRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        // Assuming sidebar width less than 100px means it's collapsed
        const isCollapsed = entry.contentRect.width < 100;
        setCollapsed(isCollapsed);
      }
    });
    
    resizeObserver.observe(sidebarRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  
  return (
    <Sidebar 
      ref={sidebarRef}
      collapsible="icon" 
      className={cn("sidebar-base", className)} 
      {...props}
    >
      <SidebarHeader className="sidebar-header">
        <span className="sr-only" role="heading" aria-level={1}>
          Navigation Menu
        </span>
        <div className="sidebar-logo-container-base">
          <Image
            src="/logo-green.svg"
            alt="Logo"
            width={collapsed ? 24 : 40}
            height={collapsed ? 24 : 40}
            className={cn(
              "sidebar-logo-base",
              collapsed && "scale-90 -translate-x-3"
            )}
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="flex flex-col h-full">
        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const isActive = pathname === item.url
            return (
              <div
                key={item.title}
                className={cn(
                  "sidebar-nav-link-base",
                  item.disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "sidebar-nav-link-hover",
                  isActive && !item.disabled && "sidebar-nav-link-active"
                )}
              >
                {!item.disabled ? (
                  <Link href={item.url} className="flex items-center w-full">
                    <item.icon className="sidebar-nav-icon" />
                    <span className={cn(
                      "sidebar-nav-text-base",
                      isActive ? "sidebar-nav-text-active" : "sidebar-nav-text-inactive"
                    )}>
                      {item.title}
                    </span>
                  </Link>
                ) : (
                  <Link href={item.url} className="flex items-center w-full cursor-pointer">
                    <item.icon className="sidebar-nav-icon" />
                    <span className={cn(
                      "sidebar-nav-text-base sidebar-nav-text-inactive"
                    )}>
                      {item.title}
                    </span>
                  </Link>
                )}
              </div>
            )
          })}
        </nav>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

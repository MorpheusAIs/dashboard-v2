"use client"

import * as React from "react"
import {
  ArrowLeftRight,
  CircleDollarSign,
  // Cpu,
  Users,
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

const navigation = [
  {
    title: "Capital",
    url: "/capital",
    icon: CircleDollarSign,
  },
  {
    title: "Builders",
    url: "/builders",
    icon: Users,
  },
  {
    title: "Bridge MOR",
    url: "/bridge-mor",
    icon: ArrowLeftRight,
  },
  // {
  //   title: "Compute",
  //   url: "/compute",
  //   icon: Cpu,
  // },
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
  
  return (
    <Sidebar 
      collapsible="icon" 
      className={cn("sidebar-base bg-background", className)} 
      {...props}
    >
      <SidebarHeader className="sidebar-header group-data-[state=collapsed]:pl-0.5 group-data-[state=expanded]:pl-2">
        <span className="sr-only" role="heading" aria-level={1}>
          Navigation Menu
        </span>
        <div className="sidebar-logo-container-base flex items-center p-2 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:ml-0">
          <Image
            src="/logo-green.svg"
            alt="Logo"
            width={40}
            height={40}
            className="sidebar-logo-base transition-all duration-200 group-data-[state=collapsed]:w-6 group-data-[state=collapsed]:h-6"
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="flex flex-col h-full bg-background opacity-100">
        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const isActive = pathname === item.url
            return (
              <Link
                key={item.title}
                href={item.url}
                className={cn(
                  "sidebar-nav-link-base",
                  "sidebar-nav-link-hover",
                  isActive && "sidebar-nav-link-active"
                )}
              >
                <div className="flex items-center w-full pointer-events-none">
                  <item.icon className="sidebar-nav-icon" />
                  <span className={cn(
                    "sidebar-nav-text-base ml-3",
                    isActive ? "sidebar-nav-text-active" : "sidebar-nav-text-inactive"
                  )}>
                    {item.title}
                  </span>
                </div>
              </Link>
            )
          })}
        </nav>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

"use client"

import * as React from "react"
import {
  ArrowLeftRight,
  CircleDollarSign,
  // Cpu,
  Globe,
  Users,
} from "lucide-react"
import Image from "next/image"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { cn } from "@/lib/utils"

const MOR_ORG_URL = "https://mor.org"

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
    title: "Bridge",
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
        <a
          href={MOR_ORG_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Go to mor.org"
          className="sidebar-logo-container-base flex items-center p-2 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:ml-0"
        >
          <Image
            src="/logo-green.svg"
            alt="Logo"
            width={40}
            height={40}
            // The global `* { cursor: default }` rule would otherwise hide the link's pointer over the image
            className="sidebar-logo-base cursor-pointer transition-all duration-200 group-data-[state=collapsed]:w-6 group-data-[state=collapsed]:h-6"
          />
        </a>
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
      <SidebarFooter className="px-2 pb-4">
        {/* Text only when expanded; the globe stands in for it when the sidebar is collapsed to icons */}
        <a
          href={MOR_ORG_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Go to mor.org"
          className="sidebar-nav-link-base sidebar-nav-link-hover"
        >
          <Globe className="sidebar-nav-icon pointer-events-none hidden group-data-[state=collapsed]:block" />
          <span className="sidebar-nav-text-base sidebar-nav-text-inactive ml-0 pointer-events-none group-data-[state=collapsed]:hidden">
            mor.org
          </span>
        </a>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

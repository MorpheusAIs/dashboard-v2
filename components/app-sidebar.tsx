"use client"

import * as React from "react"
import {
  Building2,
  Cpu,
  Users,
  Wrench,
  Share2,
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
    icon: Building2,
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
  {
    title: "MOR20",
    url: "/mor20",
    icon: Wrench,
  },
  {
    title: "Referrals",
    url: "/referrals",
    icon: Share2,
  },
]

export function AppSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  
  return (
    <Sidebar 
      collapsible="icon" 
      className={cn("sidebar-base sidebar-collapsed", className)} 
      {...props}
    >
      <SidebarHeader className={cn("sidebar-header sidebar-header-collapsed")}>
        <span className="sr-only" role="heading" aria-level={1}>
          Navigation Menu
        </span>
        <div className={cn("sidebar-logo-container-base sidebar-logo-container-collapsed")}>
          <Image
            src="/logo-green.svg"
            alt="Logo"
            width={32}
            height={32}
            className={cn("sidebar-logo-base sidebar-logo-collapsed")}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav className={cn("sidebar-nav sidebar-nav-collapsed")}>
          {navigation.map((item) => {
            const isActive = pathname === item.url
            return (
              <Link
                key={item.title}
                href={item.url}
                className={cn(
                  "sidebar-nav-link-base sidebar-nav-link-hover sidebar-nav-link-collapsed",
                  isActive && "sidebar-nav-link-active"
                )}
              >
                <item.icon className="sidebar-nav-icon" />
                <span className={cn(
                  "sidebar-nav-text-base sidebar-nav-text-collapsed",
                  isActive ? "sidebar-nav-text-active" : "sidebar-nav-text-inactive"
                )}>
                  {item.title}
                </span>
              </Link>
            )
          })}
        </nav>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

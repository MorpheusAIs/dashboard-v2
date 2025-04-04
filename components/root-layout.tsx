"use client"

import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { useChainId } from 'wagmi'
import { MORBalance } from "./mor-balance"
import { TestnetIndicator } from "./testnet-indicator"
import { builders } from "@/app/builders/builders-data"

function getPageInfo(pathname: string) {
  const segments = pathname.split('/')
  const section = segments[1]
  
  if (!section) return { title: 'Dashboard' }
  
  // If we're on a builder detail page
  if (section === 'builders' && segments.length > 2) {
    const builderSlug = segments[2]
    const builder = builders.find(b => 
      b.name.toLowerCase().replace(/\s+/g, '-') === builderSlug
    )
    return {
      title: 'Builders',
      subPage: builder?.name
    }
  }
  
  return {
    title: section.charAt(0).toUpperCase() + section.slice(1)
  }
}

export function RootLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname()
  const chainId = useChainId()
  const isTestnet = chainId === 421614 // Arbitrum Sepolia
  const pageInfo = getPageInfo(pathname)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          {/* Left section */}
          <div className="flex items-center gap-2 px-4 flex-1">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbLink href={`/${pageInfo.title.toLowerCase()}`}>
                    {pageInfo.title}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {pageInfo.subPage && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{pageInfo.subPage}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Center section */}
          <div className="flex-1 flex justify-center gap-4">
            {isTestnet && <TestnetIndicator />}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2 px-4 flex-1 justify-end">
            <MORBalance />
            <w3m-button size="sm"/>
          </div>
        </header>
        {/* Page specific content */}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 
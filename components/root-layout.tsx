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
import { CowSwapModal } from "./cowswap-modal"
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
  const isTestnet = chainId === 421614 || chainId === 8453 || chainId === 11155111 // Arbitrum Sepolia or Base Sepolia or Sepolia
  const pageInfo = getPageInfo(pathname)

  return (
    <SidebarProvider className="overflow-hidden w-screen h-screen">
      <AppSidebar />
      <SidebarInset className="min-w-0 h-full flex flex-col">
        <header className="flex flex-col md:flex-row h-auto md:h-20 shrink-0 gap-2 pt-2 sm:pt-0 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:md:h-12 overflow-x-hidden min-w-0">
          {/* Main row */}
          <div className="flex items-center gap-2 h-20 md:h-auto flex-1">
            {/* Left section */}
            <div className="flex items-center gap-2 px-4 flex-1 min-w-0">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              {/* Mobile: Show CowSwapModal/TestnetIndicator on the left */}
              <div className="sm:hidden">
                {isTestnet ? <TestnetIndicator /> : <CowSwapModal />}
              </div>
              {/* <Breadcrumb className="hidden md:block">
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
              </Breadcrumb> */}
            </div>

            {/* Center section */}
            <div className="flex-1 justify-center gap-4 min-w-0 hidden md:flex">
              {isTestnet ? <TestnetIndicator /> : <CowSwapModal />}
            </div>

            {/* Right section */}
            <div className="flex items-center gap-2 px-4 flex-1 justify-end min-w-0">
              <div className="hidden md:block">
                <MORBalance />
              </div>
              <w3m-button size="sm"/>
            </div>
          </div>

          {/* Mobile second row for MORBalance */}
          <div className="flex md:hidden justify-center pb-2">
            <MORBalance />
          </div>
        </header>
        {/* Page specific content */}
        <div className="flex flex-1 flex-col gap-4 p-1 sm:p-4 pt-0 overflow-auto min-w-0 min-h-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 
"use client"

import { AppSidebar } from "@/components/app-sidebar"
// import {
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbLink,
//   BreadcrumbList,
//   BreadcrumbPage,
//   BreadcrumbSeparator,
// } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
// import { usePathname } from "next/navigation"
import Link from "next/link"
import { useChainId } from 'wagmi'
import { MORBalance } from "./mor-balance"
import { TestnetIndicator } from "./testnet-indicator"
import { MyBalanceModal } from "./my-balance-modal"
// import { builders } from "@/app/builders/builders-data"

// function getPageInfo(pathname: string) {
//   const segments = pathname.split('/')
//   const section = segments[1]
  
//   if (!section) return { title: 'Dashboard' }
  
//   // If we're on a builder detail page
//   if (section === 'builders' && segments.length > 2) {
//     const builderSlug = segments[2]
//     const builder = builders.find(b => 
//       b.name.toLowerCase().replace(/\s+/g, '-') === builderSlug
//     )
//     return {
//       title: 'Builders',
//       subPage: builder?.name
//     }
//   }
  
//   return {
//     title: section.charAt(0).toUpperCase() + section.slice(1)
//   }
// }

export function RootLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  // const pathname = usePathname()
  const chainId = useChainId()
  const isTestnet = chainId === 421614 || chainId === 11155111 // Arbitrum Sepolia or Sepolia
  // const pageInfo = getPageInfo(pathname)

  return (
    <SidebarProvider className="overflow-hidden w-screen h-screen">
      <AppSidebar />
      <SidebarInset className="min-w-0 h-full flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-1 sm:gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 sm:mr-2 h-4" />
          </div>
          
          <div className="flex-1 flex items-center justify-center min-w-0">
            {isTestnet ? (
              <TestnetIndicator />
            ) : (
              <>
                {/* Mobile: Show MyBalanceModal */}
                <div className="sm:hidden">
                  <MyBalanceModal />
                </div>
                {/* Desktop: Show Bridge MOR Link */}
                <div className="hidden sm:block">
                  <Link 
                    href="/bridge-mor"
                    className="copy-button-base text-sm px-4 py-1 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105 transition-all duration-300"
                  >
                    Bridge MOR
                  </Link>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 flex-shrink-0">
            <div className="hidden sm:block">
              <MORBalance />
            </div>
            <w3m-button size="sm"/>
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
import { Info } from "lucide-react"

interface ReferralLinkCardProps {
  title: string
  link: string
  className?: string
}

export function ReferralLinkCard({ title, link, className = "" }: ReferralLinkCardProps) {
  return (
    <div className={`card-container group ${className}`}>
      <div className="card-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
      <div className="relative">
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          <Info className="card-info-icon" />
        </div>
        <div className="flex items-center gap-4">
          <code className="referral-link-code">
            {link}
          </code>
          <button 
            onClick={() => navigator.clipboard.writeText(link)}
            className="copy-button"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  )
} 

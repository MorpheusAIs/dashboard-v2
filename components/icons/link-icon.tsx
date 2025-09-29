interface IconProps {
  className?: string;
  size?: number | string;
}

export function LinkIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      fill="none" 
      viewBox="0 0 24 24"
      className={className}
    >
      {/* Simple placeholder for LINK - will use a chain link style icon */}
      <path fill="#000" d="M24 0H0v24h24z"/>
      <path 
        fill="#4285F4" 
        d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 1.5A8.5 8.5 0 0 0 3.5 12A8.5 8.5 0 0 0 12 20.5 8.5 8.5 0 0 0 20.5 12A8.5 8.5 0 0 0 12 3.5zM8.5 9.5h3v1h-3v-1zm4 0h3v1h-3v-1zm-4 2h3v1h-3v-1zm4 0h3v1h-3v-1zm-4 2h7v1h-7v-1z"
      />
      <text 
        x="12" 
        y="15" 
        textAnchor="middle" 
        fill="#4285F4" 
        fontSize="8" 
        fontWeight="bold"
      >
        LINK
      </text>
    </svg>
  );
}

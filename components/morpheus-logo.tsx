import React from "react";

interface LogoProps {
  fill?: string;
  width?: number | string;
  height?: number | string;
}

const MorpheusLogo: React.FC<LogoProps> = ({ fill = "black", width = 100, height = 100 }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 1185 768"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
  >
    <path
      d="M592.5 462L446 276H512L592.5 378L673 276H739L592.5 462ZM118.5 152L265 206L265 246L168.5 206L265 246V278L59 191L118.5 152ZM265 333V365L168.5 325L265 365V397L59 310L118.5 271L265 333ZM265 451V483L168.5 443L265 483V515L59 428L118.5 389L265 451ZM920 206L1066.5 152L1126 191L920 278V246L1016.5 206L920 246V206ZM920 325L1066.5 271L1126 310L920 397V365L1016.5 325L920 365V325ZM920 443L1066.5 389L1126 428L920 515V483L1016.5 443L920 483V443Z"
      fill={fill}
    />
  </svg>
);

export default MorpheusLogo; 
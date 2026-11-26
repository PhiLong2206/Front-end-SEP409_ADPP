import React from "react";
import logoMark from "../../assets/images/adpp-logo-mark.png";

export interface AppLogoProps {
  /** Height in px; the width follows the picture (about 1.58 x the height). */
  size?: number;
  className?: string;
  /** Empty for a decorative logo that sits beside the text "ADPP". */
  alt?: string;
}

/** The ADPP mark: two speech bubbles in blue and cyan with a spark where they meet (transparent background). */
const AppLogo: React.FC<AppLogoProps> = ({ size = 36, className = "", alt = "" }) => (
  <img
    src={logoMark}
    alt={alt}
    height={size}
    style={{ height: size, width: "auto" }}
    draggable={false}
    className={`select-none ${className}`}
  />
);

export default AppLogo;

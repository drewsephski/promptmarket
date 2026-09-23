import type { CSSProperties, ReactNode } from "react";

interface BezelProps {
  children: ReactNode;
  className?: string;
  coreClassName?: string;
  style?: CSSProperties;
}

export function Bezel({
  children,
  className,
  coreClassName,
  style,
}: BezelProps) {
  const shell = className ? `bezel ${className}` : "bezel";
  const core = coreClassName ? `bezel-core ${coreClassName}` : "bezel-core";

  return (
    <div className={shell} style={style}>
      <div className={core}>{children}</div>
    </div>
  );
}

import { ReactNode } from "react";

interface AuthCardProps {
  children: ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] p-px">

      {/* rotating light */}
      <div className="absolute inset-0 animate-border-spin">

        <div
          className="
            absolute
            inset-[-150%]
            bg-[conic-gradient(from_0deg,transparent_0deg,transparent_310deg,#7DD3FC_330deg,transparent_350deg)]
          "
        />

      </div>

      {/* border */}
      <div className="absolute inset-0 rounded-[28px] border border-white/10" />

      {/* card */}
      <div className="relative rounded-[27px] bg-[#09090B] px-8 py-10">
        {children}
      </div>

    </div>
  );
}
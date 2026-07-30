import Link from "next/link";

interface AuthFooterProps {
  text: string;
  href: string;
  linkText: string;
}

export function AuthFooter({
  text,
  href,
  linkText,
}: AuthFooterProps) {
  return (
    <div className="mt-8 text-sm text-neutral-400">
      {text}{" "}
      <Link
        href={href}
        className="font-medium text-sky-300 hover:text-sky-200"
      >
        {linkText}
      </Link>
    </div>
  );
}
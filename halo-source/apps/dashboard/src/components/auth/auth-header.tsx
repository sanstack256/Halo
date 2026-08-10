interface AuthHeaderProps {
  title: string;
  description: string;
}

export function AuthHeader({
  title,
  description,
}: AuthHeaderProps) {
  return (
    <>
      <h1 className="text-4xl font-semibold tracking-tight text-white">
        {title}
      </h1>

      <p className="mt-3 text-sm leading-6 text-neutral-400">
        {description}
      </p>
    </>
  );
}
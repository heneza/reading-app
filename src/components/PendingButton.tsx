'use client';

import { useFormStatus } from 'react-dom';

type PendingButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
};

export default function PendingButton({
  children,
  pendingLabel = 'Working...',
  className,
  disabled,
  ...props
}: PendingButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${className ?? ''} disabled:cursor-wait disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
